const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendMail } = require('../utils/mailer');
const { syncUserToCrm } = require('../utils/crmUserSync');
const { ROLES } = require('../constants/roles');
const { getVisibleUserIds, hasFullAccess } = require('../utils/visibilityScope');

function readOptionalId(value) {
  const raw = String(value || '').trim();
  return raw || undefined;
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function findPasswordValidatedUser(email, password) {
  if (!email) {
    const error = new Error('Email required');
    error.statusCode = 400;
    throw error;
  }
  if (!password) {
    const error = new Error('Password required');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error('User not found. Contact admin.');
    error.statusCode = 404;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error('Your account is inactive. Contact admin.');
    error.statusCode = 403;
    throw error;
  }

  if (user.password) {
    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }
  } else {
    if (password.length < 8) {
      const error = new Error('Password must be at least 8 characters');
      error.statusCode = 400;
      throw error;
    }
    user.password = await bcrypt.hash(password, 10);
  }

  return user;
}

async function issueOtp(user) {
  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  const otpIssuedAt = new Date();
  const update = {
    otp,
    otpExpires,
    otpIssuedAt
  };

  if (user.isModified?.('password')) update.password = user.password;

  const result = await User.updateOne(
    { _id: user._id },
    { $set: update },
    { runValidators: false }
  );

  if (!result.matchedCount) {
    const error = new Error('Unable to save OTP. User not found.');
    error.statusCode = 404;
    throw error;
  }

  user.otp = otp;
  user.otpExpires = otpExpires;
  user.otpIssuedAt = otpIssuedAt;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px">Your CCP login OTP</h2>
      <p>Your secure one-time password is:</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:4px;margin:18px 0">${otp}</p>
      <p>This OTP expires in 10 minutes.</p>
    </div>
  `;

  try {
    await sendMail(user.email, 'Your CCP Login OTP', html);
  } catch (err) {
    console.error('Mail error', {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Development OTP for ${user.email}: ${otp}`);
      return {
        ok: true,
        message: 'OTP generated. SMTP failed in development, so use the displayed development OTP.',
        devOtp: otp
      };
    }

    const error = new Error(`Unable to send OTP email: ${err.message}`);
    error.statusCode = 502;
    throw error;
  }

  return { ok: true, message: 'OTP sent successfully' };
}

function readAvatarUrl(value) {
  if (value === undefined || value === null || value === '') return '';

  const avatarUrl = String(value);
  const isImageDataUrl = /^data:image\/(png|jpe?g|webp);base64,/i.test(avatarUrl);
  if (!isImageDataUrl) {
    const error = new Error('Profile image must be PNG, JPG, JPEG, or WEBP');
    error.statusCode = 400;
    throw error;
  }

  const sizeInBytes = Math.ceil((avatarUrl.length * 3) / 4);
  if (sizeInBytes > 2 * 1024 * 1024) {
    const error = new Error('Profile image must be under 2MB');
    error.statusCode = 400;
    throw error;
  }

  return avatarUrl;
}

exports.requestOtp = async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  try {
    const user = await findPasswordValidatedUser(email, password);
    const result = await issueOtp(user);
    return res.json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Unable to send OTP' });
  }
};

exports.resendOtp = async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  try {
    const user = await findPasswordValidatedUser(email, password);
    const result = await issueOtp(user);
    return res.json({ ...result, message: result.devOtp ? result.message : 'OTP resent successfully' });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Unable to resend OTP' });
  }
};

exports.verifyOtp = async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const otp = String(req.body.otp || '').trim();
  if (!email || !password || !otp) return res.status(400).json({ error: 'Email, password and otp required' });
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.isActive) return res.status(403).json({ error: 'Your account is inactive. Contact admin.' });
  if (!user.password) return res.status(400).json({ error: 'Password is not set. Contact admin.' });

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) return res.status(401).json({ error: 'Invalid email or password' });

  if (!user.otp || user.otp !== otp) return res.status(400).json({ error: 'Invalid otp' });
  if (user.otpExpires < Date.now()) return res.status(400).json({ error: 'OTP expired' });

  // clear otp
  user.otp = undefined;
  user.otpExpires = undefined;
  user.otpIssuedAt = undefined;
  user.lastLogin = new Date();
  await user.save();

  const token = jwt.sign({ sub: user._id, role: user.role, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
  res.json({ ok: true, token, user: publicUser(user) });
};

exports.createUserByAdmin = async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const role = String(req.body.role || '').trim();
  const team = String(req.body.team || 'No team assigned').trim();
  const teamId = String(req.body.teamId || '').trim();
  const managerId = readOptionalId(req.body.managerId);
  const operationHeadId = readOptionalId(req.body.operationHeadId);
  const isActive = req.body.isActive === undefined ? true : Boolean(req.body.isActive);
  let avatarUrl = '';

  try {
    avatarUrl = readAvatarUrl(req.body.avatarUrl);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  if (!email || !role) return res.status(400).json({ error: 'Email and role required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  let existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ error: 'User already exists' });
  const user = new User({
    name,
    email,
    password: await bcrypt.hash(password, 10),
    role,
    team,
    teamId,
    managerId,
    operationHeadId,
    isActive,
    avatarUrl,
    source: 'ccp',
    createdBy: req.user?._id
  });
  user.ccpUserId = String(user._id);
  await user.save();

  let crmSync = { ok: true };
  try {
    crmSync = await syncUserToCrm('create', user, { password });
  } catch (err) {
    console.error('CRM user create sync failed', err.message);
    crmSync = { ok: false, error: err.message };
  }

  res.status(201).json({ ok: true, user: publicUser(user), crmSync });
};

exports.updateUserByAdmin = async (req, res) => {
  const userId = req.params.id;
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').toLowerCase().trim();
  const role = String(req.body.role || '').trim();
  const team = String(req.body.team || 'No team assigned').trim();
  const teamId = String(req.body.teamId || '').trim();
  const managerId = readOptionalId(req.body.managerId);
  const operationHeadId = readOptionalId(req.body.operationHeadId);
  const isActive = req.body.isActive === undefined ? true : Boolean(req.body.isActive);
  let avatarUrl;

  try {
    if (req.body.avatarUrl !== undefined) avatarUrl = readAvatarUrl(req.body.avatarUrl);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  if (!email || !role) return res.status(400).json({ error: 'Email and role required' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const duplicate = await User.findOne({ email, _id: { $ne: userId } });
  if (duplicate) return res.status(400).json({ error: 'Email already exists' });

  user.name = name;
  user.email = email;
  user.role = role;
  user.team = team;
  user.teamId = teamId;
  user.managerId = managerId;
  user.operationHeadId = operationHeadId;
  user.isActive = isActive;
  if (req.body.avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  user.ccpUserId = user.ccpUserId || String(user._id);
  user.source = user.source || 'ccp';
  await user.save();

  let crmSync = { ok: true };
  try {
    crmSync = await syncUserToCrm('update', user);
  } catch (err) {
    console.error('CRM user update sync failed', err.message);
    crmSync = { ok: false, error: err.message };
  }

  res.json({ ok: true, user: publicUser(user), crmSync });
};

exports.me = async (req, res) => {
  res.json({ ok: true, user: publicUser(req.user) });
};

exports.updateMe = async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').toLowerCase().trim();
  let avatarUrl;

  try {
    avatarUrl = readAvatarUrl(req.body.avatarUrl);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  if (!email) return res.status(400).json({ error: 'Email required' });

  const duplicate = await User.findOne({ email, _id: { $ne: req.user._id } });
  if (duplicate) return res.status(400).json({ error: 'Email already exists' });

  req.user.name = name;
  req.user.email = email;
  if (req.body.avatarUrl !== undefined) req.user.avatarUrl = avatarUrl;
  await req.user.save();

  res.json({ ok: true, user: publicUser(req.user) });
};

exports.updatePassword = async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  const confirmPassword = String(req.body.confirmPassword || '');

  if (!newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'New password and confirmation are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Password confirmation does not match' });
  }

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.password) {
    if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) return res.status(400).json({ error: 'Current password is incorrect' });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ ok: true, message: 'Password updated successfully' });
};

exports.listUsers = async (req, res) => {
  const users = await User.find().select('-otp -otpExpires -otpIssuedAt -password').sort({ createdAt: -1 });
  res.json({ ok: true, users });
};

exports.listAssignableUsers = async (req, res) => {
  const query = { isActive: true };
  if (!hasFullAccess(req.user)) {
    const visibleUserIds = await getVisibleUserIds(req.user);
    query._id = { $in: visibleUserIds };
  }

  const users = await User.find(query)
    .select('name email crmUserId ccpUserId source avatarUrl role team teamId managerId operationHeadId isActive createdAt updatedAt')
    .sort({ name: 1, email: 1 });
  res.json({ ok: true, users });
};

function publicUser(user) {
  return {
    id: user._id,
    crmUserId: user.crmUserId,
    ccpUserId: user.ccpUserId || String(user._id),
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
