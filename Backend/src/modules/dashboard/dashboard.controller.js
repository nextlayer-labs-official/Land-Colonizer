const prisma = require('../../lib/prisma');

async function getDashboard(req, res) {
  const userId = req.user.id;

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      role: {
        select: {
          name: true,
          is_system: true,
          rolePermissions: {
            where: { allowed: true },
            select: { permission: { select: { code: true } } },
          },
        },
      },
    },
  });

  const isSystem = currentUser.role.is_system;
  const codes    = new Set(currentUser.role.rolePermissions.map((rp) => rp.permission.code));
  const can      = (code) => isSystem || codes.has(code);

  const result = {
    user: {
      name:      currentUser.name,
      role:      currentUser.role.name,
      is_system: isSystem,
    },
  };

  if (isSystem || can('USER_VIEW')) {
    const [users, roles] = await Promise.all([
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.role.count(),
    ]);
    result.orgStats = { users, roles };
  }

  // Real estate stats
  const [
    purchaseCount, purchaseAgg, customerCount,
    saleCount, saleAgg,
    inventoryByStatus,
    recentSales,
  ] = await Promise.all([
    prisma.purchase.count(),
    prisma.purchase.aggregate({
      _sum: { advance_paid: true, registration_charges: true, brokerage: true, extra_expenses: true, extra_income: true },
    }),
    prisma.customer.count({ where: { status: 'ACTIVE' } }),
    prisma.sale.count({ where: { status: 'ACTIVE', archived: false } }),
    prisma.sale.aggregate({
      where: { status: 'ACTIVE', archived: false },
      _sum: { actual_price: true, booking_amount: true, advance_payment: true, brokerage: true, net_amount: true },
    }),
    prisma.inventory.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.sale.findMany({
      take: 6,
      orderBy: { created_at: 'desc' },
      where: { status: 'ACTIVE', archived: false },
      select: {
        id: true, sale_code: true, actual_price: true,
        booking_amount: true, advance_payment: true, created_at: true,
        customer:  { select: { name: true } },
        inventory: { select: { inventory_code: true, plot_no: true, sl_no: true } },
      },
    }),
  ]);

  const advSum  = Number(purchaseAgg._sum.advance_paid         || 0);
  const brokSum = Number(purchaseAgg._sum.brokerage            || 0);
  const extSum  = Number(purchaseAgg._sum.extra_expenses       || 0);
  const regSum  = Number(purchaseAgg._sum.registration_charges || 0);
  const incSum  = Number(purchaseAgg._sum.extra_income         || 0);
  const purchaseCost = advSum + brokSum + extSum + regSum - incSum;

  const invSt = (s) => inventoryByStatus.find(g => g.status === s)?._count?.id || 0;
  const invTotal = inventoryByStatus.reduce((s, g) => s + g._count.id, 0);

  const totalActual  = Number(saleAgg._sum.actual_price   || 0);
  const totalReceived = Number(saleAgg._sum.booking_amount || 0) + Number(saleAgg._sum.advance_payment || 0);
  const totalNet     = Number(saleAgg._sum.net_amount     || 0);

  result.reStats = {
    inventory: {
      total:      invTotal,
      available:  invSt('AVAILABLE'),
      reserved:   invSt('RESERVED'),
      sold:       invSt('SOLD'),
      registered: invSt('REGISTERED'),
    },
    customers: { total: customerCount },
    sales: {
      count:          saleCount,
      total_actual:   parseFloat(totalActual.toFixed(2)),
      total_received: parseFloat(totalReceived.toFixed(2)),
      total_net:      parseFloat(totalNet.toFixed(2)),
    },
    purchases: { count: purchaseCount, cost: parseFloat(purchaseCost.toFixed(2)) },
  };

  result.recentSales = recentSales.map(s => ({
    id:        s.id,
    sale_code: s.sale_code,
    customer:  s.customer?.name || '—',
    plot:      s.inventory?.inventory_code || s.inventory?.plot_no || s.inventory?.sl_no || '—',
    value:     Number(s.actual_price || 0),
    received:  Number(s.booking_amount || 0) + Number(s.advance_payment || 0),
    date:      s.created_at,
  }));

  res.json(result);
}

module.exports = { getDashboard };
