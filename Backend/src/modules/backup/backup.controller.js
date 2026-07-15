const prisma = require('../../lib/prisma');

// Prisma model name → MySQL table name (PascalCase)
const TABLE_MAP = [
  ['role',                'Role'],
  ['module',              'Module'],
  ['companySettings',     'CompanySettings'],
  ['permission',          'Permission'],
  ['user',                'User'],
  ['rolePermission',      'RolePermission'],
  ['customer',            'Customer'],
  ['broker',              'Broker'],
  ['project',             'Project'],
  ['purchase',            'Purchase'],
  ['inventory',           'Inventory'],
  ['sale',                'Sale'],
  ['saleBooking',         'SaleBooking'],
  ['installment',         'Installment'],
  ['purchaseInstallment', 'PurchaseInstallment'],
  ['document',            'Document'],
  ['passwordResetToken',  'PasswordResetToken'],
  ['auditLog',            'AuditLog'],
];

// Raw SQL results contain BigInt (IDs) and Buffer (BIT/TINYINT booleans).
// Convert them so JSON.stringify works correctly.
function cleanExportRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined)  out[k] = null;
    else if (typeof v === 'bigint')     out[k] = Number(v);
    else if (Buffer.isBuffer(v))        out[k] = v[0] === 1; // BIT(1) → boolean
    else                                out[k] = v;
  }
  return out;
}

// JSON strings that look like ISO dates need to become Date objects for MySQL.
function cleanRestoreRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) { out[k] = null; }
    else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      out[k] = new Date(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function exportBackup(req, res) {
  const backup = {
    version:     '1.0',
    app:         'AMS',
    exported_at: new Date().toISOString(),
    tables:      {},
  };

  // Raw SQL bypasses Prisma enum validation — handles stale enum values (e.g. action='')
  for (const [key, tableName] of TABLE_MAP) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM \`${tableName}\``);
    backup.tables[key] = rows.map(cleanExportRow);
  }

  const filename = `ams-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(backup, null, 2));
}

async function restoreBackup(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No backup file uploaded' });

  let backup;
  try {
    backup = JSON.parse(req.file.buffer.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Invalid JSON file — could not parse' });
  }

  if (!backup.tables || backup.app !== 'AMS') {
    return res.status(400).json({ message: 'Invalid backup file — wrong format or app mismatch' });
  }

  try {
    // $transaction pins all operations to a SINGLE MySQL connection.
    // This is critical: SET FOREIGN_KEY_CHECKS and SET sql_mode are session-level
    // variables. Without a transaction, Prisma's connection pool can route each
    // statement to a different connection where those settings were never applied —
    // DELETEs clear the data, INSERTs fail halfway, DB ends up mostly empty.
    await prisma.$transaction(async (tx) => {

      // Keep everything on this one connection
      await tx.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;
      // Allow stale enum values (e.g. Permission.action='') to be reinserted as-is
      await tx.$executeRaw`SET sql_mode = ''`;

      // ── 1. Clear all tables in reverse FK order ───────────────────────────
      for (const [, tableName] of [...TABLE_MAP].reverse()) {
        await tx.$executeRawUnsafe(`DELETE FROM \`${tableName}\``);
      }

      // ── 2. Reinsert from backup in forward FK order ───────────────────────
      for (const [key, tableName] of TABLE_MAP) {
        const rows = backup.tables[key];
        if (!rows || rows.length === 0) continue;

        for (const row of rows) {
          const clean        = cleanRestoreRow(row);
          const cols         = Object.keys(clean).map(c => `\`${c}\``).join(', ');
          const vals         = Object.values(clean);
          const placeholders = vals.map(() => '?').join(', ');
          await tx.$executeRawUnsafe(
            `INSERT INTO \`${tableName}\` (${cols}) VALUES (${placeholders})`,
            ...vals,
          );
        }
      }

      // Restore session variables before this connection returns to the pool
      await tx.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
      await tx.$executeRaw`SET sql_mode = DEFAULT`;

    }, { timeout: 120000 }); // 2-minute cap for large databases

    const counts = {};
    for (const [key, rows] of Object.entries(backup.tables)) {
      counts[key] = rows?.length ?? 0;
    }

    // The current user's session was wiped and re-created from backup.
    // Tell the frontend to clear the token and redirect to login.
    res.json({ message: 'Backup restored successfully', counts, requireRelogin: true });

  } catch (err) {
    console.error('Restore failed:', err);
    // If the transaction threw, Prisma automatically rolled back — the original
    // data is intact. The connection is returned to the pool; the ROLLBACK
    // also resets FOREIGN_KEY_CHECKS and sql_mode on that connection.
    res.status(500).json({ message: 'Restore failed: ' + err.message });
  }
}

module.exports = { exportBackup, restoreBackup };
