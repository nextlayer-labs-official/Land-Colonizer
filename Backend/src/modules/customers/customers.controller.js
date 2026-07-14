const prisma = require('../../lib/prisma');
const { auditLog, diff } = require('../../lib/audit');

function sanitize(body) {
  const str = (v) => (v !== undefined && v !== '' && v !== null ? String(v).trim() : null);
  return {
    name:    String(body.name || '').trim(),
    phone:   str(body.phone),
    email:   str(body.email),
    address: str(body.address),
    type:    body.type === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL',
    pan:     str(body.pan),
    aadhaar: str(body.aadhaar),
    other:   str(body.other),
    status:  body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  };
}

async function getCustomers(req, res) {
  const { page = 1, limit = 15, search = '', status = '' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    AND: [
      search ? {
        OR: [
          { customer_code: { contains: search } },
          { name:    { contains: search } },
          { phone:   { contains: search } },
          { email:   { contains: search } },
          { pan:     { contains: search } },
          { aadhaar: { contains: search } },
        ],
      } : {},
      status ? { status } : {},
    ],
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: Number(limit),
      include: { _count: { select: { sales: true } } },
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({ customers, total, page: Number(page), limit: Number(limit) });
}

async function getCustomerById(req, res) {
  const c = await prisma.customer.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      sales: {
        orderBy: { created_at: 'desc' },
        take: 10,
        select: {
          id: true, sale_code: true, sale_date: true, actual_price: true, status: true, created_at: true,
          inventory: { select: { id: true, inventory_code: true, plot_no: true, sl_no: true, location: true, type: true } },
        },
      },
    },
  });
  if (!c) return res.status(404).json({ message: 'Not found' });
  res.json(c);
}

async function createCustomer(req, res) {
  if (!req.body.name?.trim()) return res.status(400).json({ message: 'Name is required' });
  const c = await prisma.customer.create({ data: sanitize(req.body) });
  const settings = await prisma.companySettings.findFirst();
  const prefix   = settings?.customer_prefix || 'CUS';
  const updated  = await prisma.customer.update({
    where: { id: c.id },
    data:  { customer_code: `${prefix}-${String(c.id).padStart(4, '0')}` },
  });
  auditLog({ req, action: 'CREATE', entity: 'customer', entityId: updated.id, entityCode: updated.customer_code });
  res.status(201).json(updated);
}

async function updateCustomer(req, res) {
  if (!req.body.name?.trim()) return res.status(400).json({ message: 'Name is required' });
  const id   = Number(req.params.id);
  const prev = await prisma.customer.findUnique({ where: { id } });
  const c    = await prisma.customer.update({ where: { id }, data: sanitize(req.body) });
  auditLog({ req, action: 'UPDATE', entity: 'customer', entityId: c.id, entityCode: c.customer_code, changes: diff(prev, c) });
  res.json(c);
}

async function deleteCustomer(req, res) {
  const id = Number(req.params.id);
  const c  = await prisma.customer.findUnique({ where: { id } });
  const [salesCount, bookingsCount] = await Promise.all([
    prisma.sale.count({ where: { customer_id: id } }),
    prisma.saleBooking.count({ where: { customer_id: id } }),
  ]);
  if (salesCount > 0 || bookingsCount > 0) {
    return res.status(409).json({ message: 'Cannot delete this customer — they have linked sales or bookings. Remove the linked data first.' });
  }
  await prisma.customer.delete({ where: { id } });
  auditLog({ req, action: 'DELETE', entity: 'customer', entityId: id, entityCode: c?.customer_code });
  res.json({ message: 'Deleted' });
}

module.exports = { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer };
