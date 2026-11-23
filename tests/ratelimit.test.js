'use strict';
// This file needs its own limit: it is set BEFORE the app is loaded.
process.env.LOGIN_RATE_LIMIT_MAX = '3';
const { resetDb } = require('./helpers/db');
const { request, app } = require('./helpers/api');

beforeAll(resetDb);

test('brute force: the 4th login attempt in the window is blocked with 429', async () => {
  const attempt = () => request(app).post('/api/auth/login').send({ email: 'fan@test.fr', password: 'WrongPassword1' });
  const statuses = [];
  for (let i = 0; i < 5; i += 1) statuses.push((await attempt()).status);
  expect(statuses).toEqual([401, 401, 401, 429, 429]);
});
