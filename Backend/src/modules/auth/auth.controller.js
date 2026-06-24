const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const prisma  = require('../../lib/prisma');
const { sendMailCritical, isSmtpConfigured } = require('../../lib/mailer');
const { forgotPassword: forgotPasswordTemplate } = require('../../lib/emailTemplates');
const { resetLoginAttempts } = require('../../middleware/rateLimiter');


const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: { select: { name: true, slug: true } },
    },
  });

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (user.status === 'INACTIVE') {
    return res.status(403).json({ message: 'Account is inactive' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  resetLoginAttempts(req.ip || 'unknown');

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role.slug },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const { password: _, ...userWithoutPassword } = user;
  return res.status(200).json({ message: 'Login successful', token, user: userWithoutPassword });
};

const getMe = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, name: true, email: true,
      role: {
        select: {
          id: true, name: true, slug: true, is_system: true,
          rolePermissions: {
            where: { allowed: true },
            select: { permission: { select: { code: true } } },
          },
        },
      },
    },
  });

  if (!user) return res.status(404).json({ message: 'User not found' });

  const permissions = user.role.rolePermissions.map((rp) => rp.permission.code);
  res.json({ ...user, is_system: user.role.is_system, permissions });
};

const getProfile = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, name: true, email: true, phone: true,
      status: true, is_verified: true, created_at: true,
      role: {
        select: {
          id: true, name: true, slug: true, is_system: true,
          rolePermissions: {
            where: { allowed: true },
            select: { permission: { select: { code: true, action: true, module: { select: { name: true } } } } },
          },
        },
      },
    },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const permsByModule = {};
  if (user.role.is_system) {
    permsByModule['_system'] = ['Full access — all permissions granted'];
  } else {
    user.role.rolePermissions.forEach(({ permission: p }) => {
      const mod = p.module.name;
      if (!permsByModule[mod]) permsByModule[mod] = [];
      permsByModule[mod].push(p.action);
    });
  }

  res.json({ ...user, permsByModule });
};

const updateProfile = async (req, res) => {
  const { name, email, phone } = req.body;
  const id = req.user.id;

  if (email) {
    const taken = await prisma.user.findFirst({ where: { email, NOT: { id } } });
    if (taken) return res.status(409).json({ message: 'Email already in use' });
  }
  if (phone) {
    const taken = await prisma.user.findFirst({ where: { phone, NOT: { id } } });
    if (taken) return res.status(409).json({ message: 'Phone already in use' });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name  ? { name }  : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    },
    select: { id: true, name: true, email: true, phone: true },
  });
  res.json(user);
};

const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'current_password and new_password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const match = await bcrypt.compare(current_password, user.password);
  if (!match) return res.status(400).json({ message: 'Current password is incorrect' });

  const hashed = await bcrypt.hash(new_password, 10);
  await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
  res.json({ message: 'Password updated successfully' });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  }

  await prisma.passwordResetToken.updateMany({
    where: { user_id: user.id, used: false },
    data:  { used: true },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { user_id: user.id, token, expires_at: expiresAt },
  });

  const frontendOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
  const resetUrl = `${frontendOrigin}/reset-password?token=${token}`;

  const smtpReady = await isSmtpConfigured();
  if (!smtpReady) {
    console.warn('[ForgotPassword] SMTP not configured. Reset URL:', resetUrl);
    return res.json({
      message: 'Password reset link generated but email could not be sent — SMTP is not configured. Please contact your administrator.',
      dev_reset_url: process.env.NODE_ENV !== 'production' ? resetUrl : undefined,
    });
  }

  const mail = await forgotPasswordTemplate({ to: user.email, userName: user.name, resetUrl });
  const result = await sendMailCritical(mail);

  if (result?.skipped) {
    console.warn('[ForgotPassword] Email skipped:', result.reason, '| Reset URL:', resetUrl);
    return res.json({
      message: 'Password reset link generated but email could not be sent. Please contact your administrator.',
    });
  }

  res.json({ message: 'If that email exists, a reset link has been sent.' });
};

const resetPassword = async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ message: 'Token and new_password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.used || new Date() > new Date(record.expires_at)) {
    return res.status(400).json({ message: 'Reset link is invalid or has expired. Please request a new one.' });
  }

  const hashed = await bcrypt.hash(new_password, 10);
  await prisma.user.update({ where: { id: record.user_id }, data: { password: hashed } });
  await prisma.passwordResetToken.update({ where: { token }, data: { used: true } });

  res.json({ message: 'Password reset successfully. You can now log in.' });
};

module.exports = {
  login,
  getMe,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};
