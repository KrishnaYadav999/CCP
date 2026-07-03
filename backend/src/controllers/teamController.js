const Team = require('../models/Team');
const User = require('../models/User');
const { syncUserToCrm } = require('../utils/crmUserSync');
const { syncTeamToCrm } = require('../utils/crmTeamSync');
const { hasFullAccess } = require('../utils/visibilityScope');

const userSelect = 'name email crmUserId ccpUserId source avatarUrl role team teamId managerId operationHeadId isActive createdAt updatedAt';

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeIds(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

async function applyTeamUserMapping(team, manager, operationHead, members) {
  const teamId = String(team._id);
  const memberSet = { teamId, team: team.name, managerId: String(manager._id) };
  if (operationHead) memberSet.operationHeadId = String(operationHead._id);

  await User.updateMany(
    { _id: { $in: members.map((member) => member._id) } },
    operationHead ? { $set: memberSet } : { $set: memberSet, $unset: { operationHeadId: '' } }
  );

  const managerUpdate = { teamId, team: team.name };
  if (operationHead) managerUpdate.operationHeadId = String(operationHead._id);
  await User.findByIdAndUpdate(manager._id, { $set: managerUpdate });

  if (operationHead) {
    await User.findByIdAndUpdate(operationHead._id, { $set: { teamId, team: team.name } });
  }

  const affectedIds = [
    manager._id,
    operationHead?._id,
    ...members.map((member) => member._id)
  ].filter(Boolean);
  const affectedUsers = await User.find({ _id: { $in: affectedIds } });
  await Promise.allSettled(affectedUsers.map((user) => syncUserToCrm('update', user)));
}

async function readTeamPayload(req, { teamIdToIgnore } = {}) {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const managerId = String(req.body.manager || req.body.managerId || '').trim();
  const operationHeadId = String(req.body.operationHead || req.body.operationHeadId || '').trim();
  const memberIds = normalizeIds(req.body.members || req.body.memberIds);

  if (!name) {
    const error = new Error('Team name is required');
    error.statusCode = 400;
    throw error;
  }
  if (!managerId) {
    const error = new Error('Manager is required');
    error.statusCode = 400;
    throw error;
  }

  const existing = await Team.findOne({
    name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
    ...(teamIdToIgnore ? { _id: { $ne: teamIdToIgnore } } : {})
  });
  if (existing) {
    const error = new Error('Team name already exists');
    error.statusCode = 400;
    throw error;
  }

  const manager = await User.findById(managerId);
  if (!manager || !manager.isActive) {
    const error = new Error('Active manager is required');
    error.statusCode = 400;
    throw error;
  }
  if (!['manager', 'admin', 'superadmin', 'operation'].includes(manager.role)) {
    const error = new Error('Selected manager role is not allowed');
    error.statusCode = 400;
    throw error;
  }

  let operationHead = null;
  if (operationHeadId) {
    operationHead = await User.findById(operationHeadId);
    if (!operationHead || !operationHead.isActive) {
      const error = new Error('Operation head must be an active user');
      error.statusCode = 400;
      throw error;
    }
  }

  const members = memberIds.length
    ? await User.find({ _id: { $in: memberIds }, isActive: true, managerId: String(manager._id) })
    : [];

  if (members.length !== memberIds.length) {
    const error = new Error('Members must be active users mapped under the selected manager');
    error.statusCode = 400;
    throw error;
  }

  return { name, description, manager, operationHead, members };
}

exports.listTeams = async (req, res) => {
  const query = {};

  if (!hasFullAccess(req.user)) {
    query.$or = [
      { manager: req.user._id },
      { operationHead: req.user._id },
      { members: req.user._id }
    ];
  }

  const teams = await Team.find(query)
    .populate('manager', userSelect)
    .populate('operationHead', userSelect)
    .populate('members', userSelect)
    .sort({ createdAt: -1, name: 1 });

  res.json({ ok: true, teams });
};

exports.createTeam = async (req, res) => {
  if (!hasFullAccess(req.user)) {
    return res.status(403).json({ error: 'You do not have permission for this action' });
  }

  const { name, description, manager, operationHead, members } = await readTeamPayload(req);

  const team = await Team.create({
    name,
    description,
    manager: manager._id,
    operationHead: operationHead?._id,
    members: members.map((member) => member._id),
    source: 'ccp',
    createdBy: req.user?._id
  });
  team.ccpTeamId = String(team._id);
  await team.save();

  await applyTeamUserMapping(team, manager, operationHead, members);

  let crmSync = { ok: true };
  try {
    crmSync = await syncTeamToCrm('create', team);
  } catch (err) {
    console.error('CRM team create sync failed', err.message);
    crmSync = { ok: false, error: err.message };
  }

  const populatedTeam = await Team.findById(team._id)
    .populate('manager', userSelect)
    .populate('operationHead', userSelect)
    .populate('members', userSelect);

  res.status(201).json({ ok: true, team: populatedTeam, crmSync });
};

exports.updateTeam = async (req, res) => {
  if (!hasFullAccess(req.user)) {
    return res.status(403).json({ error: 'You do not have permission for this action' });
  }

  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const { name, description, manager, operationHead, members } = await readTeamPayload(req, { teamIdToIgnore: team._id });

  team.name = name;
  team.description = description;
  team.manager = manager._id;
  team.operationHead = operationHead?._id;
  team.members = members.map((member) => member._id);
  team.ccpTeamId = team.ccpTeamId || String(team._id);
  team.source = team.source || 'ccp';
  await team.save();

  await applyTeamUserMapping(team, manager, operationHead, members);

  let crmSync = { ok: true };
  try {
    crmSync = await syncTeamToCrm('update', team);
  } catch (err) {
    console.error('CRM team update sync failed', err.message);
    crmSync = { ok: false, error: err.message };
  }

  const populatedTeam = await Team.findById(team._id)
    .populate('manager', userSelect)
    .populate('operationHead', userSelect)
    .populate('members', userSelect);

  res.json({ ok: true, team: populatedTeam, crmSync });
};
