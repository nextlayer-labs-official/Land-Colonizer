const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // ── Roles ────────────────────────────────────────────────────────────────────
  await prisma.role.createMany({
    data: [
      { name: 'Super Admin', slug: 'super-admin', description: 'Full unrestricted system access', is_system: true },
      { name: 'Admin',       slug: 'admin',       description: 'Full system access' },
      { name: 'Staff',       slug: 'staff',       description: 'Standard staff access' },
    ],
    skipDuplicates: true,
  });

  // ── Modules & Permissions ─────────────────────────────────────────────────────
  const moduleDefs = [
    { name: 'USER', slug: 'user', description: 'User management' },
    { name: 'ROLE', slug: 'role', description: 'Roles & permissions' },
  ];

  for (const mod of moduleDefs) {
    await prisma.module.upsert({
      where:  { slug: mod.slug },
      update: {},
      create: mod,
    });
  }

  const permissionDefs = [
    { module: 'user', action: 'VIEW',   code: 'USER_VIEW'   },
    { module: 'user', action: 'CREATE', code: 'USER_CREATE' },
    { module: 'user', action: 'EDIT',   code: 'USER_EDIT'   },
    { module: 'user', action: 'DELETE', code: 'USER_DELETE' },
    { module: 'role', action: 'VIEW',   code: 'ROLE_VIEW'   },
    { module: 'role', action: 'CREATE', code: 'ROLE_CREATE' },
    { module: 'role', action: 'EDIT',   code: 'ROLE_EDIT'   },
    { module: 'role', action: 'DELETE', code: 'ROLE_DELETE' },
  ];

  for (const pd of permissionDefs) {
    const mod = await prisma.module.findUnique({ where: { slug: pd.module } });
    await prisma.permission.upsert({
      where:  { code: pd.code },
      update: {},
      create: { module_id: mod.id, action: pd.action, code: pd.code },
    });
  }

  // ── Role Permissions ──────────────────────────────────────────────────────────
  const allPermissions = await prisma.permission.findMany();
  const roles          = await prisma.role.findMany();

  const rolePermMap = {
    'super-admin': () => true,
    'admin':       () => true,
    'staff': (code) => ['USER_VIEW'].includes(code),
  };

  for (const role of roles) {
    const allowed = rolePermMap[role.slug];
    if (!allowed) continue;
    for (const perm of allPermissions) {
      await prisma.rolePermission.upsert({
        where:  { role_id_permission_id: { role_id: role.id, permission_id: perm.id } },
        update: { allowed: allowed(perm.code) },
        create: { role_id: role.id, permission_id: perm.id, allowed: allowed(perm.code) },
      });
    }
  }

  // ── Super Admin User ──────────────────────────────────────────────────────────
  const superAdminRole = await prisma.role.findUnique({ where: { slug: 'super-admin' } });

  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@admin.com' } });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash('123456', 10);
    await prisma.user.create({
      data: {
        name:        'Super Admin',
        email:       'admin@admin.com',
        phone:       '9000000000',
        password:    hashed,
        role_id:     superAdminRole.id,
        is_verified: true,
        status:      'ACTIVE',
      },
    });
    console.log('Super Admin created → email: admin@admin.com  password: 123456');
  } else {
    console.log('Super Admin already exists, skipping.');
  }

  console.log('✓ Seeding completed.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
