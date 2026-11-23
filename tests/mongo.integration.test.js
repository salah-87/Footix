'use strict';
// Integration test with a REAL MongoDB connection.
// Skipped unless MONGO_TEST_URL is set, e.g.  MONGO_TEST_URL=mongodb://localhost:27017/footix_test npm test
const MONGO_URL = process.env.MONGO_TEST_URL;
if (MONGO_URL) process.env.MONGO_URL = MONGO_URL;

const mongoose = require('mongoose');
const { resetDb } = require('./helpers/db');
const { request, app, tokenFor, auth } = require('./helpers/api');
const { connectMongo } = require('../src/db/mongo');
const AuditLog = require('../src/models/AuditLog');
const ScanLog = require('../src/models/ScanLog');
const { signTicketToken } = require('../src/services/ticket.service');

const maybe = MONGO_URL ? describe : describe.skip;

maybe('MongoDB: audit log and scan log', () => {
  let fan, controller, admin;
  beforeAll(async () => {
    await resetDb();
    expect(await connectMongo()).toBe(true);
    await Promise.all([AuditLog.deleteMany({}), ScanLog.deleteMany({})]);
    [fan, controller, admin] = await Promise.all(['spectator', 'controller', 'admin'].map(tokenFor));
  });
  afterAll(async () => { await mongoose.disconnect(); });

  let ticketId;
  test('registering and buying write audit events', async () => {
    await request(app).post('/api/auth/register')
      .send({ email: 'logs@test.fr', password: 'Str0ngPassword', firstName: 'L', lastName: 'G' });
    const order = await request(app).post('/api/orders').set(auth(fan)).send({ matchId: 1, seatIds: [1, 2] });
    expect(order.status).toBe(201);
    ticketId = order.body.tickets[0].id;

    const events = await AuditLog.find({}).lean();
    const actions = events.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['user.registered', 'order.created']));
    const created = events.find((e) => e.action === 'order.created');
    expect(created).toMatchObject({ actorId: 1, actorRole: 'spectator' });
    expect(created.details).toMatchObject({ matchId: 1, seatCount: 2, totalCents: 2000 });
    expect(JSON.stringify(events)).not.toMatch(/password/i); // no secret ever reaches the logs
  });

  test('every scan attempt is stored, accepted or not', async () => {
    const token = signTicketToken(ticketId, 1);
    await request(app).post('/api/scan').set(auth(controller)).send({ token });
    await request(app).post('/api/scan').set(auth(controller)).send({ token });
    await request(app).post('/api/scan').set(auth(controller)).send({ token: 'forged' });
    const results = (await ScanLog.find({}).sort({ createdAt: 1 }).lean()).map((s) => s.result);
    expect(results).toEqual(['accepted', 'already_used', 'invalid_signature']);
  });

  test('an admin reads the logs through the API, with a filter', async () => {
    const all = await request(app).get('/api/admin/audit').set(auth(admin));
    expect(all.status).toBe(200);
    expect(all.body.length).toBeGreaterThanOrEqual(2);
    const filtered = await request(app).get('/api/admin/audit?action=order.created').set(auth(admin));
    expect(filtered.body.every((e) => e.action === 'order.created')).toBe(true);
    const scans = await request(app).get('/api/admin/scans?limit=2').set(auth(admin));
    expect(scans.body).toHaveLength(2);
  });

  test('NoSQL injection attempt on the filter is rejected (400)', async () => {
    const res = await request(app).get('/api/admin/audit?action[$ne]=x').set(auth(admin));
    expect(res.status).toBe(400);
  });

  test('a spectator cannot read the logs', async () => {
    expect((await request(app).get('/api/admin/audit').set(auth(fan))).status).toBe(403);
  });
});
