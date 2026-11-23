'use strict';
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { resetDb, PASSWORD } = require('./helpers/db');
const { request, app, tokenFor, auth } = require('./helpers/api');

let pool;
beforeAll(async () => { await resetDb(); pool = new Pool({ connectionString: process.env.DATABASE_URL }); });
afterAll(async () => { await pool.end(); });

const newUser = { email: 'new@test.fr', password: 'Str0ngPassword', firstName: 'New', lastName: 'User' };

describe('Registration', () => {
  test('creates a spectator and never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'new@test.fr', role: 'spectator' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
  });

  test('stores a bcrypt hash, not the password', async () => {
    const { rows } = await pool.query(`SELECT password_hash FROM users WHERE email = 'new@test.fr'`);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0].password_hash).not.toContain('Str0ngPassword');
  });

  test('ignores a "role: admin" sent by the client (mass assignment)', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...newUser, email: 'sneaky@test.fr', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('spectator');
    const { rows } = await pool.query(`SELECT role FROM users WHERE email = 'sneaky@test.fr'`);
    expect(rows[0].role).toBe('spectator');
  });

  test('refuses a duplicate e-mail, case-insensitively', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...newUser, email: 'NEW@test.fr' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test.each([
    ['too short', { password: 'Ab1' }],
    ['no digit', { password: 'OnlyLettersHere' }],
    ['too long for bcrypt (73 chars)', { password: 'a1'.repeat(37) }],
    ['invalid e-mail', { email: 'not-an-email' }],
    ['missing first name', { firstName: '' }],
  ])('rejects invalid data: %s', async (_label, patch) => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...newUser, email: 'x' + Math.random() + '@test.fr', ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Login and tokens', () => {
  test('valid credentials return a token and the profile', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'fan@test.fr', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: 'fan@test.fr', role: 'spectator' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  test('wrong password and unknown e-mail give the SAME answer (no user enumeration)', async () => {
    const wrongPwd = await request(app).post('/api/auth/login').send({ email: 'fan@test.fr', password: 'Wrong1234567' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@test.fr', password: 'Wrong1234567' });
    expect(wrongPwd.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPwd.body).toEqual(unknown.body);
    expect(wrongPwd.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('SQL injection in the e-mail field is rejected by validation', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: "' OR 1=1 --", password: 'x' });
    expect(res.status).toBe(400);
  });

  test('SQL injection in the password field does not log anyone in', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'fan@test.fr', password: "' OR '1'='1" });
    expect(res.status).toBe(401);
  });

  test('GET /me returns the current user', async () => {
    const token = await tokenFor('spectator');
    const res = await request(app).get('/api/auth/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('fan@test.fr');
  });
});

describe('Token verification', () => {
  const secret = process.env.JWT_SECRET;

  test('no token -> 401 MISSING_TOKEN', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  test.each([
    ['garbage', () => 'not.a.jwt'],
    ['signed with another secret', () => jwt.sign({ role: 'admin' }, 'another-secret-another-secret-1234', { subject: '3' })],
    ['expired', () => jwt.sign({ role: 'spectator' }, secret, { subject: '1', expiresIn: -10 })],
    ['alg "none" (unsigned)', () => {
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
      return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: '3', role: 'admin' })}.`;
    }],
  ])('rejects a token that is %s', async (_label, makeToken) => {
    const res = await request(app).get('/api/auth/me').set(auth(makeToken()));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});
