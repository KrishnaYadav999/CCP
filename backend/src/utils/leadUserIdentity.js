const mongoose = require('mongoose');

const PUBLIC_USER_FIELDS = 'name email role team crmUserId isActive';

function text(value) { return String(value || '').trim(); }

function inputIdentity(input, prefix) {
  const raw = input?.[prefix];
  const object = raw && typeof raw === 'object' ? raw : {};
  const rawId = text(raw);
  return {
    id: text(object._id || object.id || (/^[a-f\d]{24}$/i.test(rawId) && mongoose.Types.ObjectId.isValid(rawId) ? rawId : '')),
    crmUserId: text(object.crmUserId || input?.[`${prefix}CrmUserId`]),
    email: text(object.email || input?.[`${prefix}Email`]).toLowerCase(),
    name: text(object.name || input?.[`${prefix}Text`] || (prefix === 'assignedTo' ? input?.assignedToText : ''))
  };
}

async function resolveLeadUser(input, prefix, User, { activeOnly = true } = {}) {
  const identity = inputIdentity(input, prefix);
  let user = null;
  const active = activeOnly ? { isActive: true } : {};
  if (identity.id) user = await User.findOne({ _id: identity.id, ...active }).select(PUBLIC_USER_FIELDS).lean();
  if (!user && identity.crmUserId) user = await User.findOne({ crmUserId: identity.crmUserId, ...active }).select(PUBLIC_USER_FIELDS).lean();
  if (!user && identity.email) user = await User.findOne({ email: identity.email, ...active }).select(PUBLIC_USER_FIELDS).lean();
  if (!user && identity.name) {
    const matches = await User.find({ name: new RegExp(`^${identity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), ...active })
      .select(PUBLIC_USER_FIELDS).limit(2).lean();
    if (matches.length === 1) [user] = matches;
  }
  return { user, identity };
}

async function resolveImportedUser(identity, User) {
  const email = text(identity.email).toLowerCase();
  const name = text(identity.name);
  const crmUserId = text(identity.crmUserId);
  const id = mongoose.Types.ObjectId.isValid(text(identity.id)) ? text(identity.id) : '';
  let user = email ? await User.findOne({ email }).select(PUBLIC_USER_FIELDS).lean() : null;
  if (!user && name) {
    const matches = await User.find({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).select(PUBLIC_USER_FIELDS).limit(2).lean();
    if (matches.length === 1) [user] = matches;
  }
  if (!user && crmUserId) user = await User.findOne({ crmUserId }).select(PUBLIC_USER_FIELDS).lean();
  if (!user && id) user = await User.findOne({ _id: id }).select(PUBLIC_USER_FIELDS).lean();
  return user;
}

function userFields(prefix, user) {
  if (!user) return {};
  const textKey = prefix === 'assignedTo' ? 'assignedToText' : `${prefix}Text`;
  return {
    [prefix]: user._id,
    [textKey]: user.name || user.email || '',
    [`${prefix}Email`]: user.email || '',
    [`${prefix}CrmUserId`]: user.crmUserId || ''
  };
}

function publicUser(value, fallback = {}) {
  const user = value && typeof value === 'object' ? value : {};
  const id = text(user._id || user.id || fallback._id || fallback.id);
  const name = text(user.name || fallback.name);
  const email = text(user.email || fallback.email).toLowerCase();
  const crmUserId = text(user.crmUserId || fallback.crmUserId);
  if (!id && !name && !email && !crmUserId) return null;
  return { _id: id, name, email, role: text(user.role), team: text(user.team), crmUserId };
}

module.exports = { PUBLIC_USER_FIELDS, inputIdentity, resolveLeadUser, resolveImportedUser, userFields, publicUser };
