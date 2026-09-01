const prisma = require('../../lib/prisma');
const { auditLog } = require('../../lib/audit');

async function recomputePaid(sale_id, n) {
  const inst = await prisma.installment.findUnique({ where: { sale_id } });
  const partials = await prisma.installmentPartial.findMany({ where: { sale_id, installment_no: n } });
  const total = partials.reduce((s, p) => s + Number(p.amount), 0);
  const instAmt = Number(inst?.[`inst_${n}_amount`] || 0);
  const paid = instAmt > 0 && total >= instAmt;
  await prisma.installment.update({ where: { sale_id }, data: { [`inst_${n}_paid`]: paid } });
  return { partials, total, balance: Math.max(0, instAmt - total), paid };
}

async function addPartial(req, res) {
  const sale_id = Number(req.params.sale_id);
  const n = Number(req.params.n);
  const { amount, date, payment_mode, details } = req.body;

  if (!amount || !date) return res.status(400).json({ error: 'amount and date are required' });

  const created = await prisma.installmentPartial.create({
    data: {
      sale_id,
      installment_no: n,
      amount: parseFloat(amount),
      date: new Date(date),
      payment_mode: payment_mode || null,
      details: details || null,
    },
  });

  const sale = await prisma.sale.findUnique({ where: { id: sale_id }, select: { sale_code: true } });
  auditLog({
    req,
    action: 'CREATE',
    entity: 'installment_partial',
    entityId: created.id,
    entityCode: `${sale?.sale_code || sale_id}#inst${n}`,
  });

  const result = await recomputePaid(sale_id, n);
  res.json(result);
}

async function getPartials(req, res) {
  const sale_id = Number(req.params.sale_id);
  const n = Number(req.params.n);

  const partials = await prisma.installmentPartial.findMany({
    where: { sale_id, installment_no: n },
    orderBy: { date: 'asc' },
  });

  const inst = await prisma.installment.findUnique({ where: { sale_id } });
  const instAmt = Number(inst?.[`inst_${n}_amount`] || 0);
  const total = partials.reduce((s, p) => s + Number(p.amount), 0);

  res.json({ partials, total, balance: Math.max(0, instAmt - total) });
}

async function deletePartial(req, res) {
  const sale_id = Number(req.params.sale_id);
  const n = Number(req.params.n);
  const id = Number(req.params.id);

  await prisma.installmentPartial.delete({ where: { id } });

  const sale = await prisma.sale.findUnique({ where: { id: sale_id }, select: { sale_code: true } });
  auditLog({
    req,
    action: 'DELETE',
    entity: 'installment_partial',
    entityId: id,
    entityCode: `${sale?.sale_code || sale_id}#inst${n}`,
  });

  const result = await recomputePaid(sale_id, n);
  res.json(result);
}

module.exports = { addPartial, getPartials, deletePartial };
