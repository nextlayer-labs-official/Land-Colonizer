/**
 * One-time fix: insert AUDIT module + AUDIT_VIEW permission + RolePermissions.
 * Uses raw SQL to bypass Prisma enum validation (ARCHIVE not yet in generated client).
 * Run with: node prisma/fix_audit_permission.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Insert AUDIT module (ignore if exists)
  await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO \`Module\` (\`name\`, \`slug\`, \`description\`, \`created_at\`, \`updated_at\`)
    VALUES ('AUDIT', 'audit', 'Audit logs', NOW(), NOW())
  `);

  // 2. Insert AUDIT_VIEW permission
  await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO \`Permission\` (\`module_id\`, \`action\`, \`code\`, \`created_at\`)
    SELECT m.id, 'VIEW', 'AUDIT_VIEW', NOW() FROM \`Module\` m WHERE m.slug = 'audit'
  `);

  // 3. Grant AUDIT_VIEW to super-admin and admin (allowed=1)
  await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO \`RolePermission\` (\`role_id\`, \`permission_id\`, \`allowed\`)
    SELECT r.id, p.id, 1
    FROM \`Role\` r, \`Permission\` p
    WHERE r.slug IN ('super-admin', 'admin') AND p.code = 'AUDIT_VIEW'
  `);

  // 4. Grant AUDIT_VIEW to all other roles (allowed=0 by default)
  await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO \`RolePermission\` (\`role_id\`, \`permission_id\`, \`allowed\`)
    SELECT r.id, p.id, 0
    FROM \`Role\` r, \`Permission\` p
    WHERE r.slug NOT IN ('super-admin', 'admin') AND p.code = 'AUDIT_VIEW'
  `);

  const rows = await prisma.$queryRawUnsafe(
    `SELECT p.id, p.code, m.slug as module FROM \`Permission\` p JOIN \`Module\` m ON m.id = p.module_id WHERE p.code = 'AUDIT_VIEW'`
  );
  console.log('AUDIT_VIEW in DB:', rows);
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
