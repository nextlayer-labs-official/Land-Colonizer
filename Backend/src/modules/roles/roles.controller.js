const prisma = require('../../lib/prisma');
const { auditLog } = require('../../lib/audit');

const permissionSelect = {
  id: true,
  code: true,
  module: { select: { name: true, slug: true } },
};

function mergePermissions(role, allPermissions) {
  const existing = new Map(role.rolePermissions.map((rp) => [rp.permission.id, rp.allowed]));
  return {
    ...role,
    rolePermissions: allPermissions.map((perm) => ({
      allowed: existing.get(perm.id) ?? false,
      permission: perm,
    })),
  };
}

const getRoles = async (_req, res) => {
  const [roles, allPermissions] = await Promise.all([
    prisma.role.findMany({
      select: {
        id: true, name: true, slug: true, description: true, is_system: true, created_at: true,
        rolePermissions: {
          select: { allowed: true, permission: { select: permissionSelect } },
        },
      },
      orderBy: { created_at: 'asc' },
    }),
    prisma.permission.findMany({
      select: permissionSelect,
      orderBy: [{ module_id: 'asc' }, { action: 'asc' }],
    }),
  ]);

  res.json(roles.map((role) => mergePermissions(role, allPermissions)));
};

const getRoleById = async (req, res) => {
  const [role, allPermissions] = await Promise.all([
    prisma.role.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        id: true, name: true, slug: true, description: true, is_system: true, created_at: true,
        rolePermissions: {
          select: { allowed: true, permission: { select: permissionSelect } },
        },
      },
    }),
    prisma.permission.findMany({
      select: permissionSelect,
      orderBy: [{ module_id: 'asc' }, { action: 'asc' }],
    }),
  ]);
  if (!role) return res.status(404).json({ message: 'Role not found' });
  res.json(mergePermissions(role, allPermissions));
};

const createRole = async (req, res) => {
  const { name, slug, description, permissions } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ message: 'Name and slug are required' });
  }

  const existing = await prisma.role.findFirst({ where: { OR: [{ name }, { slug }] } });
  if (existing) {
    return res.status(409).json({ message: 'Role name or slug already exists' });
  }

  const created = await prisma.role.create({
    data: {
      name, slug, description, is_system: false,
      ...(permissions?.length && {
        rolePermissions: {
          create: permissions.map(({ permission_id, allowed }) => ({
            permission_id: Number(permission_id),
            allowed: Boolean(allowed),
          })),
        },
      }),
    },
    select: { id: true },
  });

  const [role, allPermissions] = await Promise.all([
    prisma.role.findUnique({
      where: { id: created.id },
      select: {
        id: true, name: true, slug: true, description: true, is_system: true, created_at: true,
        rolePermissions: {
          select: { allowed: true, permission: { select: permissionSelect } },
        },
      },
    }),
    prisma.permission.findMany({
      select: permissionSelect,
      orderBy: [{ module_id: 'asc' }, { action: 'asc' }],
    }),
  ]);

  auditLog({ req, action: 'CREATE', entity: 'role', entityId: created.id, entityCode: slug });
  res.status(201).json(mergePermissions(role, allPermissions));
};

const updateRolePermissions = async (req, res) => {
  const roleId = Number(req.params.id);

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return res.status(404).json({ message: 'Role not found' });
  if (role.is_system) {
    return res.status(403).json({ message: 'System role permissions cannot be modified' });
  }

  const { permissions } = req.body;
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ message: 'permissions must be an array' });
  }

  await Promise.all(
    permissions.map(({ permission_id, allowed }) =>
      prisma.rolePermission.upsert({
        where:  { role_id_permission_id: { role_id: roleId, permission_id: Number(permission_id) } },
        update: { allowed },
        create: { role_id: roleId, permission_id: Number(permission_id), allowed },
      })
    )
  );

  auditLog({ req, action: 'UPDATE', entity: 'role', entityId: roleId, entityCode: role.slug });
  res.json({ message: 'Permissions updated successfully' });
};

const deleteRole = async (req, res) => {
  const roleId = Number(req.params.id);

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return res.status(404).json({ message: 'Role not found' });
  if (role.is_system) {
    return res.status(403).json({ message: 'System role cannot be deleted' });
  }

  const usersWithRole = await prisma.user.count({ where: { role_id: roleId } });
  if (usersWithRole > 0) {
    return res.status(409).json({ message: 'Cannot delete role with assigned users' });
  }

  await prisma.rolePermission.deleteMany({ where: { role_id: roleId } });
  await prisma.role.delete({ where: { id: roleId } });
  auditLog({ req, action: 'DELETE', entity: 'role', entityId: roleId, entityCode: role.slug });
  res.json({ message: 'Role deleted successfully' });
};

module.exports = { getRoles, getRoleById, createRole, updateRolePermissions, deleteRole };
