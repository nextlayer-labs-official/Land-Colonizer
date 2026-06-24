const prisma = require('../../lib/prisma');

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
  const str = (v) => (v !== undefined && v !== '' ? String(v).trim() : null);

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
    rate:                        num(body.rate),
    rate_details:                str(body.rate_details),
    total_amount_details:        str(body.total_amount_details),
    advance_paid:                num(body.advance_paid),
    advance_payment_details:     str(body.advance_payment_details),
    instalment_details:          str(body.instalment_details),
    remaining_paid:              body.remaining_paid === true || body.remaining_paid === 'true',
    against_registration_paid:   body.against_registration_paid === true || body.against_registration_paid === 'true',
    registration_date:           body.registration_date ? new Date(body.registration_date) : null,
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
  const { page = 1, limit = 15, search = '', type = '', status = '' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    AND: [
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
    prisma.purchase.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: Number(limit) }),
    prisma.purchase.count({ where }),
  ]);

  res.json({
    purchases: purchases.map(withComputed),
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
      inventory: { orderBy: { created_at: 'asc' } },
    },
  });
  if (!p) return res.status(404).json({ message: 'Not found' });
  res.json(withComputed(p));
}

async function createPurchase(req, res) {
  const prefix = await getPurchasePrefix();
  const p = await prisma.purchase.create({ data: sanitize(req.body) });

  // Auto-generate purchase_code using the new record's ID
  const purchase_code = `${prefix}-${String(p.id).padStart(4, '0')}`;
  const updated = await prisma.purchase.update({
    where: { id: p.id },
    data:  { purchase_code },
  });

  // For SINGLE purchases, auto-create one inventory unit mirroring the purchase
  if (updated.purchase_category === 'SINGLE') {
    const invPrefix = (await prisma.companySettings.findFirst())?.inventory_prefix || 'INV';
    const inv = await prisma.inventory.create({
      data: {
        purchase_id: updated.id,
        type:        updated.type       || 'PLOT',
        sl_no:       updated.sl_no      || null,
        location:    updated.location   || null,
        plot_no:     updated.plot_no    || null,
        area:        updated.purchased_area             || null,
        area_unit:   updated.purchased_area_details     || null,
        status:      'AVAILABLE',
      },
    });
    const inventory_code = `${invPrefix}-${String(inv.id).padStart(4, '0')}`;
    await prisma.inventory.update({ where: { id: inv.id }, data: { inventory_code } });
  }

  res.status(201).json(withComputed(updated));
}

async function updatePurchase(req, res) {
  const p = await prisma.purchase.update({
    where: { id: Number(req.params.id) },
    data:  sanitize(req.body),
  });

  // Keep the single linked inventory unit in sync with the purchase
  if (p.purchase_category === 'SINGLE') {
    const inv = await prisma.inventory.findFirst({ where: { purchase_id: p.id } });
    if (inv) {
      await prisma.inventory.update({
        where: { id: inv.id },
        data: {
          type:      p.type     || 'PLOT',
          sl_no:     p.sl_no    || null,
          location:  p.location || null,
          plot_no:   p.plot_no  || null,
          area:      p.purchased_area             || null,
          area_unit: p.purchased_area_details     || null,
        },
      });
    }
  }

  res.json(withComputed(p));
}

async function deletePurchase(req, res) {
  await prisma.purchase.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: 'Deleted' });
}

module.exports = { getPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase };
