const prisma = require('../../lib/prisma');

const getRoles = async (req, res) => {
  const roles = await prisma.role.findMany({ select: { id: true, name: true, slug: true } });
  res.json(roles);
};

const getUsers = async (req, res) => {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
};

const getPermissions = async (req, res) => {
  const permissions = await prisma.permission.findMany({
    select: {
      id: true,
      code: true,
      action: true,
      module: { select: { name: true, slug: true } },
    },
    orderBy: [{ module_id: 'asc' }, { action: 'asc' }],
  });
  res.json(permissions);
};

const getBrokers = async (req, res) => {
  const { search = '', limit = '3', id, exclude_id } = req.query;

  if (id) {
    const b = await prisma.broker.findUnique({
      where: { id: Number(id) },
      select: { id: true, broker_code: true, name: true, phone: true, email: true },
    });
    return res.json(b ? [b] : []);
  }

  const where = {
    status: 'ACTIVE',
    ...(exclude_id ? { id: { not: Number(exclude_id) } } : {}),
    ...(search.trim() ? {
      OR: [
        { broker_code: { contains: search } },
        { name:  { contains: search } },
        { phone: { contains: search } },
      ],
    } : {}),
  };

  const brokers = await prisma.broker.findMany({
    where,
    select: { id: true, broker_code: true, name: true, phone: true, email: true },
    orderBy: { name: 'asc' },
    take: Math.min(Number(limit) || 3, 50),
  });
  res.json(brokers);
};

const getCustomers = async (req, res) => {
  const { search = '', limit = '3', id } = req.query;

  if (id) {
    const c = await prisma.customer.findUnique({
      where: { id: Number(id) },
      select: { id: true, customer_code: true, name: true, phone: true, email: true },
    });
    return res.json(c ? [c] : []);
  }

  const where = {
    status: 'ACTIVE',
    ...(search.trim() ? {
      OR: [
        { customer_code: { contains: search } },
        { name:  { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ],
    } : {}),
  };

  const customers = await prisma.customer.findMany({
    where,
    select: { id: true, customer_code: true, name: true, phone: true, email: true },
    orderBy: { name: 'asc' },
    take: Math.min(Number(limit) || 3, 50),
  });
  res.json(customers);
};

const getPlots = async (req, res) => {
  const plots = await prisma.purchase.findMany({
    select: { id: true, purchase_code: true, purchase_category: true, type: true, plot_no: true, sl_no: true, location: true, purchased_area: true, purchased_area_details: true, rate: true },
    orderBy: { created_at: 'desc' },
  });
  res.json(plots);
};

const getPurchases = async (req, res) => {
  const { search = '', limit = '3', id } = req.query;

  // Fetch a single purchase by ID (for pre-selected display in pickers)
  if (id) {
    const p = await prisma.purchase.findUnique({
      where: { id: Number(id) },
      select: { id: true, purchase_code: true, purchase_category: true, type: true, plot_no: true, sl_no: true, location: true, purchased_area: true, purchased_area_details: true, rate: true },
    });
    return res.json(p ? [p] : []);
  }

  const where = {
    status: 'ACTIVE',
    ...(search.trim() ? {
      OR: [
        { purchase_code: { contains: search } },
        { plot_no:       { contains: search } },
        { sl_no:         { contains: search } },
        { location:      { contains: search } },
      ],
    } : {}),
  };

  const purchases = await prisma.purchase.findMany({
    where,
    select: { id: true, purchase_code: true, purchase_category: true, type: true, plot_no: true, sl_no: true, location: true },
    orderBy: { created_at: 'desc' },
    take: Math.min(Number(limit) || 3, 50),
  });
  res.json(purchases);
};

const getInventoryUnits = async (req, res) => {
  const { purchase_id, search = '', limit = '3', id, no_project } = req.query;

  const SELECT = {
    id: true, inventory_code: true, type: true, plot_no: true, sl_no: true, location: true,
    front_area: true, front_area_details: true, back_area: true, back_area_details: true,
    area: true, area_unit: true, rate: true, status: true, purchase_id: true,
    purchase: { select: { id: true, purchase_code: true, plot_no: true, sl_no: true, location: true, rate: true } },
  };

  if (id) {
    const unit = await prisma.inventory.findUnique({ where: { id: Number(id) }, select: SELECT });
    return res.json(unit ? [unit] : []);
  }

  // Exclude SOLD and REGISTERED only for sale picker; show all statuses for project linking
  const where = {
    ...(no_project ? { project_id: null } : { status: { notIn: ['SOLD', 'REGISTERED'] } }),
    ...(purchase_id ? { purchase_id: Number(purchase_id) } : {}),
    ...(search.trim() ? {
      OR: [
        { inventory_code: { contains: search } },
        { plot_no:        { contains: search } },
        { sl_no:          { contains: search } },
        { location:       { contains: search } },
        { purchase: { purchase_code: { contains: search } } },
        { purchase: { plot_no:       { contains: search } } },
        { purchase: { sl_no:         { contains: search } } },
        { purchase: { location:      { contains: search } } },
      ],
    } : {}),
  };

  const units = await prisma.inventory.findMany({
    where,
    select: SELECT,
    orderBy: { created_at: 'desc' },
    take: Math.min(Number(limit) || 3, 50),
  });
  res.json(units);
};

const getProjects = async (req, res) => {
  const { search = '', limit = '3', id } = req.query;

  if (id) {
    const p = await prisma.project.findUnique({
      where: { id: Number(id) },
      select: { id: true, project_code: true, name: true, location: true, status: true },
    });
    return res.json(p ? [p] : []);
  }

  const where = search.trim() ? {
    OR: [
      { project_code: { contains: search } },
      { name:         { contains: search } },
      { location:     { contains: search } },
    ],
  } : {};

  const projects = await prisma.project.findMany({
    where,
    select: { id: true, project_code: true, name: true, location: true, status: true },
    orderBy: { name: 'asc' },
    take: Math.min(Number(limit) || 3, 50),
  });
  res.json(projects);
};

module.exports = { getRoles, getUsers, getPermissions, getBrokers, getCustomers, getPlots, getPurchases, getInventoryUnits, getProjects };
