const prisma = require('../../lib/prisma');
const { auditLog, diff } = require('../../lib/audit');

async function getPrefix() {
  const s = await prisma.companySettings.findFirst();
  return s?.project_prefix || 'PRJ';
}

const STATUS_LIST = ['OPEN', 'ONGOING', 'CLOSED'];

function withComputed(project) {
  const inv = project.inventory || [];
  const total_area = inv.reduce((sum, u) => sum + Number(u.area || 0), 0);
  const counts = { available: 0, reserved: 0, sold: 0, registered: 0 };
  for (const u of inv) {
    const s = (u.status || 'AVAILABLE').toLowerCase();
    if (counts[s] !== undefined) counts[s]++;
  }
  return { ...project, total_area: parseFloat(total_area.toFixed(4)), ...counts, unit_count: inv.length };
}

function sanitize(body) {
  const str = (v) => (v !== undefined && v !== '' && v !== null ? String(v).trim() : null);
  return {
    name:     str(body.name),
    location: str(body.location),
    status:   STATUS_LIST.includes(body.status) ? body.status : 'OPEN',
  };
}

const INCLUDE = {
  inventory: {
    select: {
      id: true, inventory_code: true, plot_no: true, sl_no: true,
      area: true, area_unit: true, status: true, type: true,
      purchase: { select: { id: true, purchase_code: true, plot_no: true, sl_no: true } },
      sales: {
        where: { status: 'ACTIVE' },
        select: {
          id: true, sale_code: true, actual_price: true,
          booking_amount: true, booking_in_received: true, advance_payment: true,
          brokerage: true, incentive: true, discount: true, extra_income: true,
          registration_completed: true, attorney_completed: true, full_final_completed: true,
          customer: { select: { name: true } },
          installment: {
            select: Object.fromEntries(
              [...Array(24)].flatMap((_, i) => [
                [`inst_${i+1}_amount`, true],
                [`inst_${i+1}_paid`,   true],
              ])
            ),
          },
        },
        take: 1, orderBy: { created_at: 'desc' },
      },
    },
    orderBy: { created_at: 'asc' },
  },
};

async function getProjects(req, res) {
  const { page = 1, limit = 15, search = '', status = '' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    AND: [
      search ? {
        OR: [
          { name:         { contains: search } },
          { project_code: { contains: search } },
          { location:     { contains: search } },
        ],
      } : {},
      status ? { status } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.project.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: Number(limit), include: INCLUDE }),
    prisma.project.count({ where }),
  ]);

  res.json({ projects: items.map(withComputed), total, page: Number(page), limit: Number(limit) });
}

async function getProjectById(req, res) {
  const p = await prisma.project.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!p) return res.status(404).json({ message: 'Not found' });
  res.json(withComputed(p));
}

async function createProject(req, res) {
  const data = sanitize(req.body);
  if (!data.name) return res.status(400).json({ message: 'name is required' });

  const project = await prisma.project.create({ data, include: INCLUDE });
  const prefix = await getPrefix();
  const project_code = `${prefix}-${String(project.id).padStart(4, '0')}`;
  const updated = await prisma.project.update({ where: { id: project.id }, data: { project_code }, include: INCLUDE });
  auditLog({ req, action: 'CREATE', entity: 'project', entityId: updated.id, entityCode: updated.project_code });
  res.status(201).json(withComputed(updated));
}

async function updateProject(req, res) {
  const id   = Number(req.params.id);
  const prev = await prisma.project.findUnique({ where: { id } });
  const data = sanitize(req.body);
  const p    = await prisma.project.update({ where: { id }, data, include: INCLUDE });
  auditLog({ req, action: 'UPDATE', entity: 'project', entityId: p.id, entityCode: p.project_code, changes: diff(prev, p) });
  res.json(withComputed(p));
}

async function deleteProject(req, res) {
  const id = Number(req.params.id);
  const p  = await prisma.project.findUnique({ where: { id } });
  await prisma.project.delete({ where: { id } });
  auditLog({ req, action: 'DELETE', entity: 'project', entityId: id, entityCode: p?.project_code });
  res.json({ message: 'Deleted' });
}

async function linkInventory(req, res) {
  const project_id   = Number(req.params.id);
  const inventory_id = Number(req.body.inventory_id);
  if (!inventory_id) return res.status(400).json({ message: 'inventory_id is required' });
  await prisma.inventory.update({ where: { id: inventory_id }, data: { project_id } });
  const p = await prisma.project.findUnique({ where: { id: project_id }, include: INCLUDE });
  res.json(withComputed(p));
}

async function unlinkInventory(req, res) {
  const project_id   = Number(req.params.id);
  const inventory_id = Number(req.params.inventoryId);
  await prisma.inventory.updateMany({
    where: { id: inventory_id, project_id },
    data:  { project_id: null },
  });
  const p = await prisma.project.findUnique({ where: { id: project_id }, include: INCLUDE });
  res.json(withComputed(p));
}

async function getSummary(req, res) {
  // Fetch all active sales across all projects
  const sales = await prisma.sale.findMany({
    where: { status: 'ACTIVE', inventory: { project_id: { not: null } } },
    select: {
      id: true,
      actual_price: true,
      advance_payment: true,
      booking_amount: true,
      booking_in_received: true,
      installment: {
        select: Object.fromEntries(
          [...Array(24)].flatMap((_, i) => [
            [`inst_${i + 1}_amount`, true],
            [`inst_${i + 1}_paid`,   true],
          ])
        ),
      },
    },
  });

  const saleIds = sales.map(s => s.id);
  const partials = saleIds.length
    ? await prisma.installmentPartial.findMany({
        where:  { sale_id: { in: saleIds } },
        select: { sale_id: true, installment_no: true, amount: true },
      })
    : [];
  const partialMap = {};
  for (const p of partials) {
    if (!partialMap[p.sale_id]) partialMap[p.sale_id] = {};
    partialMap[p.sale_id][p.installment_no] = (partialMap[p.sale_id][p.installment_no] || 0) + Number(p.amount);
  }

  let totalValue    = 0;
  let totalReceived = 0;

  for (const s of sales) {
    const actual  = Number(s.actual_price    || 0);
    const advance = Number(s.advance_payment || 0);
    const booking = s.booking_in_received ? Number(s.booking_amount || 0) : 0;
    let   instPaid = 0;
    if (s.installment) {
      const sp = partialMap[s.id] || {};
      for (let n = 1; n <= 24; n++) {
        const amt = Number(s.installment[`inst_${n}_amount`] || 0);
        if (!amt) continue;
        if (s.installment[`inst_${n}_paid`]) instPaid += amt;
        else if (sp[n])                      instPaid += sp[n];
      }
    }
    totalValue    += actual;
    totalReceived += advance + booking + instPaid;
  }

  res.json({
    total_value:    parseFloat(totalValue.toFixed(2)),
    total_received: parseFloat(totalReceived.toFixed(2)),
    total_balance:  parseFloat(Math.max(0, totalValue - totalReceived).toFixed(2)),
  });
}

module.exports = { getProjects, getProjectById, createProject, updateProject, deleteProject, linkInventory, unlinkInventory, getSummary };
