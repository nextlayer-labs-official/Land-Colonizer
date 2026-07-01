const prisma = require('../../lib/prisma');
const { syncInventoryStatus } = require('../inventory/inventory.controller');

const SALE_TYPES        = ['PLOT', 'SHOP', 'LAND'];
const POSSESSION_STATES = ['PENDING', 'SYMBOLIC', 'PHYSICAL'];

function computeFields(d) {
  const fa = Number(d.front_area  || 0);
  const ba = Number(d.back_area   || 0);
  const pr = Number(d.plot_rate   || 0);
  const sr = Number(d.selling_rate || 0);
  const ap = Number(d.advance_payment || 0);
  const bk = Number(d.booking_amount  || 0);

  const total_area    = fa > 0 && ba > 0 ? parseFloat((fa * (ba / 9)).toFixed(4)) : null;
  const total_value   = total_area && pr > 0 ? parseFloat((total_area * pr).toFixed(2)) : null;
  const actual_price  = total_area && sr > 0 ? parseFloat((total_area * sr).toFixed(2)) : null;
  const balance_amount = actual_price != null ? parseFloat((actual_price - ap).toFixed(2)) : null;
  const rawNet = bk + ap +
    Number(d.registration_charges      || 0) +
    Number(d.intkaal_charges            || 0) +
    Number(d.water_connection_charges   || 0) +
    Number(d.electricity_meter_charges  || 0);
  const net_amount = rawNet > 0 ? parseFloat(rawNet.toFixed(2)) : null;

  return { total_area, total_value, actual_price, balance_amount, net_amount };
}

function sanitize(body) {
  const num = (v) => (v !== undefined && v !== '' && v !== null ? parseFloat(v) : null);
  const str = (v) => (v !== undefined && v !== '' && v !== null ? String(v).trim() : null);
  const int = (v) => (v !== undefined && v !== '' && v !== null ? parseInt(v, 10) : null);
  const dt  = (v) => (v ? new Date(v) : null);

  const d = {
    inventory_id:              int(body.inventory_id),
    customer_id:               int(body.customer_id),
    broker_id:                 int(body.broker_id),
    sale_date:                 dt(body.sale_date),
    type:                      SALE_TYPES.includes(body.type) ? body.type : null,
    sl_no:                     str(body.sl_no),
    details:                   str(body.details),
    broker_name:               str(body.broker_name),
    broker_details:            str(body.broker_details),
    front_area:                num(body.front_area),
    front_area_details:        str(body.front_area_details),
    back_area:                 num(body.back_area),
    back_area_details:         str(body.back_area_details),
    total_area_details:        str(body.total_area_details),
    plot_rate:                 num(body.plot_rate),
    selling_rate:              num(body.selling_rate),
    booking_amount:            num(body.booking_amount),
    booking_details:           str(body.booking_details),
    advance_payment:           num(body.advance_payment),
    advance_payment_details:   str(body.advance_payment_details),
    balance_amount_details:    str(body.balance_amount_details),
    registration_charges:      num(body.registration_charges),
    registration_details:      str(body.registration_details),
    intkaal_charges:           num(body.intkaal_charges),
    intkaal_details:           str(body.intkaal_details),
    water_connection_charges:  num(body.water_connection_charges),
    water_connection_details:  str(body.water_connection_details),
    electricity_meter_charges: num(body.electricity_meter_charges),
    electricity_meter_details: str(body.electricity_meter_details),
    payment_due_date:          dt(body.payment_due_date),
    registration_area:         num(body.registration_area),
    discount:                  num(body.discount),
    discount_details:          str(body.discount_details),
    brokerage:                 num(body.brokerage),
    brokerage_details:         str(body.brokerage_details),
    incentive:                 num(body.incentive),
    incentive_details:         str(body.incentive_details),
    extra_income:              num(body.extra_income),
    extra_income_details:      str(body.extra_income_details),
    intkaal_number:            str(body.intkaal_number),
    date_of_registration:      dt(body.date_of_registration),
    vasika:                    str(body.vasika),
    possession:                POSSESSION_STATES.includes(body.possession) ? body.possession : 'PENDING',
    possession_detail:         str(body.possession_detail),
    other_details:             str(body.other_details),
    status:                    body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    sale_confirmed:            body.sale_confirmed === true || body.sale_confirmed === 'true' || false,
    booking_in_received:       body.booking_in_received === false || body.booking_in_received === 'false' ? false : true,
  };

  return { ...d, ...computeFields(d) };
}

const INCLUDE = {
  inventory: { select: { id: true, inventory_code: true, type: true, plot_no: true, sl_no: true, location: true,
    front_area: true, front_area_details: true, back_area: true, back_area_details: true,
    area: true, area_unit: true, rate: true, status: true,
    project: { select: { id: true, project_code: true, name: true } } } },
  customer:  { select: { id: true, customer_code: true, name: true, phone: true, email: true } },
  broker:    { select: { id: true, broker_code: true, name: true, phone: true } },
  installment: true,
  bookings: {
    include: { customer: { select: { id: true, customer_code: true, name: true, phone: true } } },
    orderBy: { created_at: 'asc' },
  },
};

async function getSales(req, res) {
  const { page = 1, limit = 15, search = '', status = '', customer_id = '' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    AND: [
      search ? {
        OR: [
          { sale_code: { contains: search } },
          { customer: { name:          { contains: search } } },
          { customer: { customer_code: { contains: search } } },
          { broker:   { name:          { contains: search } } },
          { inventory: { inventory_code: { contains: search } } },
          { inventory: { plot_no:         { contains: search } } },
        ],
      } : {},
      status      ? { status }                           : {},
      customer_id ? { customer_id: Number(customer_id) } : {},
    ],
  };

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: Number(limit), include: INCLUDE }),
    prisma.sale.count({ where }),
  ]);

  res.json({ sales, total, page: Number(page), limit: Number(limit) });
}

async function getSaleById(req, res) {
  const s = await prisma.sale.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!s) return res.status(404).json({ message: 'Not found' });
  res.json(s);
}

async function createSale(req, res) {
  const data = sanitize(req.body);
  const s = await prisma.sale.create({ data });
  const settings = await prisma.companySettings.findFirst();
  const prefix   = settings?.sale_prefix || 'SAL';
  const updated  = await prisma.sale.update({
    where:   { id: s.id },
    data:    { sale_code: `${prefix}-${String(s.id).padStart(4, '0')}` },
    include: INCLUDE,
  });
  if (data.inventory_id) syncInventoryStatus(data.inventory_id);
  res.status(201).json(updated);
}

async function updateSale(req, res) {
  const data = sanitize(req.body);
  const s = await prisma.sale.update({
    where:   { id: Number(req.params.id) },
    data,
    include: INCLUDE,
  });
  if (s.inventory_id) syncInventoryStatus(s.inventory_id);
  res.json(s);
}

async function deleteSale(req, res) {
  const s = await prisma.sale.findUnique({ where: { id: Number(req.params.id) }, select: { inventory_id: true } });
  await prisma.sale.delete({ where: { id: Number(req.params.id) } });
  if (s?.inventory_id) syncInventoryStatus(s.inventory_id);
  res.json({ message: 'Deleted' });
}

module.exports = { getSales, getSaleById, createSale, updateSale, deleteSale };
