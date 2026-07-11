module.exports = (permissionCode) => (req, res, next) => {
  if (!req.user) return res.status(403).json({ message: 'Forbidden' });

  if (req.user.is_system) return next();

  if (!req.user.permissions?.includes(permissionCode)) {
    return res.status(403).json({ message: `Permission denied: ${permissionCode}` });
  }

  next();
};
