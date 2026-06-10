function requireAuth(req, res, next) {
  if (req.session?.adminUser?.id) {
    return next();
  }

  return res.status(401).json({ message: 'Authentication required' });
}

function currentUser(req, res, next) {
  res.locals.adminUser = req.session?.adminUser || null;
  next();
}

module.exports = {
  requireAuth,
  currentUser
};
