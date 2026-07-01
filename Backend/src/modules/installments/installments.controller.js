const prisma = require('../../lib/prisma');

function computeTotalPaid(inst) {
  let sum = 0;
  for (let n = 1; n <= 20; n++) {
    if (inst[`inst_${n}_paid`]) sum += Number(inst[`inst_${n}_amount`] || 0);
  }
  return parseFloat(sum.toFixed(2));
}

function sanitize(body) {
  const num  = (v) => (v !== undefined && v !== '' && v !== null ? parseFloat(v) : null);
  const dt   = (v) => (v ? new Date(v) : null);
  const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';
  const str  = (v) => (v !== undefined && v !== '' && v !== null ? String(v).trim() : null);

  const data = {
    sl_no:               str(body.sl_no),
    installment_details: str(body.installment_details),
  };
  for (let n = 1; n <= 20; n++) {
    data[`inst_${n}_amount`] = num(body[`inst_${n}_amount`]);
    data[`inst_${n}_date`]   = dt(body[`inst_${n}_date`]);
    data[`inst_${n}_paid`]   = bool(body[`inst_${n}_paid`]);
  }
  return data;
}

async function getInstallment(req, res) {
  const sale_id = Number(req.params.sale_id);

  let inst = await prisma.installment.findUnique({ where: { sale_id } });
  if (!inst) {
    inst = await prisma.installment.create({ data: { sale_id } });
  }

  const sale = await prisma.sale.findUnique({
    where:  { id: sale_id },
    select: { net_amount: true, customer: { select: { name: true, phone: true, customer_code: true } } },
  });

  res.json({
    installment: inst,
    total_paid:  computeTotalPaid(inst),
    net_amount:  Number(sale?.net_amount || 0),
    customer:    sale?.customer || null,
  });
}

async function updateInstallment(req, res) {
  const sale_id = Number(req.params.sale_id);
  const data    = sanitize(req.body);

  const inst = await prisma.installment.upsert({
    where:  { sale_id },
    update: data,
    create: { sale_id, ...data },
  });

  const sale = await prisma.sale.findUnique({
    where:  { id: sale_id },
    select: { net_amount: true, customer: { select: { name: true, phone: true, customer_code: true } } },
  });

  res.json({
    installment: inst,
    total_paid:  computeTotalPaid(inst),
    net_amount:  Number(sale?.net_amount || 0),
    customer:    sale?.customer || null,
  });
}

module.exports = { getInstallment, updateInstallment };
