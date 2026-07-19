const prisma = require('./prisma');

const SKIP = new Set(['password', 'token', 'smtp_pass', 'created_at', 'updated_at', 'updated_at']);

function diff(oldObj, newObj) {
  if (!oldObj || !newObj) return undefined;
  const changes = {};
  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  for (const k of keys) {
    if (SKIP.has(k)) continue;
    const oStr = oldObj[k] == null ? null : String(oldObj[k]);
    const nStr = newObj[k] == null ? null : String(newObj[k]);
    if (oStr !== nStr) changes[k] = [oldObj[k] ?? null, newObj[k] ?? null];
  }
  return Object.keys(changes).length ? changes : undefined;
}

function auditLog({ req, userId, userName, userEmail, action, entity, entityId, entityCode, changes } = {}) {
  const uid    = userId    ?? req?.user?.id    ?? null;
  const uname  = userName  ?? req?.user?.name  ?? null;
  const uemail = userEmail ?? req?.user?.email ?? null;
  const ip     = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip || null;

  prisma.auditLog.create({
    data: {
      user_id:     uid,
      user_name:   uname,
      user_email:  uemail,
      action,
      entity,
      entity_id:   entityId   ?? null,
      entity_code: entityCode ?? null,
      changes:     changes    ?? undefined,
      ip_address:  ip,
    },
  }).catch(() => {});
}

module.exports = { auditLog, diff };
