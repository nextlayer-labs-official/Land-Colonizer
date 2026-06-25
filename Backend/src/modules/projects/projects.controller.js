const prisma = require('../../lib/prisma');

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
      sales: {
        where: { status: 'ACTIVE' },
        select: { id: true, sale_code: true, actual_price: true, booking_amount: true, advance_payment: true,
          customer: { select: { name: true } } },
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
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { project_code },
    include: INCLUDE,
  });
  res.status(201).json(withComputed(updated));
}

async function updateProject(req, res) {
  const data = sanitize(req.body);
  const p = await prisma.project.update({
    where: { id: Number(req.params.id) },
    data,
    include: INCLUDE,
  });
  res.json(withComputed(p));
}

async function deleteProject(req, res) {
  await prisma.project.delete({ where: { id: Number(req.params.id) } });
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

module.exports = { getProjects, getProjectById, createProject, updateProject, deleteProject, linkInventory };
