const Notification = require('../models/Notification');
const { syncNotificationToCrm } = require('../utils/crmNotificationSync');

function normalizeIds(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function notificationIsVisible(notification, user) {
  const role = String(user.role || '');
  const userId = String(user._id || user.id || '');
  if (['admin', 'superadmin'].includes(role)) return true;
  if (notification.kind === 'announcement') return true;
  if ((notification.audience || []).some((id) => String(id) === userId)) return true;
  if ((notification.visibleToRoles || []).includes(role)) return true;
  return false;
}

function isUnread(notification, user) {
  const userId = String(user._id || user.id || '');
  return !(notification.readBy || []).some((id) => String(id) === userId);
}

function countsForBell(notification, user) {
  if (notification.status !== 'Active') return false;
  if (!notificationIsVisible(notification, user)) return false;
  if (notification.pinned && notification.kind === 'announcement') return true;
  if (['todo', 'follow-up'].includes(notification.kind)) return true;
  return isUnread(notification, user);
}

function publicNotification(notification) {
  const id = String(notification._id);
  return {
    id,
    _id: id,
    title: notification.title,
    description: notification.description,
    tag: notification.tag,
    status: notification.status,
    kind: notification.kind,
    createdByName: notification.createdByName,
    createdBy: notification.createdBy,
    audience: notification.audience,
    visibleToRoles: notification.visibleToRoles,
    attachmentName: notification.attachmentName,
    attachmentUrl: notification.attachmentUrl,
    pinned: notification.pinned,
    metadata: notification.metadata,
    readBy: notification.readBy,
    crmNotificationId: notification.crmNotificationId,
    ccpNotificationId: notification.ccpNotificationId || id,
    source: notification.source,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt
  };
}

function readNotificationBody(body, user) {
  return {
    title: String(body.title || '').trim(),
    description: String(body.description || '').trim(),
    tag: String(body.tag || '').trim(),
    status: String(body.status || 'Active').trim() || 'Active',
    kind: String(body.kind || 'announcement').trim() || 'announcement',
    createdByName: String(body.createdByName || user?.name || user?.email || 'CCP Admin').trim(),
    audience: normalizeIds(body.audience),
    visibleToRoles: normalizeIds(body.visibleToRoles),
    attachmentName: String(body.attachmentName || '').trim(),
    attachmentUrl: String(body.attachmentUrl || '').trim(),
    pinned: Boolean(body.pinned),
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    source: String(body.source || 'ccp').trim() || 'ccp'
  };
}

exports.listNotifications = async (req, res) => {
  let notifications = [];
  try {
    notifications = await Notification.find({ status: 'Active' }).sort({ pinned: -1, createdAt: -1 }).limit(100);
  } catch (err) {
    console.error('Notification list failed', err);
    return res.json({ ok: true, notifications: [], unreadCount: 0 });
  }

  const visible = notifications.filter((notification) => notificationIsVisible(notification, req.user));
  const unreadCount = visible.filter((notification) => countsForBell(notification, req.user)).length;
  res.json({
    ok: true,
    notifications: visible.map(publicNotification),
    unreadCount
  });
};

exports.createNotification = async (req, res) => {
  const data = readNotificationBody(req.body, req.user);
  if (!data.title) return res.status(400).json({ error: 'Notification title is required' });

  const notification = new Notification({
    ...data,
    createdBy: req.user?._id,
    source: 'ccp'
  });
  notification.ccpNotificationId = String(notification._id);
  await notification.save();

  let crmSync = { ok: true };
  try {
    crmSync = await syncNotificationToCrm('create', notification);
  } catch (err) {
    console.error('CRM notification create sync failed', err.message);
    crmSync = { ok: false, error: err.message };
  }

  res.status(201).json({ ok: true, notification: publicNotification(notification), crmSync });
};

exports.updateNotification = async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });

  const data = readNotificationBody(req.body, req.user);
  if (!data.title) return res.status(400).json({ error: 'Notification title is required' });

  Object.assign(notification, data);
  notification.ccpNotificationId = notification.ccpNotificationId || String(notification._id);
  notification.source = notification.source || 'ccp';
  await notification.save();

  let crmSync = { ok: true };
  try {
    crmSync = await syncNotificationToCrm('update', notification);
  } catch (err) {
    console.error('CRM notification update sync failed', err.message);
    crmSync = { ok: false, error: err.message };
  }

  res.json({ ok: true, notification: publicNotification(notification), crmSync });
};

exports.markRead = async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  if (!notificationIsVisible(notification, req.user)) return res.status(403).json({ error: 'Notification is not visible to this user' });

  await Notification.updateOne({ _id: notification._id }, { $addToSet: { readBy: req.user._id } });
  const updated = await Notification.findById(notification._id);
  res.json({ ok: true, notification: publicNotification(updated) });
};

exports.markAllRead = async (req, res) => {
  const notifications = await Notification.find({ status: 'Active' }).select('_id kind audience visibleToRoles status');
  const visibleIds = notifications
    .filter((notification) => notificationIsVisible(notification, req.user))
    .map((notification) => notification._id);

  if (visibleIds.length) {
    await Notification.updateMany({ _id: { $in: visibleIds } }, { $addToSet: { readBy: req.user._id } });
  }

  res.json({ ok: true, marked: visibleIds.length });
};
