'use strict';
// Minimal logger. Never log passwords, tokens or full request bodies.
const log = (level, message, meta) => {
  if (process.env.NODE_ENV === 'test') return;
  const line = { level, time: new Date().toISOString(), message, ...(meta ? { meta } : {}) };
  (level === 'error' ? console.error : console.log)(JSON.stringify(line));
};
module.exports = {
  info: (m, meta) => log('info', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  error: (m, meta) => log('error', m, meta),
};
