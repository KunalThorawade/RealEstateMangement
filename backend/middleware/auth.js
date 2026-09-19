const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/auth');

function authorize(allowedRoles = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      console.error('Missing token');
      return res.status(401).json({ message: 'Missing token' });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      // role check
      if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
        console.error('Forbidden role', payload.role, 'needed:', allowedRoles);
        return res.status(403).json({ message: 'Forbidden' });
      }
      req.user = payload;
      next();
    } catch (err) {
      console.error('JWT verify error:', err.name, err.message);
      return res.status(401).json({ message: 'Invalid token', detail: err.message });
    }
  };
}

module.exports = { authorize };
