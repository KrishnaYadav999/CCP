const Team = require('../models/Team');
const User = require('../models/User');
const { syncUserToCrm } = require('../utils/crmUserSync');
const { hasFullAccess } = require('../utils/visibilityScope');

const userSelect = 'name email crmUserId ccpUserId source avatarUrl role team teamId managerId operationHeadId isActive createdAt updatedAt';

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeIds(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
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

  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const managerId = String(req.body.manager || req.body.managerId || '').trim();
  const operationHeadId = String(req.body.operationHead || req.body.operationHeadId || '').trim();
  const memberIds = normalizeIds(req.body.members || req.body.memberIds);

  if (!name) return res.status(400).json({ error: 'Team name is required' });
  if (!managerId) return res.status(400).json({ error: 'Manager is required' });

  const existing = await Team.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  if (existing) return res.status(400).json({ error: 'Team name already exists' });

  const manager = await User.findById(managerId);
  if (!manager || !manager.isActive) return res.status(400).json({ error: 'Active manager is required' });
  if (!['manager', 'admin', 'superadmin', 'operation'].includes(manager.role)) {
    return res.status(400).json({ error: 'Selected manager role is not allowed' });
  }

  let operationHead = null;
  if (operationHeadId) {
    operationHead = await User.findById(operationHeadId);
    if (!operationHead || !operationHead.isActive) return res.status(400).json({ error: 'Operation head must be an active user' });
  }

  const members = memberIds.length
    ? await User.find({ _id: { $in: memberIds }, isActive: true, managerId: String(manager._id) })
    : [];

  if (members.length !== memberIds.length) {
    return res.status(400).json({ error: 'Members must be active users mapped under the selected manager' });
  }

  const team = await Team.create({
    name,
    description,
    manager: manager._id,
    operationHead: operationHead?._id,
    members: members.map((member) => member._id),
    createdBy: req.user?._id
  });

  const teamId = String(team._id);
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

  const affectedIds = [
    manager._id,
    operationHead?._id,
    ...members.map((member) => member._id)
  ].filter(Boolean);
  const affectedUsers = await User.find({ _id: { $in: affectedIds } });
  await Promise.allSettled(affectedUsers.map((user) => syncUserToCrm('update', user)));

  const populatedTeam = await Team.findById(team._id)
    .populate('manager', userSelect)
    .populate('operationHead', userSelect)
    .populate('members', userSelect);

  res.status(201).json({ ok: true, team: populatedTeam });
};
