'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userRepo = require('../repositories/user.repository');
const audit = require('./audit.service');
const { conflict, unauthorized } = require('../utils/errors');

// A valid bcrypt hash of a random string. Used when the e-mail is unknown, so that
// the response time is the same whether the account exists or not (anti user-enumeration).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.bcryptCost);

const toPublicUser = (u) => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role });

function signAccessToken(user) {
  // Minimal payload: id (sub) and role. HS256 explicitly pinned.
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: config.jwtExpiresIn,
  });
}

async function register({ email, password, firstName, lastName }) {
  // Password hashing: bcrypt adds a random salt and is deliberately slow (cost factor).
  const passwordHash = await bcrypt.hash(password, config.bcryptCost);
  try {
    const user = await userRepo.create({ email, passwordHash, firstName, lastName });
    await audit.record('user.registered', { id: user.id, role: user.role });
    return toPublicUser(user);
  } catch (err) {
    // 23505 = unique_violation on users_email_lower_uq
    if (err.code === '23505') throw conflict('EMAIL_TAKEN', 'An account already exists with this e-mail');
    throw err;
  }
}

async function login({ email, password }) {
  const user = await userRepo.findByEmail(email);
  // Always run a comparison, even for an unknown e-mail (constant-ish time).
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !passwordOk) {
    // One generic message: never tell which of the two was wrong.
    throw unauthorized('INVALID_CREDENTIALS', 'Incorrect e-mail or password');
  }
  return { token: signAccessToken(user), user: toPublicUser(user) };
}

async function getProfile(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw unauthorized('INVALID_TOKEN', 'Invalid or expired token');
  return toPublicUser(user);
}

module.exports = { register, login, getProfile };
