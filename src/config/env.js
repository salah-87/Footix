'use strict';
// Central configuration. Every secret comes from environment variables,
// never from the source code (see .env.example).
require('dotenv').config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    // Fail fast: a server that starts without its secrets is a security risk.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required('DATABASE_URL'),
  mongoUrl: process.env.MONGO_URL || null, // optional: audit features are disabled without it
  jwtSecret: required('JWT_SECRET'),       // signs login tokens
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  ticketSecret: required('TICKET_SECRET'), // signs QR codes (different from jwtSecret on purpose)
  bcryptCost: Number(process.env.BCRYPT_COST) || 12,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5500',
  maxSeatsPerOrder: Number(process.env.MAX_SEATS_PER_ORDER) || 6,
  // Same limit per account AND per match, like big clubs (several orders cannot bypass it)
  maxTicketsPerMatch: Number(process.env.MAX_TICKETS_PER_MATCH) || 6,
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
};

if (config.env === 'production') {
  const weak = (s) => s.length < 32;
  if (weak(config.jwtSecret) || weak(config.ticketSecret)) {
    throw new Error('In production, JWT_SECRET and TICKET_SECRET must be at least 32 characters');
  }
  if (config.jwtSecret === config.ticketSecret) {
    throw new Error('JWT_SECRET and TICKET_SECRET must be different');
  }
}

module.exports = config;
