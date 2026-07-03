const { crmHeaders, getCrmBackendUrl, joinUrl, requestJson } = require('./crmHttp');

function notificationPayload(action, notification) {
  return {
    action,
    ccpNotificationId: notification.ccpNotificationId || String(notification._id),
    crmNotificationId: notification.crmNotificationId || '',
    title: notification.title || '',
    description: notification.description || '',
    tag: notification.tag || '',
    status: notification.status || 'Active',
    kind: notification.kind || 'announcement',
    createdByName: notification.createdByName || '',
    audience: (notification.audience || []).map((id) => String(id)),
    visibleToRoles: notification.visibleToRoles || [],
    attachmentName: notification.attachmentName || '',
    attachmentUrl: notification.attachmentUrl || '',
    pinned: Boolean(notification.pinned),
    metadata: notification.metadata || {},
    source: 'ccp'
  };
}

async function syncNotificationToCrm(action, notification) {
  const baseUrl = getCrmBackendUrl();
  if (!baseUrl) return { skipped: true, reason: 'CRM_BACKEND_URL not configured' };

  const response = await requestJson(joinUrl(baseUrl, '/notifications/ccp/sync'), {
    method: 'POST',
    payload: notificationPayload(action, notification),
    headers: crmHeaders()
  });

  const crmNotificationId = response.data?.crmNotificationId || response.data?.notification?.crmNotificationId || response.data?.notification?._id;
  if (crmNotificationId && !notification.crmNotificationId) {
    notification.crmNotificationId = String(crmNotificationId);
    await notification.save();
  }

  return { ok: true, statusCode: response.statusCode, data: response.data };
}

module.exports = { syncNotificationToCrm };
