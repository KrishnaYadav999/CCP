const nodemailer = require('nodemailer');

const mailUser = process.env.SMTP_USER || process.env.MAIL_USER;
const mailPass = process.env.SMTP_PASS || process.env.MAIL_PASS;
const smtpHost = process.env.SMTP_HOST;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: mailUser && mailPass ? { user: mailUser, pass: mailPass } : undefined,
  requireTLS: process.env.SMTP_SECURE !== 'true',
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000
});

async function sendMail(to, subject, html) {
  if (!smtpHost || !mailUser || !mailPass) {
    const error = new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, MAIL_USER/SMTP_USER, MAIL_PASS/SMTP_PASS and MAIL_FROM.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const from = process.env.MAIL_FROM || mailUser;
  const info = await transporter.sendMail({ from, to, subject, html });
  return info;
}

module.exports = { sendMail };
