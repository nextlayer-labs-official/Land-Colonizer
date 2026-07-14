const prisma = require('../../lib/prisma');
const { auditLog, diff } = require('../../lib/audit');

async function getPrefix() {
  const s = await prisma.companySettings.findFirst();
  return s?.inventory_prefix || 'INV';
}

// Compute status from linked active sales
function computeStatus(sales = []) {
  const active = sales.filter(s => s.status !== 'INACTIVE');
  if (active.length === 0) return 'AVAILABLE';
  const sale = active[0]; // most recent (ordered by created_at desc)
  if (sale.date_of_registration || sale.registration_completed) return 'REGISTERED';
  if ((sale.booking_amount && Number(sale.booking_amount) > 0) ||
      (sale.advance_payment && Number(sale.advance_payment) > 0)) return 'SOLD';
  return 'RESERVED';
}

function withComputed(inv) {
  const status = computeStatus(inv.sales || []);
  return { ...inv, status };
}

function sanitize(body) {
  const str = (v) => (v !== undefined && v !== '' && v !== null ? String(v).trim() : null);
  const num = (v) => (v !== undefined && v !== '' && v !== null ? parseFloat(v) : null);
  const int = (v) => (v !== undefined && v !== '' && v !== null ? parseInt(v, 10) : null);

  const fa = num(body.front_area);
  const ba = num(body.back_area);
  const directArea = num(body.area);
  const computedArea = (fa != null && ba != null) ? parseFloat((fa * (ba / 9)).toFixed(4)) : (directArea != null ? directArea : undefined);
  const computedUnit = str(body.front_area_details) || str(body.area_unit);

  return {
    type:               ['LAND', 'SHOP', 'PLOT', 'FLAT', 'PLOT_WIRE', 'SHOP_WIRE'].includes(body.type) ? body.type : 'PLOT',
    sl_no:              str(body.sl_no),
    location:           str(body.location),
    plot_no:            str(body.plot_no),
    front_area:         fa,
    front_area_details: str(body.front_area_details),
    back_area:          ba,
    back_area_details:  str(body.back_area_details),
    ...(computedArea !== undefined ? { area: computedArea } : {}),
    area_unit:          computedUnit || undefined,
    rate:               num(body.rate),
    registration_date:  body.registration_date ? new Date(body.registration_date) : null,
    project_id:         int(body.project_id),
  };
}

const INCLUDE = {
  purchase: { select: { id: true, purchase_code: true, type: true, plot_no: true, sl_no: true, location: true,
    purchased_area: true, purchased_area_details: true, rate: true } },
  project: { select: { id: true, project_code: true, name: true, location: true, status: true } },
  sales: {
    select: {
      id: true, sale_code: true, sale_date: true, status: true, type: true, possession: true,
      booking_amount: true, advance_payment: true, date_of_registration: true, registration_completed: true,
      actual_price: true, balance_amount: true, net_amount: true, selling_rate: true,
      customer: { select: { id: true, customer_code: true, name: true, phone: true, email: true } },
      broker:   { select: { id: true, broker_code: true, name: true } },
      installment: true,
    },
    orderBy: { created_at: 'desc' },
  },
};

async function getInventory(req, res) {
  const { page = 1, limit = 15, search = '', status = '', purchase_id = '', type = '' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    AND: [
      search ? {
        OR: [
          { inventory_code: { contains: search } },
          { plot_no:        { contains: search } },
          { sl_no:          { contains: search } },
          { location:       { contains: search } },
          { purchase: { location: { contains: search } } },
          { purchase: { plot_no:  { contains: search } } },
        ],
      } : {},
      type        ? { type }                             : {},
      purchase_id ? { purchase_id: Number(purchase_id) } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.inventory.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: Number(limit), include: INCLUDE }),
    prisma.inventory.count({ where }),
  ]);

  let computed = items.map(withComputed);

  // Status is computed, filter in memory
  if (status) computed = computed.filter(i => i.status === status);

  res.json({ inventory: computed, total: status ? computed.length : total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) });
}

async function getInventoryById(req, res) {
  const inv = await prisma.inventory.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!inv) return res.status(404).json({ message: 'Not found' });

  const result = withComputed(inv);

  // Persist computed status back to DB if it changed
  if (result.status !== inv.status) {
    await prisma.inventory.update({ where: { id: inv.id }, data: { status: result.status } }).catch(() => {});
  }

  res.json(result);
}

async function createInventory(req, res) {
  const data = sanitize(req.body);
  if (!req.body.purchase_id) return res.status(400).json({ message: 'purchase_id is required' });
  data.purchase_id = Number(req.body.purchase_id);

  const prefix = await getPrefix();
  const inv = await prisma.inventory.create({
    data: { ...data, created_by_id: req.user?.id ?? null, created_by_name: req.user?.name ?? null },
    include: INCLUDE,
  });

  const inventory_code = `${prefix}-${String(inv.id).padStart(4, '0')}`;
  const updated = await prisma.inventory.update({ where: { id: inv.id }, data: { inventory_code }, include: INCLUDE });
  auditLog({ req, action: 'CREATE', entity: 'inventory', entityId: updated.id, entityCode: updated.inventory_code });
  res.status(201).json(withComputed(updated));
}

async function updateInventory(req, res) {
  const id   = Number(req.params.id);
  const prev = await prisma.inventory.findUnique({ where: { id } });
  const data = sanitize(req.body);
  const inv  = await prisma.inventory.update({ where: { id }, data, include: INCLUDE });
  auditLog({ req, action: 'UPDATE', entity: 'inventory', entityId: inv.id, entityCode: inv.inventory_code, changes: diff(prev, inv) });
  res.json(withComputed(inv));
}

async function patchInventory(req, res) {
  const id   = Number(req.params.id);
  const data = {};
  if (req.body.project_id !== undefined)
    data.project_id = req.body.project_id === null ? null : Number(req.body.project_id);

  const inv = await prisma.inventory.update({ where: { id }, data, include: INCLUDE });
  auditLog({ req, action: 'UPDATE', entity: 'inventory', entityId: inv.id, entityCode: inv.inventory_code, changes: data });
  res.json(withComputed(inv));
}

async function deleteInventory(req, res) {
  const id  = Number(req.params.id);
  const inv = await prisma.inventory.findUnique({ where: { id } });
  await prisma.inventory.delete({ where: { id } });
  auditLog({ req, action: 'DELETE', entity: 'inventory', entityId: id, entityCode: inv?.inventory_code });
  res.json({ message: 'Deleted' });
}

// Called from sales controller after a sale is created/updated
async function syncInventoryStatus(inventoryId) {
  if (!inventoryId) return;
  try {
    const inv = await prisma.inventory.findUnique({
      where: { id: Number(inventoryId) },
      include: { sales: { select: { booking_amount: true, advance_payment: true, date_of_registration: true, registration_completed: true, status: true }, orderBy: { created_at: 'desc' } } },
    });
    if (!inv) return;
    const status = computeStatus(inv.sales || []);
    await prisma.inventory.update({ where: { id: inv.id }, data: { status } });
  } catch { /* non-critical */ }
}

module.exports = { getInventory, getInventoryById, createInventory, updateInventory, patchInventory, deleteInventory, syncInventoryStatus };
