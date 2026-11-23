'use strict';
const request = require('supertest');
const app = require('../../src/app');
const { PASSWORD } = require('./db');

const EMAILS = { spectator: 'fan@test.fr', spectator2: 'fan2@test.fr', controller: 'controle@test.fr', admin: 'admin@test.fr' };

/** Logs in through the real API and returns the bearer token. */
async function tokenFor(who) {
  const res = await request(app).post('/api/auth/login').send({ email: EMAILS[who], password: PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed for ${who}: ${res.status}`);
  return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { request, app, tokenFor, auth };
