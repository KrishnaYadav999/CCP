const PendingApproval = require('../models/PendingApproval');
const User = require('../models/User');
const { ADMIN_ROLES } = require('../constants/roles');
const { sendMail } = require('./mailer');

const DEFAULT_INTERVAL_MINUTES = 10;
let timer = null;
let running = false;

function isPendingApprovalEmailsEnabled() {
  return process.env.PENDING_APPROVAL_EMAILS_ENABLED === 'true';
}

function getDigestIntervalMs() {
  const minutes = Number(process.env.PENDING_APPROVAL_DIGEST_MINUTES) || DEFAULT_INTERVAL_MINUTES;
  return Math.max(1, minutes) * 60 * 1000;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getAdminEmails() {
  const users = await User.find({ role: { $in: ADMIN_ROLES }, isActive: true })
    .select('email')
    .lean();
  const emails = users.map((user) => user.email);
  if (process.env.ADMIN_EMAIL) emails.push(process.env.ADMIN_EMAIL);
  return [...new Set(emails.map((email) => String(email || '').toLowerCase().trim()).filter(Boolean))];
}

function buildDigestHtml(records) {
  const rows = records.map((record, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(record.clientName || 'Unnamed client')}</td>
      <td>${escapeHtml(record.uniqueId || record.sourceClientId || '')}</td>
      <td>${escapeHtml(record.piboCategory || '')}</td>
      <td>${escapeHtml(record.eprCategory || '')}</td>
      <td>${escapeHtml(record.createdByName || '')}</td>
      <td>${escapeHtml([record.requestDate, record.requestTime].filter(Boolean).join(' '))}</td>
    </tr>
  `).join('');

  return `
    <p>The following CCP clients are still pending approval:</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
      <thead>
        <tr>
          <th>#</th>
          <th>Client</th>
          <th>Unique ID</th>
          <th>PIBO</th>
          <th>EPR</th>
          <th>Created By</th>
          <th>Requested At</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function sendPendingApprovalDigest() {
  if (!isPendingApprovalEmailsEnabled()) {
    return { skipped: true, reason: 'Pending approval emails disabled' };
  }

  if (running) return { skipped: true, reason: 'Digest already running' };
  running = true;

  try {
    const now = new Date();
    const dueRecords = await PendingApproval.find({
      type: 'client',
      source: 'ccp',
      approvalStatus: 'PENDING',
      $or: [
        { nextReminderAt: { $exists: false } },
        { nextReminderAt: null },
        { nextReminderAt: { $lte: now } }
      ]
    }).sort({ createdAt: 1 }).limit(100).lean();

    if (!dueRecords.length) return { ok: true, sent: false, count: 0 };

    const recipients = await getAdminEmails();
    if (!recipients.length) {
      await PendingApproval.updateMany(
        { _id: { $in: dueRecords.map((record) => record._id) } },
        { $set: { reminderError: 'No admin recipients configured', nextReminderAt: new Date(Date.now() + getDigestIntervalMs()) } }
      );
      return { ok: false, sent: false, count: dueRecords.length, error: 'No admin recipients configured' };
    }

    await sendMail(
      recipients.join(','),
      `CCP Pending Client Approval Digest (${dueRecords.length})`,
      buildDigestHtml(dueRecords)
    );

    await PendingApproval.updateMany(
      { _id: { $in: dueRecords.map((record) => record._id) } },
      {
        $set: {
          lastReminderAt: now,
          nextReminderAt: new Date(Date.now() + getDigestIntervalMs()),
          reminderError: '',
          notifiedAdminEmails: recipients
        },
        $inc: { reminderCount: 1 }
      }
    );

    return { ok: true, sent: true, count: dueRecords.length };
  } catch (err) {
    console.error('Pending approval digest failed', err.message);
    return { ok: false, sent: false, error: err.message };
  } finally {
    running = false;
  }
}

function startPendingApprovalDigest() {
  if (!isPendingApprovalEmailsEnabled()) {
    return null;
  }

  if (timer) return timer;

  const intervalMs = getDigestIntervalMs();
  timer = setInterval(() => {
    sendPendingApprovalDigest();
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  setTimeout(() => {
    sendPendingApprovalDigest();
  }, 5000).unref?.();

  return timer;
}

module.exports = {
  isPendingApprovalEmailsEnabled,
  sendPendingApprovalDigest,
  startPendingApprovalDigest
};
