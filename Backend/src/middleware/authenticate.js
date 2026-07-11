const jwt    = require('jsonwebtoken');
const prisma = require('../lib/prisma');

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        role: {
          select: {
            slug: true,
            is_system: true,
            rolePermissions: {
              where: { allowed: true },
              select: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });

    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.status === 'INACTIVE') return res.status(403).json({ message: 'Account is inactive' });

    req.user = {
      id:          user.id,
      name:        user.name,
      email:       user.email,
      role:        user.role.slug,
      is_system:   user.role.is_system,
      permissions: user.role.rolePermissions.map((rp) => rp.permission.code),
    };

    next();
  } catch {
    res.status(500).json({ message: 'Authentication error' });
  }
};
