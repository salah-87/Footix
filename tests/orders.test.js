'use strict';
const { Pool } = require('pg');
const { resetDb } = require('./helpers/db');
const { request, app, tokenFor, auth } = require('./helpers/api');
const audit = require('../src/services/audit.service');

let pool, fan, fan2;
beforeAll(async () => {
  await resetDb();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  fan = await tokenFor('spectator');
  fan2 = await tokenFor('spectator2');
});
afterAll(async () => { await pool.end(); });

const buy = (token, body) => request(app).post('/api/orders').set(token ? auth(token) : {}).send(body);
const ticketCount = async (seatId) =>
  (await pool.query('SELECT count(*)::int AS n FROM tickets WHERE match_id = 1 AND seat_id = $1', [seatId])).rows[0].n;

describe('Public catalogue', () => {
  test('lists only matches on sale that have not started', async () => {
    const res = await request(app).get('/api/matches');
    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.id)).toEqual([1]);
  });

  test('a draft match is invisible (404)', async () => {
    expect((await request(app).get('/api/matches/2')).status).toBe(404);
  });

  test('match details give price, capacity and availability per category', async () => {
    const res = await request(app).get('/api/matches/1');
    expect(res.status).toBe(200);
    // ordered like the ticket office: VIP first; the away section has no price
    expect(res.body.categories).toEqual([
      expect.objectContaining({ code: 'VIP', priceCents: 2500, capacity: 4, sold: 0, available: 4, onSale: true }),
      expect.objectContaining({ code: 'CAT1', priceCents: 1000, capacity: 10, sold: 0, available: 10, onSale: true }),
      expect.objectContaining({ code: 'VISIT', priceCents: null, onSale: false, available: 0 }),
    ]);
  });

  test('match details describe the stadium: stands, then sectors with their category', async () => {
    const res = await request(app).get('/api/matches/1');
    expect(res.body.stands.map((s) => [s.name, s.position])).toEqual([['Nord', 'nord'], ['Sud', 'sud'], ['Est', 'est']]);
    const n1 = res.body.stands[0].sectors[0];
    expect(n1).toEqual(expect.objectContaining({
      code: 'N1', tier: 'bas', categoryId: 1, onSale: true, capacity: 10, available: 10, accessibleFree: 1,
    }));
    expect(res.body.stands[2].sectors[0]).toEqual(expect.objectContaining({ code: 'E2', onSale: false, available: 0 }));
  });

  test('the seat map of a sector gives its category, its price and the PMR seats', async () => {
    const res = await request(app).get('/api/matches/1/sectors/1/seats');
    expect(res.status).toBe(200);
    expect(res.body.sector).toEqual(expect.objectContaining({ code: 'N1', categoryCode: 'CAT1', priceCents: 1000, standName: 'Nord' }));
    expect(res.body.seats).toHaveLength(10);
    expect(res.body.seats.filter((s) => s.accessible).map((s) => s.seatId)).toEqual([1]);
  });

  test.each([
    ['a sector whose category is not sold online', '/api/matches/1/sectors/3/seats'],
    ['a sector of another stadium', '/api/matches/1/sectors/4/seats'],
    ['a sector that does not exist', '/api/matches/1/sectors/999/seats'],
  ])('refuses the seat map of %s (404)', async (_label, url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SECTOR_NOT_FOUND');
  });

  test('a non-numeric id is rejected by validation', async () => {
    expect((await request(app).get('/api/matches/abc')).status).toBe(400);
    expect((await request(app).get("/api/matches/1;DROP TABLE tickets")).status).toBe(400);
  });
});

describe('Buying tickets', () => {
  test('requires authentication', async () => {
    const res = await buy(null, { matchId: 1, seatIds: [1] });
    expect(res.status).toBe(401);
  });

  test('creates an order; the price comes from the database, not from the client', async () => {
    const spy = jest.spyOn(audit, 'record');
    const res = await buy(fan, { matchId: 1, seatIds: [1, 11], priceCents: 1, totalCents: 1, userId: 4 });
    expect(res.status).toBe(201);
    expect(res.body.totalCents).toBe(1000 + 2500);
    expect(res.body.tickets).toHaveLength(2);
    expect(res.body.tickets).toEqual(expect.arrayContaining([
      expect.objectContaining({ sectorCode: 'N1', categoryName: 'Catégorie 1', row: 1, number: 1, priceCents: 1000 }),
      expect.objectContaining({ sectorCode: 'L1', categoryName: 'Hospitalité VIP', priceCents: 2500 }),
    ]));
    const owner = await pool.query('SELECT user_id FROM orders WHERE id = $1', [res.body.id]);
    expect(owner.rows[0].user_id).toBe(1); // taken from the token, not from the body (userId: 4 ignored)
    expect(spy).toHaveBeenCalledWith('order.created', expect.objectContaining({ id: 1 }), expect.any(Object));
    spy.mockRestore();
  });

  test('the order appears in "my orders" and the seat is now sold on the seat map', async () => {
    const mine = await request(app).get('/api/orders/me').set(auth(fan));
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);
    const map = await request(app).get('/api/matches/1/sectors/1/seats');
    expect(map.body.seats.find((s) => s.seatId === 1).sold).toBe(true);
    expect(map.body.seats.find((s) => s.seatId === 2).sold).toBe(false);
    const details = await request(app).get('/api/matches/1');
    expect(details.body.stands[0].sectors[0]).toEqual(expect.objectContaining({ available: 9, accessibleFree: 0 }));
  });

  test('another user cannot buy a seat that is already sold', async () => {
    const res = await buy(fan2, { matchId: 1, seatIds: [1] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SEAT_ALREADY_SOLD');
  });

  test('the order is all-or-nothing: a taken seat cancels the free one too (rollback)', async () => {
    const res = await buy(fan2, { matchId: 1, seatIds: [3, 1] }); // 3 is free, 1 is sold
    expect(res.status).toBe(409);
    expect(await ticketCount(3)).toBe(0);
    const orders = await pool.query('SELECT count(*)::int AS n FROM orders WHERE user_id = 4');
    expect(orders.rows[0].n).toBe(0); // the order row was rolled back as well
  });

  test.each([
    ['a seat of the away section (category with no price)', { matchId: 1, seatIds: [15] }],
    ['a seat of another stadium', { matchId: 1, seatIds: [17] }],
    ['a seat that does not exist', { matchId: 1, seatIds: [99999] }],
  ])('rejects %s with 422', async (_label, body) => {
    const res = await buy(fan, body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_SEATS');
  });

  test('refuses more than 6 seats, duplicates, empty lists and wrong types', async () => {
    expect((await buy(fan, { matchId: 1, seatIds: [2, 3, 4, 5, 6, 7, 8] })).status).toBe(400);
    expect((await buy(fan, { matchId: 1, seatIds: [2, 2] })).status).toBe(400);
    expect((await buy(fan, { matchId: 1, seatIds: [] })).status).toBe(400);
    expect((await buy(fan, { matchId: 1, seatIds: ['1 OR 1=1'] })).status).toBe(400);
    expect((await buy(fan, { matchId: 'x', seatIds: [2] })).status).toBe(400);
  });

  test('refuses a draft match, a started match and an unknown match', async () => {
    expect((await buy(fan, { matchId: 2, seatIds: [2] })).body.error.code).toBe('MATCH_NOT_ON_SALE');
    expect((await buy(fan, { matchId: 3, seatIds: [2] })).body.error.code).toBe('MATCH_NOT_ON_SALE');
    expect((await buy(fan, { matchId: 4, seatIds: [2] })).body.error.code).toBe('MATCH_ALREADY_STARTED');
    expect((await buy(fan, { matchId: 999, seatIds: [2] })).status).toBe(404);
  });
});

describe('Concurrency: the same seat bought by 15 requests at the same time', () => {
  test('exactly one request wins, all the others get 409, and the database holds ONE ticket', async () => {
    const seatId = 8;
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, i) => buy(i % 2 ? fan : fan2, { matchId: 1, seatIds: [seatId] }))
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(14);
    expect(await ticketCount(seatId)).toBe(1);
  });
});
