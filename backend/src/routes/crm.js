const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');

const router = express.Router();

function publicUser(user) {
  const id = String(user._id || user.id || '');
  return {
    id,
    _id: id,
    ccpUserId: id,
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
      user.source = source;
      await user.save();
      return res.json({ ok: true, user: publicUser(user) });
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
    return res.status(201).json({ ok: true, user: publicUser(createdUser) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'User already exists' });
    }

    console.error('CRM user sync error', err);
    return res.status(500).json({ error: 'Unable to sync CRM user' });
  }
});

module.exports = router;
