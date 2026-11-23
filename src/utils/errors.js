'use strict';
// One error class for every "expected" failure. The error handler turns it
// into a JSON response; anything else becomes a generic 500.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;     // stable, machine-readable (the front-end relies on it)
    this.details = details;
  }
}

const make = (status) => (code, message, details) => new AppError(status, code, message, details);

module.exports = {
  AppError,
  badRequest: make(400),
  unauthorized: make(401),
  forbidden: make(403),
  notFound: make(404),
  conflict: make(409),
  unprocessable: make(422),
};
