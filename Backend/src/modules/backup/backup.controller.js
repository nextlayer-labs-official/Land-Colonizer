const prisma = require('../../lib/prisma');

// Ordered by FK dependencies — insert in this order, delete in reverse
const TABLE_ORDER = [
  'role', 'module', 'companySettings', 'permission', 'user',
  'rolePermission', 'customer', 'broker', 'project', 'purchase',
  'inventory', 'sale', 'saleBooking', 'installment', 'purchaseInstallment',
  'document', 'passwordResetToken', 'auditLog',
];

async function exportBackup(req, res) {
  const backup = {
    version:     '1.0',
    app:         'AMS',
    exported_at: new Date().toISOString(),
    tables:      {},
  };

  for (const table of TABLE_ORDER) {
    backup.tables[table] = await prisma[table].findMany();
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

    // Clear all tables in reverse dependency order
    for (const table of [...TABLE_ORDER].reverse()) {
      await prisma[table].deleteMany();
    }

    // Reinsert in forward dependency order
    for (const table of TABLE_ORDER) {
      const rows = backup.tables[table];
      if (!rows || rows.length === 0) continue;

      // Normalize: convert date strings → Date objects, keep nulls as-is
      const normalized = rows.map(row => {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
          if (v === null || v === undefined) { out[k] = null; continue; }
          // Detect ISO date strings
          if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
            out[k] = new Date(v);
          } else {
            out[k] = v;
          }
        }
        return out;
      });

      await prisma[table].createMany({ data: normalized, skipDuplicates: true });
    }

    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;

    const counts = {};
    for (const [t, rows] of Object.entries(backup.tables)) {
      counts[t] = rows?.length ?? 0;
    }

    res.json({ message: 'Backup restored successfully', counts });
  } catch (err) {
    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`.catch(() => {});
    console.error('Restore failed:', err);
    res.status(500).json({ message: 'Restore failed: ' + err.message });
  }
}

module.exports = { exportBackup, restoreBackup };
