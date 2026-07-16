const prisma = require('../../lib/prisma');
const { auditLog, diff } = require('../../lib/audit');

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

  // Count purchases per broker name (purchases store broker as a plain name string, no FK)
  const names = brokers.map(b => b.name).filter(Boolean);
  let purchaseCountMap = {};
  if (names.length > 0) {
    const placeholders = names.map(() => '?').join(',');
    const rows = await prisma.$queryRawUnsafe(
      `SELECT b_name, COUNT(DISTINCT id) as cnt FROM (
         SELECT id, purchase_broker_name AS b_name FROM \`Purchase\` WHERE purchase_broker_name IN (${placeholders})
         UNION
         SELECT id, sell_broker_name     AS b_name FROM \`Purchase\` WHERE sell_broker_name     IN (${placeholders})
       ) t GROUP BY b_name`,
      ...names, ...names,
    );
    for (const r of rows) purchaseCountMap[r.b_name] = Number(r.cnt);
  }
  const enriched = brokers.map(b => ({ ...b, purchase_count: purchaseCountMap[b.name] || 0 }));

  res.json({ brokers: enriched, total, page: Number(page), limit: Number(limit) });
}

async function getBrokerById(req, res) {
  const id = Number(req.params.id);
  const b = await prisma.broker.findUnique({
    where: { id },
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

  // Purchases store broker as a plain name string, not a FK — match by name
  const purchases = await prisma.purchase.findMany({
    where: {
      OR: [
        { purchase_broker_name: b.name },
        { sell_broker_name:     b.name },
      ],
    },
    select: {
      id: true, purchase_code: true, location: true, type: true,
      purchase_price: true, status: true, created_at: true,
      purchase_broker_name: true, sell_broker_name: true,
    },
    orderBy: { created_at: 'desc' },
    take: 20,
  });

  res.json({ ...b, purchases });
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
  auditLog({ req, action: 'CREATE', entity: 'broker', entityId: updated.id, entityCode: updated.broker_code });
  res.status(201).json(updated);
}

async function updateBroker(req, res) {
  if (!req.body.name?.trim()) return res.status(400).json({ message: 'Name is required' });
  const id   = Number(req.params.id);
  const prev = await prisma.broker.findUnique({ where: { id } });
  const b    = await prisma.broker.update({ where: { id }, data: sanitize(req.body) });
  auditLog({ req, action: 'UPDATE', entity: 'broker', entityId: b.id, entityCode: b.broker_code, changes: diff(prev, b) });
  res.json(b);
}

async function deleteBroker(req, res) {
  const id = Number(req.params.id);
  const b  = await prisma.broker.findUnique({ where: { id } });
  if (!b) return res.status(404).json({ message: 'Not found' });

  const salesCount = await prisma.sale.count({ where: { broker_id: id } });
  if (salesCount > 0) {
    return res.status(409).json({ message: 'Cannot delete this broker — they have linked sales. Remove the linked data first.' });
  }

  const [purchaseRows] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(DISTINCT id) AS cnt FROM (
       SELECT id FROM \`Purchase\` WHERE purchase_broker_name = ?
       UNION
       SELECT id FROM \`Purchase\` WHERE sell_broker_name     = ?
     ) t`,
    b.name, b.name,
  );
  if (Number(purchaseRows.cnt) > 0) {
    return res.status(409).json({ message: 'Cannot delete this broker — they have linked purchases. Remove the linked data first.' });
  }

  await prisma.broker.delete({ where: { id } });
  auditLog({ req, action: 'DELETE', entity: 'broker', entityId: id, entityCode: b?.broker_code });
  res.json({ message: 'Deleted' });
}

module.exports = { getBrokers, getBrokerById, createBroker, updateBroker, deleteBroker };
