const prisma = require('../../lib/prisma');

async function getAuditLogs(req, res) {
  const {
    page    = 1,
    limit   = 20,
    entity  = '',
    action  = '',
    user_id = '',
    from    = '',
    to      = '',
    search  = '',
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    AND: [
      entity  ? { entity: entity }               : {},
      action  ? { action:  action }               : {},
      user_id ? { user_id: Number(user_id) }      : {},
      from    ? { created_at: { gte: new Date(from) } } : {},
      to      ? { created_at: { lte: new Date(to + 'T23:59:59.999Z') } } : {},
      search  ? {
        OR: [
          { user_name:  { contains: search } },
          { user_email: { contains: search } },
          { entity_code:{ contains: search } },
        ],
      } : {},
    ],
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    logs,
    total,
    page:  Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  });
}

module.exports = { getAuditLogs };
