const nodemailer = require('nodemailer');

const mailUser = process.env.SMTP_USER || process.env.MAIL_USER;
const mailPass = process.env.SMTP_PASS || process.env.MAIL_PASS;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: mailUser && mailPass ? { user: mailUser, pass: mailPass } : undefined
});

async function sendMail(to, subject, html) {
  const from = process.env.MAIL_FROM || mailUser;
  const info = await transporter.sendMail({ from, to, subject, html });
  return info;
}

module.exports = { sendMail };
