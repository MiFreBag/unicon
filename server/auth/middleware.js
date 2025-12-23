const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-not-for-prod';

function verifyJWT(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, error: 'missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.user = payload; // { sub, email, roles }
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: 'invalid token' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    const ok = roles.length === 0 || roles.some(r => userRoles.includes(r));
    if (!ok) return res.status(403).json({ success: false, error: 'forbidden' });
    next();
  };
}

function issueJWT({ id, email, roles }) {
  const payload = { sub: id, email, roles };
  const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' });
  return token;
}

module.exports = { verifyJWT, requireRoles, issueJWT };