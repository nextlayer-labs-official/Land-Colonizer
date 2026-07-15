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

// Raw SQL results can contain BigInt (integer IDs) and Buffer (BIT/TINYINT(1) booleans)
// Normalise them so JSON.stringify works and restore receives clean types
function cleanExportRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined)  { out[k] = null; }
    else if (typeof v === 'bigint')     { out[k] = Number(v); }
    else if (Buffer.isBuffer(v))        { out[k] = v[0] === 1; } // BIT(1) → boolean
    else                                { out[k] = v; }
  }
  return out;
}

// Restore rows come from JSON — convert ISO date strings back to Date objects
// Booleans may be true/false or 0/1 — leave as-is, MySQL/Prisma accepts both
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

  // Use raw SQL so enum validation in Prisma's ORM layer is bypassed entirely.
  // This handles cases where DB has stale enum values (e.g. action='' after
  // a migration that changed the PermissionAction enum).
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
    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;

    // Clear all tables in reverse dependency order using raw SQL
    // (avoids Prisma enum validation on deleteMany too)
    for (const [, tableName] of [...TABLE_MAP].reverse()) {
      await prisma.$executeRawUnsafe(`DELETE FROM \`${tableName}\``);
    }

    // Reinsert in forward dependency order
    for (const [key, tableName] of TABLE_MAP) {
      const rows = backup.tables[key];
      if (!rows || rows.length === 0) continue;

      for (const row of rows) {
        const clean = cleanRestoreRow(row);
        const cols  = Object.keys(clean).map(c => `\`${c}\``).join(', ');
        const vals  = Object.values(clean);
        const placeholders = vals.map(() => '?').join(', ');
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`${tableName}\` (${cols}) VALUES (${placeholders})`,
          ...vals,
        );
      }
    }

    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;

    const counts = {};
    for (const [key, rows] of Object.entries(backup.tables)) {
      counts[key] = rows?.length ?? 0;
    }

    res.json({ message: 'Backup restored successfully', counts });
  } catch (err) {
    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`.catch(() => {});
    console.error('Restore failed:', err);
    res.status(500).json({ message: 'Restore failed: ' + err.message });
  }
}

module.exports = { exportBackup, restoreBackup };
