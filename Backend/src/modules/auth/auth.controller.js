const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const prisma  = require('../../lib/prisma');
const { resetLoginAttempts } = require('../../middleware/rateLimiter');
const { auditLog } = require('../../lib/audit');


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
    auditLog({ req, action: 'LOGIN_FAILED', entity: 'auth', userEmail: email });
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (user.status === 'INACTIVE') {
    auditLog({ req, action: 'LOGIN_FAILED', entity: 'auth', userId: user.id, userName: user.name, userEmail: user.email });
    return res.status(403).json({ message: 'Account is inactive' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    auditLog({ req, action: 'LOGIN_FAILED', entity: 'auth', userId: user.id, userName: user.name, userEmail: user.email });
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  resetLoginAttempts(req.ip || 'unknown');
  auditLog({ req, action: 'LOGIN', entity: 'auth', userId: user.id, userName: user.name, userEmail: user.email });

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
  auditLog({ req, action: 'PASSWORD_CHANGE', entity: 'auth', userId: req.user.id });
  res.json({ message: 'Password updated successfully' });
};

module.exports = {
  login,
  getMe,
  getProfile,
  updateProfile,
  changePassword,
};
