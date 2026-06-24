const prisma = require('../../lib/prisma');

function sanitize(body) {
  const str = (v) => (v !== undefined && v !== '' && v !== null ? String(v).trim() : null);
  return {
    name:    String(body.name || '').trim(),
    phone:   str(body.phone),
    email:   str(body.email),
    details: str(body.details),
    status:  body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  };
}

async function getBrokers(req, res) {
  const { page = 1, limit = 15, search = '', status = '' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = {
    AND: [
      search ? {
        OR: [
          { broker_code: { contains: search } },
          { name:  { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
        ],
      } : {},
      status ? { status } : {},
    ],
  };
  const [brokers, total] = await Promise.all([
    prisma.broker.findMany({
      where, orderBy: { created_at: 'desc' }, skip, take: Number(limit),
      include: { _count: { select: { sales: true } } },
    }),
    prisma.broker.count({ where }),
  ]);
  res.json({ brokers, total, page: Number(page), limit: Number(limit) });
}

async function getBrokerById(req, res) {
  const b = await prisma.broker.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      sales: {
        orderBy: { created_at: 'desc' },
        take: 20,
        select: {
          id: true, sale_code: true, sale_date: true, status: true, actual_price: true,
          inventory: { select: { id: true, inventory_code: true, type: true, plot_no: true } },
          customer:  { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!b) return res.status(404).json({ message: 'Not found' });
  res.json(b);
}

async function createBroker(req, res) {
  if (!req.body.name?.trim()) return res.status(400).json({ message: 'Name is required' });
  const b = await prisma.broker.create({ data: sanitize(req.body) });
  const settings = await prisma.companySettings.findFirst();
  const prefix   = settings?.broker_prefix || 'BRK';
  const updated  = await prisma.broker.update({
    where: { id: b.id },
    data:  { broker_code: `${prefix}-${String(b.id).padStart(4, '0')}` },
  });
  res.status(201).json(updated);
}

async function updateBroker(req, res) {
  if (!req.body.name?.trim()) return res.status(400).json({ message: 'Name is required' });
  const b = await prisma.broker.update({
    where: { id: Number(req.params.id) },
    data:  sanitize(req.body),
  });
  res.json(b);
}

async function deleteBroker(req, res) {
  await prisma.broker.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: 'Deleted' });
}

module.exports = { getBrokers, getBrokerById, createBroker, updateBroker, deleteBroker };
