const prisma = require('../lib/prisma');

module.exports = (permissionCode) => async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(403).json({ message: 'Forbidden' });

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: { select: { slug: true, is_system: true } } },
    });

    if (!currentUser) return res.status(403).json({ message: 'Forbidden' });

    if (currentUser.role.is_system) return next();

    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role:       { slug: currentUser.role.slug },
        permission: { code: permissionCode },
        allowed:    true,
      },
    });

    if (!rolePermission) {
      return res.status(403).json({ message: `Permission denied: ${permissionCode}` });
    }

    next();
  } catch {
    res.status(500).json({ message: 'Authorization check failed' });
  }
};
