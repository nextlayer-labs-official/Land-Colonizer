const authorize = (permissionCode) => (req, res, next) => {
  if (!req.user) return res.status(403).json({ message: 'Forbidden' });

  if (req.user.is_system) return next();

  if (!req.user.permissions?.includes(permissionCode)) {
    return res.status(403).json({ message: `Permission denied: ${permissionCode}` });
  }

  next();
};

// Passes when the user has at least one of the given permissions
authorize.any = (...codes) => (req, res, next) => {
  if (!req.user) return res.status(403).json({ message: 'Forbidden' });
  if (req.user.is_system) return next();
  if (!codes.some(c => req.user.permissions?.includes(c))) {
    return res.status(403).json({ message: `Permission denied: ${codes.join(' or ')}` });
  }
  next();
};

module.exports = authorize;
