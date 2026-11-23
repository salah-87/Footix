'use strict';
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

// 404 for unknown routes
function notFoundHandler(req, res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found'));
}

// Last middleware: every error ends up here, with a consistent JSON shape.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }
  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
  }
  // Unexpected error: log the detail server-side, never send it to the client.
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}

module.exports = { notFoundHandler, errorHandler };
