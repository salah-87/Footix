'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { unauthorized, forbidden } = require('../utils/errors');

/**
 * Authentication: WHO is calling?
 * Expects "Authorization: Bearer <token>". On success, sets req.user = { id, role }.
 */
function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('MISSING_TOKEN', 'Authentication required'));
  }
  try {
    // The algorithm is pinned: refuses tokens signed with "none" or another algorithm.
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: Number(payload.sub), role: payload.role };
    return next();
  } catch (err) {
    // Same message for expired, malformed or forged tokens: no hint for an attacker.
    return next(unauthorized('INVALID_TOKEN', 'Invalid or expired token'));
  }
}

/**
 * Authorization: WHAT is this user allowed to do?
 * Usage: router.post('/x', authenticate, authorize('admin'), handler)
 */
const authorize = (...roles) => (req, res, next) =>
  req.user && roles.includes(req.user.role)
    ? next()
    : next(forbidden('FORBIDDEN', 'You do not have permission to perform this action'));

module.exports = { authenticate, authorize };
