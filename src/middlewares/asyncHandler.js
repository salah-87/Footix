'use strict';
// Express 4 does not catch rejected promises by itself: this wrapper forwards them to next(err).
module.exports = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
