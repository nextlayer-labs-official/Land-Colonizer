const prisma = require('../../lib/prisma');

const CUSTOMER_SELECT = { id: true, customer_code: true, name: true, phone: true };

async function getBookings(req, res) {
  const sale_id = Number(req.params.sale_id);
  const bookings = await prisma.saleBooking.findMany({
    where: { sale_id },
    include: { customer: { select: CUSTOMER_SELECT } },
    orderBy: { created_at: 'asc' },
  });
  res.json(bookings);
}

async function createBooking(req, res) {
  const sale_id = Number(req.params.sale_id);
  const { customer_id, booking_amount, notes } = req.body;
  const booking = await prisma.saleBooking.create({
    data: {
      sale_id,
      customer_id: customer_id ? Number(customer_id) : null,
      booking_amount: booking_amount != null && booking_amount !== '' ? parseFloat(booking_amount) : null,
      notes: notes || null,
      status: 'PENDING',
    },
    include: { customer: { select: CUSTOMER_SELECT } },
  });
  res.status(201).json(booking);
}

async function updateBooking(req, res) {
  const id = Number(req.params.id);
  const { customer_id, booking_amount, notes, refund_amount, income_amount, status } = req.body;
  const num = (v) => (v != null && v !== '' ? parseFloat(v) : null);
  const ALLOWED_STATUS = ['PENDING', 'REFUNDED'];
  const data = {
    ...(customer_id    !== undefined ? { customer_id: customer_id ? Number(customer_id) : null } : {}),
    ...(booking_amount !== undefined ? { booking_amount: num(booking_amount) } : {}),
    ...(notes          !== undefined ? { notes: notes || null } : {}),
    ...(refund_amount  !== undefined ? { refund_amount: num(refund_amount) } : {}),
    ...(income_amount  !== undefined ? { income_amount: num(income_amount) } : {}),
    ...(status && ALLOWED_STATUS.includes(status) ? { status } : {}),
  };
  const booking = await prisma.saleBooking.update({
    where: { id },
    data,
    include: { customer: { select: CUSTOMER_SELECT } },
  });
  res.json(booking);
}

async function deleteBooking(req, res) {
  const id = Number(req.params.id);
  await prisma.saleBooking.delete({ where: { id } });
  res.json({ message: 'Deleted' });
}

async function confirmBooking(req, res) {
  const sale_id         = Number(req.params.sale_id);
  const id              = Number(req.params.id);
  const advance_payment      = req.body.advance_payment != null && req.body.advance_payment !== ''
    ? parseFloat(req.body.advance_payment)
    : null;
  const booking_in_received  = req.body.booking_in_received === false || req.body.booking_in_received === 'false' ? false : true;

  const booking = await prisma.saleBooking.findUnique({ where: { id } });
  if (!booking || booking.sale_id !== sale_id)
    return res.status(404).json({ message: 'Booking not found' });

  const currentSale    = await prisma.sale.findUnique({ where: { id: sale_id }, select: { actual_price: true } });
  const actualPrice    = currentSale?.actual_price != null ? parseFloat(currentSale.actual_price) : null;
  const computedBalance = actualPrice != null ? parseFloat((actualPrice - (advance_payment || 0)).toFixed(2)) : null;

  const saleUpdate = {
    sale_confirmed:      true,
    booking_in_received,
    ...(booking.customer_id    ? { customer_id:    booking.customer_id }    : {}),
    ...(booking.booking_amount ? { booking_amount: booking.booking_amount } : {}),
    ...(advance_payment != null ? { advance_payment }                        : {}),
    ...(computedBalance != null ? { balance_amount: computedBalance }        : {}),
  };

  // Mark this booking CONFIRMED; leave others as-is for manual refund/income entry
  await prisma.$transaction([
    prisma.saleBooking.update({ where: { id }, data: { status: 'CONFIRMED' } }),
    prisma.sale.update({ where: { id: sale_id }, data: saleUpdate }),
  ]);

  // Return full updated sale
  const sale = await prisma.sale.findUnique({
    where: { id: sale_id },
    include: {
      inventory: { select: { id: true, inventory_code: true, type: true, plot_no: true, sl_no: true, location: true,
        front_area: true, front_area_details: true, back_area: true, back_area_details: true,
        area: true, area_unit: true, rate: true, status: true } },
      customer:  { select: { id: true, customer_code: true, name: true, phone: true, email: true } },
      broker:    { select: { id: true, broker_code: true, name: true, phone: true } },
      installment: true,
      bookings: { include: { customer: { select: CUSTOMER_SELECT } }, orderBy: { created_at: 'asc' } },
    },
  });
  res.json(sale);
}

module.exports = { getBookings, createBooking, updateBooking, deleteBooking, confirmBooking };
