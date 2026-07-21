const prisma = require('../../lib/prisma');
const { auditLog, diff } = require('../../lib/audit');

// Compute formula fields from stored values
function withComputed(p) {
  const area    = Number(p.purchased_area  || 0);
  const rate    = Number(p.rate            || 0);
  const adv     = Number(p.advance_paid    || 0);
  const brok    = Number(p.brokerage       || 0);
  const extra   = Number(p.extra_expenses  || 0);
  const regChg  = Number(p.registration_charges || 0);
  const exInc   = Number(p.extra_income    || 0);

  const total_amount      = rate * area;
  const balance_to_pay    = total_amount - adv;
  const percentage_paid   = total_amount > 0 ? (adv / total_amount) * 100 : 0;
  const percentage_to_pay = 100 - percentage_paid;
  const total_cost        = adv + brok + extra + regChg - exInc;

  return {
    ...p,
    purchased_area:  area    || null,
    rate:            rate    || null,
    advance_paid:    adv     || null,
    brokerage:       brok    || null,
    extra_expenses:  extra   || null,
    registration_charges: regChg || null,
    extra_income:    exInc   || null,
    total_amount:    parseFloat(total_amount.toFixed(2)),
    balance_to_pay:  parseFloat(balance_to_pay.toFixed(2)),
    percentage_paid: parseFloat(percentage_paid.toFixed(2)),
    percentage_to_pay: parseFloat(percentage_to_pay.toFixed(2)),
    total_cost:      parseFloat(total_cost.toFixed(2)),
  };
}

async function getPurchasePrefix() {
  const s = await prisma.companySettings.findFirst();
  return s?.purchase_prefix || 'PUR';
}

function sanitize(body) {
  const num = (v) => (v !== undefined && v !== '' && v !== null ? parseFloat(v) : null);
  const str = (v) => (v !== undefined && v !== '' && v !== null ? String(v).trim() : null);

  return {
    purchase_category:           body.purchase_category === 'DIVIDED' ? 'DIVIDED' : 'SINGLE',
    type:                        body.type        || 'PLOT',
    sl_no:                       str(body.sl_no),
    location:                    str(body.location),
    purchase_broker_name:        str(body.purchase_broker_name),
    purchase_broker_details:     str(body.purchase_broker_details),
    sell_broker_name:            str(body.sell_broker_name),
    sell_broker_details:         str(body.sell_broker_details),
    seller_details:              str(body.seller_details),
    plot_no:                     str(body.plot_no),
    purchased_area:              num(body.purchased_area),
    purchased_area_details:      str(body.purchased_area_details),
    purchase_price:              num(body.purchase_price),
    global_rate:                 num(body.global_rate),
    rate:                        (() => {
      const pp = num(body.purchase_price);
      const gr = num(body.global_rate);
      return (pp != null && gr != null && gr !== 0)
        ? parseFloat((pp / gr).toFixed(2))
        : num(body.rate);
    })(),
    rate_details:                str(body.rate_details),
    total_amount_details:        str(body.total_amount_details),
    advance_paid:                num(body.advance_paid),
    advance_payment_details:     str(body.advance_payment_details),
    instalment_details:          str(body.instalment_details),
    remaining_paid:              body.remaining_paid === true || body.remaining_paid === 'true',
    registration_date:           body.registration_date ? new Date(body.registration_date) : null,
    registration_completed:      body.registration_completed === true || body.registration_completed === 'true',
    attorney_completed:          body.attorney_completed     === true || body.attorney_completed     === 'true',
    full_final_completed:        body.full_final_completed   === true || body.full_final_completed   === 'true',
    registration_details:        str(body.registration_details),
    brokerage:                   num(body.brokerage),
    brokerage_details:           str(body.brokerage_details),
    extra_expenses:              num(body.extra_expenses),
    extra_expenses_details:      str(body.extra_expenses_details),
    registration_charges:        num(body.registration_charges),
    registration_charges_details: str(body.registration_charges_details),
    extra_income:                num(body.extra_income),
    extra_income_details:        str(body.extra_income_details),
    other_details:               str(body.other_details),
    status:                      body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  };
}

async function getPurchases(req, res) {
  const { page = 1, limit = 15, search = '', type = '', status = '', archived = 'false' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    AND: [
      { archived: archived === 'true' },
      search ? {
        OR: [
          { purchase_code:  { contains: search } },
          { sl_no:          { contains: search } },
          { location:       { contains: search } },
          { plot_no:        { contains: search } },
          { seller_details: { contains: search } },
          { purchase_broker_name: { contains: search } },
        ],
      } : {},
      type   ? { type }   : {},
      status ? { status } : {},
    ],
  };

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where, orderBy: { created_at: 'desc' }, skip, take: Number(limit),
      include: { _count: { select: { inventory: true } }, purchaseInstallment: true },
    }),
    prisma.purchase.count({ where }),
  ]);

  res.json({
    purchases: purchases.map(p => {
      const comp = withComputed(p);
      let instPaid = 0;
      if (p.purchaseInstallment) {
        for (let n = 1; n <= 24; n++) {
          if (p.purchaseInstallment[`inst_${n}_paid`])
            instPaid += Number(p.purchaseInstallment[`inst_${n}_amount`] || 0);
        }
      }
      return {
        ...comp,
        effective_balance: parseFloat(Math.max(0, comp.balance_to_pay - instPaid).toFixed(2)),
      };
    }),
    total,
    page:  Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  });
}

async function getPurchaseById(req, res) {
  const p = await prisma.purchase.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      inventory: { orderBy: { created_at: 'asc' }, include: { sales: { select: { id: true }, take: 1 } } },
    },
  });
  if (!p) return res.status(404).json({ message: 'Not found' });
  res.json(withComputed(p));
}

async function createPurchase(req, res) {
  const prefix = await getPurchasePrefix();
  const p = await prisma.purchase.create({
    data: { ...sanitize(req.body), created_by_id: req.user?.id ?? null, created_by_name: req.user?.name ?? null },
  });

  const purchase_code = `${prefix}-${String(p.id).padStart(4, '0')}`;
  const updated = await prisma.purchase.update({ where: { id: p.id }, data: { purchase_code } });
  auditLog({ req, action: 'CREATE', entity: 'purchase', entityId: updated.id, entityCode: updated.purchase_code });
  res.status(201).json(withComputed(updated));
}

async function updatePurchase(req, res) {
  const id   = Number(req.params.id);
  const prev = await prisma.purchase.findUnique({ where: { id } });
  const p    = await prisma.purchase.update({ where: { id }, data: sanitize(req.body) });
  auditLog({ req, action: 'UPDATE', entity: 'purchase', entityId: p.id, entityCode: p.purchase_code, changes: diff(prev, p) });
  res.json(withComputed(p));
}

async function archivePurchase(req, res) {
  const id = Number(req.params.id);
  const p  = await prisma.purchase.findUnique({ where: { id } });
  await prisma.purchase.update({ where: { id }, data: { archived: true } });
  auditLog({ req, action: 'ARCHIVE', entity: 'purchase', entityId: id, entityCode: p?.purchase_code });
  res.json({ message: 'Archived' });
}

async function unarchivePurchase(req, res) {
  const id = Number(req.params.id);
  const p  = await prisma.purchase.findUnique({ where: { id } });
  await prisma.purchase.update({ where: { id }, data: { archived: false } });
  auditLog({ req, action: 'UNARCHIVE', entity: 'purchase', entityId: id, entityCode: p?.purchase_code });
  res.json({ message: 'Unarchived' });
}

async function deletePurchase(req, res) {
  const id = Number(req.params.id);

  const saleExists = await prisma.sale.findFirst({ where: { inventory: { purchase_id: id } } });
  if (saleExists) {
    return res.status(400).json({ message: 'Cannot delete: one or more inventory units linked to this purchase have an existing sale.' });
  }

  const p = await prisma.purchase.findUnique({ where: { id } });
  await prisma.inventory.deleteMany({ where: { purchase_id: id } });
  await prisma.purchase.deleteMany({ where: { id } });
  auditLog({ req, action: 'DELETE', entity: 'purchase', entityId: id, entityCode: p?.purchase_code });
  res.json({ message: 'Deleted' });
}

async function ensureBroker(name) {
  if (!name || !name.trim()) return;
  const existing = await prisma.broker.findFirst({ where: { name: { equals: name.trim() } } });
  if (existing) return;
  const settings   = await prisma.companySettings.findFirst();
  const brokerPfx  = settings?.broker_prefix || 'BRK';
  const b          = await prisma.broker.create({ data: { name: name.trim(), status: 'ACTIVE' } });
  await prisma.broker.update({ where: { id: b.id }, data: { broker_code: `${brokerPfx}-${String(b.id).padStart(4, '0')}` } });
}

async function importPurchases(req, res) {
  const rows = req.body.purchases;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ message: 'No purchase rows provided' });

  const prefix    = await getPurchasePrefix();
  const invPrefix = (await prisma.companySettings.findFirst())?.inventory_prefix || 'INV';
  const created        = [];
  const errors         = [];
  const brokersCreated = new Set();

  for (let i = 0; i < rows.length; i++) {
    try {
      const data = sanitize(rows[i]);

      // Auto-create broker records for purchase broker and sell broker
      for (const bname of [data.purchase_broker_name, data.sell_broker_name].filter(Boolean)) {
        const before = await prisma.broker.count();
        await ensureBroker(bname);
        const after = await prisma.broker.count();
        if (after > before) brokersCreated.add(bname);
      }

      const p    = await prisma.purchase.create({
        data: { ...data, created_by_id: req.user?.id ?? null, created_by_name: req.user?.name ?? null },
      });
      const purchase_code = `${prefix}-${String(p.id).padStart(4, '0')}`;
      const updated = await prisma.purchase.update({ where: { id: p.id }, data: { purchase_code } });

      // Auto-create inventory unit for SINGLE purchases
      if (updated.purchase_category === 'SINGLE') {
        const inv = await prisma.inventory.create({
          data: {
            purchase_id:     updated.id,
            type:            updated.type    || 'PLOT',
            sl_no:           updated.sl_no   || null,
            location:        updated.location || null,
            plot_no:         updated.plot_no  || null,
            area:            updated.purchased_area         || null,
            area_unit:       updated.purchased_area_details || null,
            created_by_id:   req.user?.id   ?? null,
            created_by_name: req.user?.name ?? null,
          },
        });
        const inventory_code = `${invPrefix}-${String(inv.id).padStart(4, '0')}`;
        await prisma.inventory.update({ where: { id: inv.id }, data: { inventory_code } });
      }

      created.push(purchase_code);
    } catch (e) {
      errors.push({ row: i + 1, message: e.message });
    }
  }

  res.json({ created: created.length, errors, codes: created, brokersCreated: [...brokersCreated] });
}

module.exports = { getPurchases, getPurchaseById, createPurchase, updatePurchase, archivePurchase, unarchivePurchase, deletePurchase, importPurchases };
