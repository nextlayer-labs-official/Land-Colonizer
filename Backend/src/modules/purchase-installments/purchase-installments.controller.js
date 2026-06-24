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

function getBalanceToPay(purchase) {
  const area = Number(purchase?.purchased_area || 0);
  const rate = Number(purchase?.rate || 0);
  const adv  = Number(purchase?.advance_paid || 0);
  return parseFloat((rate * area - adv).toFixed(2));
}

async function getInstallment(req, res) {
  const purchase_id = Number(req.params.purchase_id);

  let inst = await prisma.purchaseInstallment.findUnique({ where: { purchase_id } });
  if (!inst) {
    inst = await prisma.purchaseInstallment.create({ data: { purchase_id } });
  }

  const purchase = await prisma.purchase.findUnique({
    where:  { id: purchase_id },
    select: { purchased_area: true, rate: true, advance_paid: true },
  });

  res.json({
    installment:    inst,
    total_paid:     computeTotalPaid(inst),
    balance_amount: getBalanceToPay(purchase),
  });
}

async function updateInstallment(req, res) {
  const purchase_id = Number(req.params.purchase_id);
  const data        = sanitize(req.body);

  const inst = await prisma.purchaseInstallment.upsert({
    where:  { purchase_id },
    update: data,
    create: { purchase_id, ...data },
  });

  const purchase = await prisma.purchase.findUnique({
    where:  { id: purchase_id },
    select: { purchased_area: true, rate: true, advance_paid: true },
  });

  res.json({
    installment:    inst,
    total_paid:     computeTotalPaid(inst),
    balance_amount: getBalanceToPay(purchase),
  });
}

module.exports = { getInstallment, updateInstallment };
