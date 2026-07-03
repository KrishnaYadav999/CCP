const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Team = require('../models/Team');
const Notification = require('../models/Notification');
const { ROLES } = require('../constants/roles');
const { ADMIN_ROLES } = require('../constants/roles');
const { requireAuth, requireRoles } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { crmHeaders, getCrmBackendUrl, joinUrl, requestJson } = require('../utils/crmHttp');

const router = express.Router();

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publicUser(user) {
  const id = String(user._id || user.id || '');
  return {
    id,
    _id: id,
    ccpUserId: user.ccpUserId || id,
    crmUserId: user.crmUserId,
    source: user.source,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    team: user.team,
    teamId: user.teamId,
    managerId: user.managerId,
    operationHeadId: user.operationHeadId,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function requireSharedSecret(req, res, next) {
  const expectedSecrets = [process.env.CRM_SHARED_SECRET, process.env.CCP_SHARED_SECRET].filter(Boolean);
  if (!expectedSecrets.length) return next();

  const providedSecret = req.get('x-ccp-secret');
  if (!expectedSecrets.includes(providedSecret)) {
    return res.status(401).json({ error: 'Invalid CCP secret' });
  }

  return next();
}

function readDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function readOptionalId(value) {
  const raw = String(value || '').trim();
  return raw || undefined;
}

function normalizeIds(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

async function applyTeamUserMapping(team, manager, operationHead, members) {
  const teamId = String(team._id);
  const name = team.name;
  const memberSet = { teamId, team: name, managerId: String(manager._id) };
  if (operationHead) memberSet.operationHeadId = String(operationHead._id);

  await User.updateMany(
    { _id: { $in: members.map((member) => member._id) } },
    operationHead ? { $set: memberSet } : { $set: memberSet, $unset: { operationHeadId: '' } }
  );

  const managerUpdate = { teamId, team: name };
  if (operationHead) managerUpdate.operationHeadId = String(operationHead._id);
  await User.findByIdAndUpdate(manager._id, { $set: managerUpdate });

  if (operationHead) {
    await User.findByIdAndUpdate(operationHead._id, { $set: { teamId, team: name } });
  }
}

function publicTeam(team) {
  return {
    _id: String(team._id),
    id: String(team._id),
    ccpTeamId: team.ccpTeamId || String(team._id),
    crmTeamId: team.crmTeamId,
    source: team.source,
    name: team.name,
    description: team.description,
    manager: team.manager,
    operationHead: team.operationHead,
    members: team.members,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt
  };
}

function publicNotification(notification) {
  return {
    _id: String(notification._id),
    id: String(notification._id),
    ccpNotificationId: notification.ccpNotificationId || String(notification._id),
    crmNotificationId: notification.crmNotificationId,
    title: notification.title,
    description: notification.description,
    tag: notification.tag,
    status: notification.status,
    kind: notification.kind,
    createdByName: notification.createdByName,
    audience: notification.audience,
    visibleToRoles: notification.visibleToRoles,
    attachmentName: notification.attachmentName,
    attachmentUrl: notification.attachmentUrl,
    pinned: notification.pinned,
    metadata: notification.metadata,
    source: notification.source,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt
  };
}

router.post('/users/sync', requireSharedSecret, async (req, res) => {
  try {
    const action = String(req.body.action || '').trim().toLowerCase();
    const crmUserId = String(req.body.crmUserId || '').trim();
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').toLowerCase().trim();
    const role = String(req.body.role || 'operation').trim();
    const team = String(req.body.team || 'No team assigned').trim();
    const teamId = String(req.body.teamId || '').trim();
    const managerId = readOptionalId(req.body.managerId);
    const operationHeadId = readOptionalId(req.body.operationHeadId);
    const avatarUrl = req.body.avatarUrl === undefined || req.body.avatarUrl === null ? '' : String(req.body.avatarUrl);
    const source = String(req.body.source || 'crm').trim() || 'crm';
    const isActive = req.body.isActive === undefined ? true : Boolean(req.body.isActive);
    const password = String(req.body.password || '');

    if (!['create', 'update'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    if (!crmUserId) return res.status(400).json({ error: 'crmUserId is required' });
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (password && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    let user = await User.findOne({ crmUserId });
    const userByEmail = await User.findOne({ email });

    if (user && userByEmail && String(user._id) !== String(userByEmail._id)) {
      return res.status(409).json({ error: 'Email already belongs to another CCP user' });
    }

    if (!user) user = userByEmail;

    if (user) {
      user.name = name;
      user.email = email;
      user.role = role;
      user.team = team;
      user.teamId = teamId;
      user.managerId = managerId;
      user.operationHeadId = operationHeadId;
      user.avatarUrl = avatarUrl;
      user.isActive = isActive;
      user.crmUserId = crmUserId;
      user.ccpUserId = user.ccpUserId || String(user._id);
      user.source = source;
      await user.save();
      return res.json({ ok: true, ccpUserId: String(user._id), user: publicUser(user) });
    }

    const userData = {
      crmUserId,
      source,
      name,
      email,
      role,
      team,
      teamId,
      managerId,
      operationHeadId,
      avatarUrl,
      isActive
    };

    if (password) userData.password = await bcrypt.hash(password, 10);

    const createdAt = readDate(req.body.createdAt);
    const updatedAt = readDate(req.body.updatedAt);
    if (createdAt) userData.createdAt = createdAt;
    if (updatedAt) userData.updatedAt = updatedAt;

    const createdUser = await User.create(userData);
    createdUser.ccpUserId = String(createdUser._id);
    await createdUser.save();
    return res.status(201).json({ ok: true, ccpUserId: String(createdUser._id), user: publicUser(createdUser) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'User already exists' });
    }

    console.error('CRM user sync error', err);
    return res.status(500).json({ error: 'Unable to sync CRM user' });
  }
});

router.post('/teams/sync', requireSharedSecret, async (req, res) => {
  try {
    const action = String(req.body.action || '').trim().toLowerCase();
    const crmTeamId = String(req.body.crmTeamId || '').trim();
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const managerCrmId = String(req.body.managerId || '').trim();
    const operationHeadCrmId = String(req.body.operationHeadId || '').trim();
    const memberCrmIds = normalizeIds(req.body.members);
    const source = String(req.body.source || 'crm').trim() || 'crm';

    if (!['create', 'update'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    if (!crmTeamId) return res.status(400).json({ error: 'crmTeamId is required' });
    if (!name) return res.status(400).json({ error: 'Team name is required' });
    if (!managerCrmId) return res.status(400).json({ error: 'Manager is required' });

    const manager = await User.findOne({ crmUserId: managerCrmId, isActive: true });
    if (!manager) return res.status(400).json({ error: 'Manager CRM user is not mapped in CCP' });

    let operationHead = null;
    if (operationHeadCrmId) {
      operationHead = await User.findOne({ crmUserId: operationHeadCrmId, isActive: true });
      if (!operationHead) return res.status(400).json({ error: 'Operation head CRM user is not mapped in CCP' });
    }

    const members = memberCrmIds.length
      ? await User.find({ crmUserId: { $in: memberCrmIds }, isActive: true })
      : [];
    if (members.length !== memberCrmIds.length) {
      return res.status(400).json({ error: 'One or more CRM team members are not mapped in CCP' });
    }

    let team = await Team.findOne({ crmTeamId });
    const teamByName = await Team.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
    if (team && teamByName && String(team._id) !== String(teamByName._id)) {
      return res.status(409).json({ error: 'Team name already belongs to another CCP team' });
    }
    if (!team) team = teamByName;

    if (team) {
      team.name = name;
      team.description = description;
      team.manager = manager._id;
      team.operationHead = operationHead?._id;
      team.members = members.map((member) => member._id);
      team.crmTeamId = crmTeamId;
      team.ccpTeamId = team.ccpTeamId || String(team._id);
      team.source = source;
      await team.save();
    } else {
      team = await Team.create({
        name,
        description,
        manager: manager._id,
        operationHead: operationHead?._id,
        members: members.map((member) => member._id),
        crmTeamId,
        source
      });
      team.ccpTeamId = String(team._id);
      await team.save();
    }

    await applyTeamUserMapping(team, manager, operationHead, members);
    return res.json({ ok: true, ccpTeamId: String(team._id), team: publicTeam(team) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Team already exists' });
    console.error('CRM team sync error', err);
    return res.status(500).json({ error: 'Unable to sync CRM team' });
  }
});

router.post('/notifications/sync', requireSharedSecret, async (req, res) => {
  try {
    const action = String(req.body.action || '').trim().toLowerCase();
    const crmNotificationId = String(req.body.crmNotificationId || '').trim();
    const title = String(req.body.title || '').trim();

    if (!['create', 'update'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    if (!crmNotificationId) return res.status(400).json({ error: 'crmNotificationId is required' });
    if (!title) return res.status(400).json({ error: 'Notification title is required' });

    let notification = await Notification.findOne({ crmNotificationId });
    if (!notification && req.body.createdAt) {
      const createdAt = readDate(req.body.createdAt);
      if (createdAt) {
        const start = new Date(createdAt.getTime() - 1000);
        const end = new Date(createdAt.getTime() + 1000);
        notification = await Notification.findOne({
          title,
          source: String(req.body.source || 'crm').trim() || 'crm',
          createdAt: { $gte: start, $lte: end }
        });
      }
    }

    const data = {
      title,
      description: String(req.body.description || '').trim(),
      tag: String(req.body.tag || '').trim(),
      status: String(req.body.status || 'Active').trim() || 'Active',
      kind: String(req.body.kind || 'announcement').trim() || 'announcement',
      createdByName: String(req.body.createdByName || 'CRM Admin').trim(),
      audience: [],
      visibleToRoles: normalizeIds(req.body.visibleToRoles),
      attachmentName: String(req.body.attachmentName || '').trim(),
      attachmentUrl: String(req.body.attachmentUrl || '').trim(),
      pinned: Boolean(req.body.pinned),
      metadata: req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {},
      crmNotificationId,
      source: String(req.body.source || 'crm').trim() || 'crm'
    };

    if (Array.isArray(req.body.audience) && req.body.audience.length) {
      const audienceUsers = await User.find({ crmUserId: { $in: normalizeIds(req.body.audience) } }).select('_id');
      data.audience = audienceUsers.map((user) => user._id);
    }

    if (notification) {
      Object.assign(notification, data);
      notification.ccpNotificationId = notification.ccpNotificationId || String(notification._id);
      await notification.save();
    } else {
      notification = await Notification.create(data);
      notification.ccpNotificationId = String(notification._id);
      await notification.save();
    }

    return res.json({
      ok: true,
      ccpNotificationId: String(notification._id),
      notification: publicNotification(notification)
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Notification already exists' });
    console.error('CRM notification sync error', err);
    return res.status(500).json({ error: 'Unable to sync CRM notification' });
  }
});

async function pullFromCrm(path) {
  const baseUrl = getCrmBackendUrl();
  if (!baseUrl) {
    const error = new Error('CRM_BACKEND_URL is not configured');
    error.statusCode = 400;
    throw error;
  }

  const response = await requestJson(joinUrl(baseUrl, path), {
    method: 'GET',
    headers: crmHeaders()
  });
  return response.data;
}

router.post('/resync/users', requireAuth, requireRoles(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const data = await pullFromCrm('/auth/ccp/users');
  const users = data.users || data.data || [];
  let synced = 0;

  for (const user of users) {
    const crmUserId = String(user.crmUserId || user._id || user.id || '').trim();
    const email = String(user.email || '').toLowerCase().trim();
    if (!crmUserId || !email) continue;

    let doc = await User.findOne({ crmUserId });
    if (!doc) doc = await User.findOne({ email });
    if (!doc) doc = new User({ email });

    doc.crmUserId = crmUserId;
    doc.ccpUserId = doc.ccpUserId || String(doc._id);
    doc.name = String(user.name || '').trim();
    doc.email = email;
    doc.avatarUrl = user.avatarUrl || '';
    doc.role = ROLES.includes(user.role) ? user.role : 'operation';
    doc.team = user.team || 'No team assigned';
    doc.teamId = user.teamId || '';
    doc.managerId = readOptionalId(user.managerId);
    doc.operationHeadId = readOptionalId(user.operationHeadId);
    doc.isActive = user.isActive === undefined ? true : Boolean(user.isActive);
    doc.source = 'crm';
    await doc.save();
    synced += 1;
  }

  res.json({ ok: true, synced, users });
}));

router.post('/resync/teams', requireAuth, requireRoles(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const data = await pullFromCrm('/teams/ccp');
  const teams = data.teams || data.data || [];
  let synced = 0;

  for (const team of teams) {
    const crmTeamId = String(team.crmTeamId || team._id || team.id || '').trim();
    const name = String(team.name || '').trim();
    const managerCrmId = String(team.managerId || team.manager?.crmUserId || team.manager?._id || team.manager || '').trim();
    if (!crmTeamId || !name || !managerCrmId) continue;

    const manager = await User.findOne({ crmUserId: managerCrmId, isActive: true });
    if (!manager) continue;

    const operationHeadCrmId = String(team.operationHeadId || team.operationHead?.crmUserId || team.operationHead?._id || team.operationHead || '').trim();
    const operationHead = operationHeadCrmId ? await User.findOne({ crmUserId: operationHeadCrmId, isActive: true }) : null;
    const memberCrmIds = (team.members || []).map((member) => String(member.crmUserId || member._id || member.id || member || '').trim()).filter(Boolean);
    const members = memberCrmIds.length ? await User.find({ crmUserId: { $in: memberCrmIds }, isActive: true }) : [];

    let doc = await Team.findOne({ crmTeamId });
    if (!doc) doc = await Team.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
    if (!doc) doc = new Team({ name, manager: manager._id });

    doc.name = name;
    doc.description = team.description || '';
    doc.manager = manager._id;
    doc.operationHead = operationHead?._id;
    doc.members = members.map((member) => member._id);
    doc.crmTeamId = crmTeamId;
    doc.ccpTeamId = doc.ccpTeamId || String(doc._id);
    doc.source = 'crm';
    await doc.save();
    await applyTeamUserMapping(doc, manager, operationHead, members);
    synced += 1;
  }

  res.json({ ok: true, synced, teams });
}));

router.post('/resync/notifications', requireAuth, requireRoles(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const data = await pullFromCrm('/notifications/ccp');
  const notifications = data.notifications || data.data || [];
  let synced = 0;

  for (const notification of notifications) {
    const crmNotificationId = String(notification.crmNotificationId || notification._id || notification.id || '').trim();
    const title = String(notification.title || '').trim();
    if (!crmNotificationId || !title) continue;

    const existing = await Notification.findOne({
      crmNotificationId
    });
    const doc = existing || new Notification();
    Object.assign(doc, {
      title,
      description: notification.description || '',
      tag: notification.tag || '',
      status: notification.status || 'Active',
      kind: notification.kind || 'announcement',
      createdByName: notification.createdByName || 'CRM Admin',
      visibleToRoles: notification.visibleToRoles || [],
      attachmentName: notification.attachmentName || '',
      attachmentUrl: notification.attachmentUrl || '',
      pinned: Boolean(notification.pinned),
      metadata: notification.metadata || {},
      crmNotificationId,
      source: 'crm'
    });
    doc.ccpNotificationId = doc.ccpNotificationId || String(doc._id);
    await doc.save();
    synced += 1;
  }

  res.json({ ok: true, synced, notifications });
}));

module.exports = router;
