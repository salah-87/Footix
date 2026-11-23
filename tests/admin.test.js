'use strict';
const { resetDb } = require('./helpers/db');
const { request, app, tokenFor, auth } = require('./helpers/api');

let fan, controller, admin;
beforeAll(async () => {
  await resetDb();
  [fan, controller, admin] = await Promise.all(['spectator', 'controller', 'admin'].map(tokenFor));
});

const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString();
const validMatch = () => ({
  stadiumId: 1, homeTeamId: 1, awayTeamId: 2, kickoffAt: inDays(20), status: 'draft',
  prices: [{ categoryId: 1, priceCents: 1800 }, { categoryId: 2, priceCents: 3000 }],
});

describe('Role-based access control', () => {
  test.each([
    ['POST', '/api/admin/matches'],
    ['PATCH', '/api/admin/matches/1'],
    ['GET', '/api/admin/audit'],
    ['GET', '/api/admin/scans'],
  ])('%s %s: anonymous 401, spectator 403, controller 403', async (method, url) => {
    const call = (token) => request(app)[method.toLowerCase()](url).set(token ? auth(token) : {}).send(validMatch());
    expect((await call(null)).status).toBe(401);
    expect((await call(fan)).status).toBe(403);
    expect((await call(controller)).status).toBe(403);
  });
});

describe('Admin: matches', () => {
  test('creates a match with its prices', async () => {
    const res = await request(app).post('/api/admin/matches').set(auth(admin)).send(validMatch());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'draft', stadiumId: 1 });
  });

  test('a draft stays hidden, then becomes visible once on sale', async () => {
    const created = await request(app).post('/api/admin/matches').set(auth(admin)).send(validMatch());
    const id = created.body.id;
    expect((await request(app).get(`/api/matches/${id}`)).status).toBe(404);
    const patch = await request(app).patch(`/api/admin/matches/${id}`).set(auth(admin)).send({ status: 'on_sale' });
    expect(patch.status).toBe(200);
    expect((await request(app).get(`/api/matches/${id}`)).status).toBe(200);
  });

  test.each([
    ['same team on both sides', (m) => ({ ...m, awayTeamId: m.homeTeamId }), 422, 'SAME_TEAM'],
    ['unknown team', (m) => ({ ...m, awayTeamId: 999 }), 422, 'UNKNOWN_TEAM'],
    ['unknown stadium', (m) => ({ ...m, stadiumId: 999 }), 422, 'UNKNOWN_STADIUM'],
    ['category with no sector in this stadium', (m) => ({ ...m, stadiumId: 2, prices: [{ categoryId: 2, priceCents: 1000 }] }), 422, 'INVALID_CATEGORY'],
    ['category that does not exist', (m) => ({ ...m, prices: [{ categoryId: 99, priceCents: 1000 }] }), 422, 'INVALID_CATEGORY'],
    ['date in the past', (m) => ({ ...m, kickoffAt: inDays(-2) }), 400, 'VALIDATION_ERROR'],
    ['negative price', (m) => ({ ...m, prices: [{ categoryId: 1, priceCents: -5 }] }), 400, 'VALIDATION_ERROR'],
    ['no prices', (m) => ({ ...m, prices: [] }), 400, 'VALIDATION_ERROR'],
    ['same category priced twice', (m) => ({ ...m, prices: [{ categoryId: 1, priceCents: 1 }, { categoryId: 1, priceCents: 2 }] }), 400, 'VALIDATION_ERROR'],
  ])('rejects %s', async (_l, mutate, status, code) => {
    const res = await request(app).post('/api/admin/matches').set(auth(admin)).send(mutate(validMatch()));
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  test('status transitions: on_sale cannot go back to draft; cancelled is final', async () => {
    const id = (await request(app).post('/api/admin/matches').set(auth(admin)).send({ ...validMatch(), status: 'on_sale' })).body.id;
    const back = await request(app).patch(`/api/admin/matches/${id}`).set(auth(admin)).send({ status: 'draft' });
    expect(back.status).toBe(409);
    expect(back.body.error.code).toBe('INVALID_TRANSITION');
    expect((await request(app).patch(`/api/admin/matches/${id}`).set(auth(admin)).send({ status: 'cancelled' })).status).toBe(200);
    const after = await request(app).patch(`/api/admin/matches/${id}`).set(auth(admin)).send({ status: 'on_sale' });
    expect(after.status).toBe(409);
    expect(after.body.error.code).toBe('MATCH_CANCELLED');
  });

  test('unknown match -> 404, empty update -> 400', async () => {
    expect((await request(app).patch('/api/admin/matches/9999').set(auth(admin)).send({ status: 'cancelled' })).status).toBe(404);
    expect((await request(app).patch('/api/admin/matches/1').set(auth(admin)).send({})).status).toBe(400);
  });
});

describe('Admin: logs (MongoDB)', () => {
  test('answers 503 LOGS_UNAVAILABLE when MongoDB is not connected, instead of crashing', async () => {
    const res = await request(app).get('/api/admin/audit').set(auth(admin));
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('LOGS_UNAVAILABLE');
  });
});

describe('HTTP hardening', () => {
  test('security headers are set and the framework is not advertised', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  test('malformed JSON -> 400 JSON error (no stack trace)', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
  });

  test('body larger than 10 kb -> 413', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.fr', password: 'x'.repeat(20000) });
    expect(res.status).toBe(413);
  });

  test('unknown route -> 404 JSON', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('Admin: data for the back-office screens', () => {
  test('lists every match, whatever its status, with tickets sold', async () => {
    const res = await request(app).get('/api/admin/matches').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.status)).toEqual(expect.arrayContaining(['draft', 'on_sale', 'cancelled']));
    expect(res.body[0]).toEqual(expect.objectContaining({ homeTeam: expect.any(String), sold: expect.any(Number) }));
  });

  test('gives stadiums with their price categories, and teams', async () => {
    const res = await request(app).get('/api/admin/reference').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.stadiums.find((s) => s.name === 'Main').categories.map((c) => c.code)).toEqual(['VIP', 'CAT1', 'VISIT']);
    expect(res.body.stadiums.find((s) => s.name === 'Other').categories.map((c) => c.code)).toEqual(['CAT1']);
    expect(res.body.teams).toHaveLength(3);
  });

  test('both routes are admin-only', async () => {
    expect((await request(app).get('/api/admin/matches').set(auth(fan))).status).toBe(403);
    expect((await request(app).get('/api/admin/reference').set(auth(controller))).status).toBe(403);
  });
});
