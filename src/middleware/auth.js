const { verifyToken } = require('../services/auth');

/**
 * Protects a route behind a valid JWT. Attaches { id, tenantId, role }
 * to req.user for downstream handlers, so every protected route can
 * scope its queries to req.user.tenantId — never trust a tenantId
 * passed in the request body/params instead.
 */
function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, tenantId: payload.tenantId, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
