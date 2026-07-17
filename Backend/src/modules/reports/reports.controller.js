const prisma = require('../../lib/prisma');

const num = (v) => (v !== undefined && v !== '' && v !== null ? parseFloat(v) : null);

// ── Sales Report ─────────────────────────────────────────────────────────────
const salesReport = async (req, res) => {
  const { date_from, date_to, project_id, broker_id, customer_id, status, sold_by_id } = req.query;

  const where = { archived: false };
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at.gte = new Date(date_from);
    if (date_to)   where.created_at.lte = new Date(date_to + 'T23:59:59.999');
  }
  if (project_id)  where.inventory    = { project_id: parseInt(project_id) };
  if (broker_id)   where.broker_id    = parseInt(broker_id);
  if (customer_id) where.customer_id  = parseInt(customer_id);
  if (status)      where.sale_confirmed = status === 'confirmed';
  if (sold_by_id)  where.sold_by_id   = parseInt(sold_by_id);

  const sales = await prisma.sale.findMany({
    where,
    select: {
      id: true, sale_code: true, type: true, status: true, sale_confirmed: true, registration_completed: true,
      total_area: true, total_area_details: true, plot_rate: true, total_value: true, selling_rate: true,
      actual_price: true, advance_payment: true, booking_amount: true, booking_in_received: true,
      date_of_registration: true, intkaal_number: true, vasika: true, possession: true,
      sold_by_name: true, sale_date: true, created_at: true,
      customer:     { select: { id: true, name: true } },
      broker:       { select: { id: true, name: true } },
      inventory:    { select: { id: true, inventory_code: true, project: { select: { id: true, name: true } } } },
      installment:  { select: Object.fromEntries([...Array(24)].flatMap((_, i) => [[`inst_${i+1}_amount`, true], [`inst_${i+1}_paid`, true]])) },
    },
    orderBy: { created_at: 'desc' },
  });

  const rows = sales.map(s => {
    const actual   = Number(s.actual_price    || 0);
    const advance  = Number(s.advance_payment || 0);
    const booking  = s.booking_in_received ? Number(s.booking_amount || 0) : 0;
    let instPaid = 0;
    if (s.installment) {
      for (let n = 1; n <= 24; n++) {
        if (s.installment[`inst_${n}_paid`]) instPaid += Number(s.installment[`inst_${n}_amount`] || 0);
      }
    }
    const balance = actual > 0 ? Math.max(0, parseFloat((actual - advance - booking - instPaid).toFixed(2))) : null;
    return {
      ...s,
      balance_amount: balance,
      project:        s.inventory?.project || null,
      inventory_unit: s.inventory?.inventory_code || null,
    };
  });

  const summary = {
    count:         rows.length,
    total_value:   rows.reduce((s, r) => s + Number(r.total_value    || 0), 0),
    actual_price:  rows.reduce((s, r) => s + Number(r.actual_price   || 0), 0),
    total_balance: rows.reduce((s, r) => s + Number(r.balance_amount || 0), 0),
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
  const { date_from, date_to, category, type, status } = req.query;

  const where = {};
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at.gte = new Date(date_from);
    if (date_to)   where.created_at.lte = new Date(date_to + 'T23:59:59.999');
  }
  if (category) where.purchase_category = category;
  if (type)     where.type              = type;
  if (status)   where.status            = status;

  const purchases = await prisma.purchase.findMany({
    where,
    select: {
      id: true, purchase_code: true, purchase_category: true, type: true, status: true,
      sl_no: true, location: true, purchased_area: true, purchased_area_details: true,
      purchase_price: true, global_rate: true, rate: true, advance_paid: true,
      brokerage: true, extra_expenses: true, registration_charges: true, extra_income: true,
      registration_date: true, registration_completed: true, remaining_paid: true,
      purchaseInstallment: { select: Object.fromEntries([...Array(24)].flatMap((_, i) => [[`inst_${i+1}_amount`, true], [`inst_${i+1}_paid`, true]])) },
    },
    orderBy: { created_at: 'desc' },
  });

  const rows = purchases.map(p => {
    const area       = Number(p.purchased_area || 0);
    const pp         = Number(p.purchase_price || 0);
    const gr         = Number(p.global_rate    || 0);
    const rate       = (pp > 0 && gr > 0) ? pp / gr : Number(p.rate || 0);
    const total_amount = parseFloat((rate * area).toFixed(2));
    const advance    = Number(p.advance_paid || 0);
    const brokerage  = Number(p.brokerage || 0);
    const extra_exp  = Number(p.extra_expenses || 0);
    const reg_charges = Number(p.registration_charges || 0);
    const extra_income = Number(p.extra_income || 0);
    let instPaid = 0;
    if (p.purchaseInstallment) {
      for (let n = 1; n <= 24; n++) {
        if (p.purchaseInstallment[`inst_${n}_paid`]) instPaid += Number(p.purchaseInstallment[`inst_${n}_amount`] || 0);
      }
    }
    const balance_to_pay = total_amount > 0 ? Math.max(0, parseFloat((total_amount - advance - instPaid).toFixed(2))) : null;
    const total_cost     = parseFloat((advance + brokerage + extra_exp + reg_charges - extra_income + instPaid).toFixed(2));
    const effBal  = total_amount > 0 ? Math.max(0, total_amount - advance - instPaid) : 0;
    const effPct  = total_amount > 0 ? Math.min(100, ((total_amount - effBal) / total_amount) * 100) : (advance > 0 ? 100 : 0);
    const stage   = (p.registration_completed && effPct >= 100) ? 'Completed'
                  : p.registration_completed                     ? 'Registered'
                  : effPct > 0                                   ? 'In Progress'
                  :                                                'Draft';
    return {
      ...p,
      purchased_area: area || null,
      total_amount:   total_amount || null,
      total_cost:     total_cost || null,
      balance_to_pay: balance_to_pay > 0 ? balance_to_pay : null,
      stage,
    };
  });

  const summary = {
    count:        rows.length,
    total_area:   rows.reduce((s, r) => s + Number(r.purchased_area || 0), 0),
    total_amount: rows.reduce((s, r) => s + Number(r.total_amount || 0), 0),
    total_cost:   rows.reduce((s, r) => s + Number(r.total_cost || 0), 0),
  };

  res.json({ purchases: rows, summary });
};

// ── Broker Report ────────────────────────────────────────────────────────────
const brokerReport = async (req, res) => {
  const { date_from, date_to, broker_id } = req.query;

  const dateFilter = {};
  if (date_from || date_to) {
    dateFilter.created_at = {};
    if (date_from) dateFilter.created_at.gte = new Date(date_from);
    if (date_to)   dateFilter.created_at.lte = new Date(date_to + 'T23:59:59.999');
  }

  const brokerWhere = broker_id ? { id: parseInt(broker_id) } : {};

  const brokers = await prisma.broker.findMany({
    where: brokerWhere,
    include: {
      sales: {
        where: dateFilter,
        select: {
          id: true, sale_code: true, actual_price: true, status: true, created_at: true,
          customer:  { select: { name: true } },
          inventory: { select: { project: { select: { name: true } } } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Purchases store broker as plain name strings — fetch and group by broker name
  const names = brokers.map(b => b.name).filter(Boolean);
  const purchasesByBroker = {};
  if (names.length > 0) {
    const purchaseFilter = {
      OR: [
        { purchase_broker_name: { in: names } },
        { sell_broker_name:     { in: names } },
      ],
    };
    if (dateFilter.created_at) purchaseFilter.created_at = dateFilter.created_at;

    const purchases = await prisma.purchase.findMany({
      where: purchaseFilter,
      select: {
        id: true, purchase_code: true, location: true, type: true, status: true,
        purchase_price: true, global_rate: true, rate: true, purchased_area: true,
        purchase_broker_name: true, sell_broker_name: true, created_at: true,
      },
    });

    for (const p of purchases) {
      const pp  = Number(p.purchase_price || 0);
      const gr  = Number(p.global_rate    || 0);
      const rt  = (pp > 0 && gr > 0) ? pp / gr : Number(p.rate || 0);
      const area = Number(p.purchased_area || 0);
      const total_amount = parseFloat((rt * area).toFixed(2));
      const enriched = { ...p, total_amount };
      const matched = new Set([p.purchase_broker_name, p.sell_broker_name].filter(Boolean));
      for (const n of matched) {
        if (!purchasesByBroker[n]) purchasesByBroker[n] = [];
        purchasesByBroker[n].push(enriched);
      }
    }
  }

  const rows = brokers.map(b => {
    const purchases       = purchasesByBroker[b.name] || [];
    const sales_total     = b.sales.reduce((s, r) => s + Number(r.actual_price   || 0), 0);
    const purchases_total = purchases.reduce((s, p) => s + Number(p.total_amount || 0), 0);
    return {
      id:               b.id,
      name:             b.name,
      phone:            b.phone,
      sales_count:      b.sales.length,
      purchases_count:  purchases.length,
      sales_total,
      purchases_total,
      total_value:      parseFloat((sales_total + purchases_total).toFixed(2)),
      sales:            b.sales.map(s => ({ ...s, project: s.inventory?.project || null })),
      purchases,
    };
  });

  const summary = {
    broker_count:    rows.length,
    total_sales:     rows.reduce((s, r) => s + r.sales_count,     0),
    total_purchases: rows.reduce((s, r) => s + r.purchases_count, 0),
    total_value:     rows.reduce((s, r) => s + r.total_value,     0),
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
      area_unit: true,
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
