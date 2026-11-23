'use strict';
const { badRequest } = require('../utils/errors');

/**
 * Validates req[source] against a Joi schema.
 * - stripUnknown removes fields we did not declare (protects against mass assignment,
 *   e.g. a client sending { "role": "admin" } at registration)
 * - convert turns "12" into 12 for query strings and path parameters
 */
module.exports = (schema, source = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return next(badRequest('VALIDATION_ERROR', 'Invalid request data', details));
  }
  req[source] = value;
  return next();
};
