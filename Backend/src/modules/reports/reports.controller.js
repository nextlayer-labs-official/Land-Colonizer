const prisma = require('../../lib/prisma');

const num = (v) => (v !== undefined && v !== '' && v !== null ? parseFloat(v) : null);

// ── Sales Report ─────────────────────────────────────────────────────────────
const salesReport = async (req, res) => {
  const { date_from, date_to, project_id, broker_id, customer_id, status, sold_by_id } = req.query;

  const where = {};
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at.gte = new Date(date_from);
    if (date_to)   where.created_at.lte = new Date(date_to + 'T23:59:59.999Z');
  }
  if (project_id) where.inventory       = { project_id: parseInt(project_id) };
  if (broker_id)  where.broker_id       = parseInt(broker_id);
  if (customer_id) where.customer_id    = parseInt(customer_id);
  if (status)      where.sale_confirmed = status === 'confirmed';
  if (sold_by_id)  where.sold_by_id     = parseInt(sold_by_id);

  const sales = await prisma.sale.findMany({
    where,
    include: {
      inventory: { select: { id: true, inventory_code: true, type: true,
        project: { select: { id: true, name: true } } } },
      broker:    { select: { id: true, name: true } },
      customer:  { select: { id: true, name: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const rows = sales.map(s => ({
    ...s,
    project: s.inventory?.project || null,
  }));

  const summary = {
    count:        rows.length,
    total_value:  rows.reduce((s, r) => s + Number(r.total_value  || 0), 0),
    total_amount: rows.reduce((s, r) => s + Number(r.actual_price || 0), 0),
    total_advance:rows.reduce((s, r) => s + Number(r.advance_payment || 0), 0),
  };

  res.json({ sales: rows, summary });
};

// ── Inventory Report ─────────────────────────────────────────────────────────
const inventoryReport = async (req, res) => {
  const { project_id, status, area_type } = req.query;

  const where = {};
  if (project_id) where.project_id = parseInt(project_id);
  if (status)     where.status     = status;
  if (area_type)  where.type       = area_type;

  const units = await prisma.inventory.findMany({
    where,
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ project_id: 'asc' }, { inventory_code: 'asc' }],
  });

  const rows = units.map(u => {
    const area = Number(u.area || 0);
    const rate = Number(u.rate || 0);
    const total_value = area > 0 && rate > 0 ? parseFloat((area * rate).toFixed(2)) : null;
    return { ...u, total_area: area || null, rate_per_sqyd: rate || null, total_value, unit_code: u.inventory_code, area_type: u.type };
  });

  const summary = {
    count:       rows.length,
    total_area:  rows.reduce((s, r) => s + Number(r.total_area  || 0), 0),
    total_value: rows.reduce((s, r) => s + Number(r.total_value || 0), 0),
    available:   rows.filter(u => u.status === 'AVAILABLE').length,
    sold:        rows.filter(u => u.status === 'SOLD').length,
    booked:      rows.filter(u => u.status === 'BOOKED').length,
  };

  res.json({ units: rows, summary });
};

// ── Purchase Report ──────────────────────────────────────────────────────────
const purchaseReport = async (req, res) => {
  const { date_from, date_to } = req.query;

  const where = {};
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at.gte = new Date(date_from);
    if (date_to)   where.created_at.lte = new Date(date_to + 'T23:59:59.999Z');
  }

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });

  const rows = purchases.map(p => {
    const area = Number(p.purchased_area || 0);
    const rate = Number(p.rate || 0);
    const total_cost = area > 0 && rate > 0 ? parseFloat((area * rate).toFixed(2)) : null;
    return {
      ...p,
      total_area: area || null,
      rate_per_sqyd: rate || null,
      total_cost,
      seller_name: p.seller_details ? p.seller_details.substring(0, 60) : null,
    };
  });

  const summary = {
    count:      rows.length,
    total_area: rows.reduce((s, r) => s + Number(r.total_area || 0), 0),
    total_cost: rows.reduce((s, r) => s + Number(r.total_cost || 0), 0),
  };

  res.json({ purchases: rows, summary });
};

// ── Broker Report ────────────────────────────────────────────────────────────
const brokerReport = async (req, res) => {
  const { date_from, date_to, broker_id } = req.query;

  const saleWhere = {};
  if (date_from || date_to) {
    saleWhere.created_at = {};
    if (date_from) saleWhere.created_at.gte = new Date(date_from);
    if (date_to)   saleWhere.created_at.lte = new Date(date_to + 'T23:59:59.999Z');
  }
  if (broker_id) saleWhere.broker_id = parseInt(broker_id);

  const brokerWhere = broker_id ? { id: parseInt(broker_id) } : {};

  const brokers = await prisma.broker.findMany({
    where: brokerWhere,
    include: {
      sales: {
        where: saleWhere,
        select: {
          id: true, sale_code: true, actual_price: true, advance_payment: true,
          sale_confirmed: true, created_at: true,
          customer:  { select: { name: true } },
          inventory: { select: { project: { select: { name: true } } } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const rows = brokers.map(b => ({
    id:           b.id,
    name:         b.name,
    phone:        b.phone,
    sales_count:  b.sales.length,
    total_value:  b.sales.reduce((s, r) => s + Number(r.actual_price || 0), 0),
    sales:        b.sales.map(s => ({ ...s, project: s.inventory?.project || null })),
  }));

  const summary = {
    broker_count: rows.length,
    total_sales:  rows.reduce((s, r) => s + r.sales_count, 0),
    total_value:  rows.reduce((s, r) => s + r.total_value, 0),
  };

  res.json({ brokers: rows, summary });
};

// ── Instalments Report ───────────────────────────────────────────────────────
const instalmentsReport = async (req, res) => {
  function pendingOf(inst) {
    const paid = [], pending = [];
    for (let n = 1; n <= 24; n++) {
      const amount = Number(inst[`inst_${n}_amount`] || 0);
      if (amount <= 0) continue;
      if (inst[`inst_${n}_paid`]) paid.push({ no: n, amount, date: inst[`inst_${n}_date`] || null });
      else                        pending.push({ no: n, amount, date: inst[`inst_${n}_date`] || null });
    }
    return { paid, pending };
  }

  const [purchases, sales] = await Promise.all([
    prisma.purchase.findMany({
      include: {
        purchaseInstallment: true,
        inventory: { take: 1, include: { project: { select: { id: true, name: true } } } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.sale.findMany({
      where: { installment: { isNot: null } },
      include: {
        installment: true,
        customer:  { select: { id: true, name: true, phone: true, customer_code: true } },
        inventory: { select: { project: { select: { id: true, name: true } } } },
      },
      orderBy: { created_at: 'desc' },
    }),
  ]);

  const purchaseRows = purchases
    .filter(p => p.purchaseInstallment)
    .map(p => {
      const { paid, pending } = pendingOf(p.purchaseInstallment);
      return {
        id:            p.id,
        purchase_code: p.purchase_code || `PUR-${String(p.id).padStart(4, '0')}`,
        seller:        p.seller_details ? p.seller_details.substring(0, 60) : null,
        project:       p.inventory?.[0]?.project || null,
        paid_amount:   paid.reduce((s, r) => s + r.amount, 0),
        pending_amount:pending.reduce((s, r) => s + r.amount, 0),
        paid_instalments: paid,
        pending_instalments: pending,
      };
    })
    .filter(r => r.pending_amount > 0);

  const saleRows = sales
    .filter(s => s.installment)
    .map(s => {
      const { paid, pending } = pendingOf(s.installment);
      return {
        id:            s.id,
        sale_code:     s.sale_code || `SAL-${String(s.id).padStart(4, '0')}`,
        customer:      s.customer || null,
        project:       s.inventory?.project || null,
        actual_price:  Number(s.actual_price || 0),
        advance:       Number(s.advance_payment || 0),
        paid_amount:   paid.reduce((s, r) => s + r.amount, 0),
        pending_amount:pending.reduce((s, r) => s + r.amount, 0),
        paid_instalments: paid,
        pending_instalments: pending,
      };
    })
    .filter(r => r.pending_amount > 0);

  res.json({
    purchase_pending: purchaseRows,
    purchase_summary: {
      count:         purchaseRows.length,
      total_paid:    purchaseRows.reduce((s, r) => s + r.paid_amount, 0),
      total_pending: purchaseRows.reduce((s, r) => s + r.pending_amount, 0),
    },
    sale_pending: saleRows,
    sale_summary: {
      count:         saleRows.length,
      total_paid:    saleRows.reduce((s, r) => s + r.paid_amount, 0),
      total_pending: saleRows.reduce((s, r) => s + r.pending_amount, 0),
    },
  });
};

// ── Availability Report ──────────────────────────────────────────────────────
const availabilityReport = async (req, res) => {
  const { purchase_id, project_id, status, created_by_id } = req.query;

  const where = {};
  if (purchase_id)   where.purchase_id   = parseInt(purchase_id);
  if (project_id)    where.project_id    = parseInt(project_id);
  if (status)        where.status        = status;
  if (created_by_id) where.created_by_id = parseInt(created_by_id);

  const units = await prisma.inventory.findMany({
    where,
    select: {
      id: true,
      sl_no: true,
      plot_no: true,
      area: true,
      front_area: true,
      back_area: true,
      status: true,
      created_by_id: true,
      created_by_name: true,
      purchase: { select: { id: true, purchase_code: true, plot_no: true, location: true } },
      project:  { select: { id: true, name: true } },
      sales: {
        where:   { status: 'ACTIVE' },
        orderBy: { created_at: 'desc' },
        take: 1,
        select:  { sold_by_name: true },
      },
    },
    orderBy: [{ purchase_id: 'asc' }, { created_at: 'asc' }],
  });

  const rows = units.map(u => {
    const total_area = Number(u.area || 0) || (Number(u.front_area || 0) + Number(u.back_area || 0));
    const sold_by_name = u.sales?.[0]?.sold_by_name || null;
    return { ...u, total_area: total_area || null, sold_by_name };
  });

  const summary = {
    count:      rows.length,
    available:  rows.filter(u => u.status === 'AVAILABLE').length,
    sold:       rows.filter(u => u.status === 'SOLD').length,
    reserved:   rows.filter(u => u.status === 'RESERVED').length,
    registered: rows.filter(u => u.status === 'REGISTERED').length,
  };

  res.json({ units: rows, summary });
};

module.exports = { salesReport, inventoryReport, purchaseReport, brokerReport, instalmentsReport, availabilityReport };
