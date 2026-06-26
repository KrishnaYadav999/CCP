const mongoose = require('mongoose');
const { ADMIN_ROLES } = require('../constants/roles');
const User = require('../models/User');

const FULL_ACCESS_ROLES = [...ADMIN_ROLES];
const TEAM_ACCESS_ROLES = ['manager', 'operation'];

function hasFullAccess(user) {
  return Boolean(user && FULL_ACCESS_ROLES.includes(user.role));
}

function uniqueObjectIds(ids) {
  const values = ids
    .filter(Boolean)
    .map((id) => String(id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  return [...new Set(values)].map((id) => new mongoose.Types.ObjectId(id));
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueStrings(values) {
  return [...new Set(values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean))];
}

function buildUserIdentityTerms(users) {
  const identities = uniqueStrings(users.flatMap((user) => [
    user._id,
    user.email,
    user.crmUserId,
    user.name
  ]));

  return identities.map((value) => new RegExp(`^${escapeRegex(value)}$`, 'i'));
}

async function getVisibleUsers(user) {
  if (!user) return [];
  if (hasFullAccess(user)) return null;

  const ownId = user._id;
  const users = [user];

  if (TEAM_ACCESS_ROLES.includes(user.role)) {
    const managerKeys = [String(ownId), user.email];
    if (user.crmUserId) managerKeys.push(String(user.crmUserId));

    const teamIds = uniqueStrings([user.teamId]);
    const subordinateQuery = {
      isActive: true,
      $or: [
        { managerId: { $in: managerKeys } },
        { operationHeadId: { $in: managerKeys } },
        ...(teamIds.length ? [{ teamId: { $in: teamIds } }] : [])
      ]
    };

    const subordinates = await User.find(subordinateQuery)
      .select('_id name email crmUserId role team teamId managerId operationHeadId')
      .lean();
    users.push(...subordinates);
  }

  return users;
}

async function getVisibleUserIds(user) {
  const users = await getVisibleUsers(user);
  if (users === null) return null;
  return uniqueObjectIds(users.map((visibleUser) => visibleUser._id));
}

async function buildLeadVisibilityQuery(user) {
  const visibleUsers = await getVisibleUsers(user);
  if (visibleUsers === null) return {};

  const visibleUserIds = uniqueObjectIds(visibleUsers.map((visibleUser) => visibleUser._id));
  const identityTerms = buildUserIdentityTerms(visibleUsers);
  const emailValues = uniqueStrings(visibleUsers.map((visibleUser) => visibleUser.email));
  const crmUserIds = uniqueStrings(visibleUsers.map((visibleUser) => visibleUser.crmUserId));
  const ccpUserIds = uniqueStrings(visibleUsers.map((visibleUser) => visibleUser._id));

  return { $or: [
    { createdBy: { $in: visibleUserIds } },
    { assignedTo: { $in: visibleUserIds } },
    { ccpUserId: { $in: ccpUserIds } },
    { createdByEmail: { $in: emailValues } },
    { createdByCrmUserId: { $in: crmUserIds } },
    { assignedToEmail: { $in: emailValues } },
    { assignedToCrmUserId: { $in: crmUserIds } },
    { 'assignedTo.ccpUserId': { $in: ccpUserIds } },
    { 'assignedTo.crmUserId': { $in: crmUserIds } },
    { 'assignedTo.email': { $in: emailValues } },
    { 'assignedTo.name': { $in: identityTerms } },
    { assignedToText: { $in: identityTerms } },
    { importedCreatedBy: { $in: identityTerms } }
  ] };
}

async function buildClientVisibilityQuery(user) {
  const visibleUsers = await getVisibleUsers(user);
  if (visibleUsers === null) return {};

  const visibleUserIds = uniqueObjectIds(visibleUsers.map((visibleUser) => visibleUser._id));
  const identityTerms = buildUserIdentityTerms(visibleUsers);
  const emailValues = uniqueStrings(visibleUsers.map((visibleUser) => visibleUser.email));
  const crmUserIds = uniqueStrings(visibleUsers.map((visibleUser) => visibleUser.crmUserId));
  const ccpUserIds = uniqueStrings(visibleUsers.map((visibleUser) => visibleUser._id));

  return { $or: [
    { createdBy: { $in: visibleUserIds } },
    { 'adminControls.assignedTo': { $in: visibleUserIds } },
    { ccpUserId: { $in: ccpUserIds } },
    { createdByEmail: { $in: emailValues } },
    { createdByCrmUserId: { $in: crmUserIds } },
    { 'adminControls.assignedToEmail': { $in: emailValues } },
    { 'adminControls.assignedToCrmUserId': { $in: crmUserIds } },
    { 'adminControls.assignedTo.ccpUserId': { $in: ccpUserIds } },
    { 'adminControls.assignedTo.crmUserId': { $in: crmUserIds } },
    { 'adminControls.assignedTo.email': { $in: emailValues } },
    { 'adminControls.assignedTo.name': { $in: identityTerms } },
    { 'adminControls.assignedToText': { $in: identityTerms } },
    { createdByName: { $in: identityTerms } }
  ] };
}

module.exports = {
  hasFullAccess,
  getVisibleUsers,
  getVisibleUserIds,
  buildLeadVisibilityQuery,
  buildClientVisibilityQuery
};
