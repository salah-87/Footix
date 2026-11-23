'use strict';
// Rules added after studying the ticket offices of big clubs (docs/05-etude-billetteries.md):
//  - reduced fare: half price, never on VIP seats, proof checked at the gate (FC Bayern)
//  - at most 6 tickets per ACCOUNT for a match, whatever the number of orders (FC Barcelona, FC Bayern)
const { Pool } = require('pg');
const { resetDb } = require('./helpers/db');
const { request, app, tokenFor, auth } = require('./helpers/api');
const { signTicketToken } = require('../src/services/ticket.service');

let pool, fan, fan2, controller;
beforeAll(async () => {
  await resetDb();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  fan = await tokenFor('spectator');
  fan2 = await tokenFor('spectator2');
  controller = await tokenFor('controller');
});
afterAll(async () => { await pool.end(); });

const buy = (token, body) => request(app).post('/api/orders').set(auth(token)).send(body);

describe('Reduced fare', () => {
  let reducedTicketId;

  test('a reduced seat costs half price, computed by the server', async () => {
    // seats 2 and 3 are Catégorie 1 at 10,00 EUR; the client also sends a fake price (ignored)
    const res = await buy(fan, { matchId: 1, seatIds: [2, 3], reducedSeatIds: [3], totalCents: 1 });
    expect(res.status).toBe(201);
    expect(res.body.totalCents).toBe(1000 + 500);
    const reduced = res.body.tickets.find((t) => t.number === 3);
    expect(reduced).toEqual(expect.objectContaining({ tariff: 'reduit', priceCents: 500 }));
    expect(res.body.tickets.find((t) => t.number === 2)).toEqual(expect.objectContaining({ tariff: 'plein', priceCents: 1000 }));
    reducedTicketId = reduced.id;
    const row = await pool.query('SELECT price_cents, tariff FROM tickets WHERE id = $1', [reducedTicketId]);
    expect(row.rows[0]).toEqual({ price_cents: 500, tariff: 'reduit' });
  });

  test('"my tickets" shows the tariff', async () => {
    const mine = await request(app).get('/api/tickets/me').set(auth(fan));
    expect(mine.body.find((t) => t.id === reducedTicketId).tariff).toBe('reduit');
  });

  test('the gate accepts it and tells the controller to check the proof', async () => {
    const res = await request(app).post('/api/scan').set(auth(controller)).send({ token: signTicketToken(reducedTicketId, 1) });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ result: 'accepted', tariff: 'reduit' }));
  });

  test('no reduced fare on a VIP seat (422), and nothing is written', async () => {
    const res = await buy(fan2, { matchId: 1, seatIds: [11], reducedSeatIds: [11] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REDUCED_NOT_ALLOWED');
    const n = await pool.query('SELECT count(*)::int AS n FROM tickets WHERE seat_id = 11');
    expect(n.rows[0].n).toBe(0);
  });

  test('a reduced seat must be one of the seats bought (400)', async () => {
    const res = await buy(fan2, { matchId: 1, seatIds: [4], reducedSeatIds: [5] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('At most 6 tickets per account for a match', () => {
  test('several orders cannot go past the limit', async () => {
    // fan already holds 2 tickets (seats 2 and 3)
    expect((await buy(fan, { matchId: 1, seatIds: [4, 5, 6, 7] })).status).toBe(201); // 6 in total
    const res = await buy(fan, { matchId: 1, seatIds: [8] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TICKET_LIMIT_REACHED');
    expect(res.body.error.details).toEqual({ max: 6, alreadyBought: 6 });
  });

  test('two orders sent at the same moment by one account: only one goes through', async () => {
    // 3 + 4 = 7 seats > 6: without the lock on the user, both could pass the count
    const [a, b] = await Promise.all([
      buy(fan2, { matchId: 1, seatIds: [8, 9, 10] }),
      buy(fan2, { matchId: 1, seatIds: [11, 12, 13, 14] }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const held = await pool.query(
      `SELECT count(*)::int AS n FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE o.user_id = 4 AND t.match_id = 1`);
    expect(held.rows[0].n).toBeLessThanOrEqual(6);
  });

});
