const bcrypt = require('bcrypt');
const prisma  = require('../../lib/prisma');
const { auditLog, diff } = require('../../lib/audit');

const userSelect = {
  id: true, name: true, email: true, phone: true,
  status: true, is_verified: true, created_at: true, updated_at: true,
  role: { select: { id: true, name: true, slug: true } },
};

const getUsers = async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = search
    ? { OR: [{ name: { contains: search } }, { email: { contains: search } }, { phone: { contains: search } }] }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, select: userSelect, skip, take: Number(limit), orderBy: { created_at: 'desc' } }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) });
};

const getUserById = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.params.id) },
    select: userSelect,
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};

const createUser = async (req, res) => {
  const { name, email, phone, password, role_id, status } = req.body;

  if (!name || !email || !phone || !password || !role_id) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
  if (existing) {
    const field = existing.email === email ? 'Email' : 'Phone';
    return res.status(409).json({ message: `${field} is already in use` });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, phone, password: hashed, role_id: Number(role_id), status: status || 'ACTIVE' },
    select: userSelect,
  });
  auditLog({ req, action: 'CREATE', entity: 'user', entityId: user.id, entityCode: user.email });
  res.status(201).json(user);
};

const updateUser = async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, phone, role_id, status, is_verified } = req.body;

  const exists = await prisma.user.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ message: 'User not found' });

  if (email && email !== exists.email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) return res.status(409).json({ message: 'Email is already in use' });
  }
  if (phone && phone !== exists.phone) {
    const taken = await prisma.user.findUnique({ where: { phone } });
    if (taken) return res.status(409).json({ message: 'Phone is already in use' });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name        && { name }),
      ...(email       && { email }),
      ...(phone       && { phone }),
      ...(role_id     && { role_id: Number(role_id) }),
      ...(status      && { status }),
      ...(is_verified !== undefined && { is_verified }),
    },
    select: userSelect,
  });
  auditLog({ req, action: 'UPDATE', entity: 'user', entityId: id, entityCode: user.email,
    changes: diff({ name: exists.name, email: exists.email, phone: exists.phone, status: exists.status }, user) });
  res.json(user);
};

const deleteUser = async (req, res) => {
  const id = Number(req.params.id);
  const exists = await prisma.user.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ message: 'User not found' });
  await prisma.user.delete({ where: { id } });
  auditLog({ req, action: 'DELETE', entity: 'user', entityId: id, entityCode: exists.email });
  res.json({ message: 'User deleted successfully' });
};

module.exports = { getUsers, getUserById, createUser, updateUser, deleteUser };
