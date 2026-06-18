// Middlewares de protection des routes.

export function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.is_admin) {
    return res.status(403).render('error', {
      title: 'Accès refusé',
      message: "Cette page est réservée à l'administrateur.",
    });
  }
  next();
}

// Rend req.session.user disponible dans toutes les vues via `currentUser`.
export function injectUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.path = req.path;
  next();
}
