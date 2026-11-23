'use strict';
// This file buys one ticket per gate scenario with the same account: it needs more than
// the 6 tickets per account and per match allowed in production (rule tested in fares-and-limits).
process.env.MAX_TICKETS_PER_MATCH = '50';
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { resetDb } = require('./helpers/db');
const { request, app, tokenFor, auth } = require('./helpers/api');
const { signTicketToken } = require('../src/services/ticket.service');
const audit = require('../src/services/audit.service');

let pool, fan, fan2, controller, admin;
beforeAll(async () => {
  await resetDb();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  [fan, fan2, controller, admin] = await Promise.all(['spectator', 'spectator2', 'controller', 'admin'].map(tokenFor));
});
afterAll(async () => { await pool.end(); });

/** Buys one seat and returns the ticket id. */
async function buyTicket(seatId, matchId = 1, token = fan) {
  const res = await request(app).post('/api/orders').set(auth(token)).send({ matchId, seatIds: [seatId] });
  expect(res.status).toBe(201);
  return res.body.tickets[0].id;
}
const scan = (token, body) => request(app).post('/api/scan').set(token ? auth(token) : {}).send(body);

describe('Ticket QR code', () => {
  test('the owner gets a PNG QR code', async () => {
    const id = await buyTicket(1);
    const res = await request(app).get(`/api/tickets/${id}/qr`).set(auth(fan));
    expect(res.status).toBe(200);
    expect(res.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(res.body.ticket).toMatchObject({ id, homeTeam: 'Team A', awayTeam: 'Team B' });
  });

  test("another user cannot get someone else's QR code (404, not 403)", async () => {
    const res = await request(app).get('/api/tickets/1/qr').set(auth(fan2));
    expect(res.status).toBe(404);
  });

  test('"my tickets" lists only my own tickets', async () => {
    const mine = await request(app).get('/api/tickets/me').set(auth(fan));
    const theirs = await request(app).get('/api/tickets/me').set(auth(fan2));
    expect(mine.body.length).toBeGreaterThan(0);
    expect(theirs.body).toHaveLength(0);
  });

  test('a ticket says where to go: stand, sector, category, row and seat', async () => {
    const mine = await request(app).get('/api/tickets/me').set(auth(fan));
    expect(mine.body[0]).toEqual(expect.objectContaining({
      standName: 'Nord', sectorCode: 'N1', sectorName: 'Bloc N1', categoryCode: 'CAT1', categoryName: 'Catégorie 1',
    }));
  });
});

describe('Gate control', () => {
  test('a spectator cannot scan (403) and an anonymous user gets 401', async () => {
    const id = await buyTicket(2);
    expect((await scan(fan, { token: signTicketToken(id, 1) })).status).toBe(403);
    expect((await scan(null, { token: signTicketToken(id, 1) })).status).toBe(401);
  });

  test('a controller accepts a valid ticket ONCE, then refuses it', async () => {
    const id = await buyTicket(3);
    const token = signTicketToken(id, 1);
    const spy = jest.spyOn(audit, 'recordScan');

    const first = await scan(controller, { token });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ticketId: id, result: 'accepted' });

    const second = await scan(controller, { token });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('TICKET_ALREADY_USED');

    const { rows } = await pool.query('SELECT status, used_by, used_at FROM tickets WHERE id = $1', [id]);
    expect(rows[0].status).toBe('used');
    expect(rows[0].used_by).toBe(2);
    expect(rows[0].used_at).not.toBeNull();
    expect(spy.mock.calls.map((c) => c[0].result)).toEqual(['accepted', 'already_used']);
    spy.mockRestore();
  });

  test('an admin can scan too', async () => {
    const id = await buyTicket(4);
    expect((await scan(admin, { token: signTicketToken(id, 1) })).status).toBe(200);
  });

  test('a QR code signed with another secret is refused (forgery)', async () => {
    const id = await buyTicket(5);
    const forged = jwt.sign({ tid: id, mid: 1 }, 'attacker-secret-attacker-secret-123', { issuer: 'footix' });
    const res = await scan(controller, { token: forged });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TICKET');
    const { rows } = await pool.query('SELECT status FROM tickets WHERE id = $1', [id]);
    expect(rows[0].status).toBe('valid'); // not consumed
  });

  test('a tampered QR code is refused (payload edited after signing)', async () => {
    const id = await buyTicket(6);
    const [h, p, s] = signTicketToken(id, 1).split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    payload.tid = id + 1; // try to use somebody else's ticket id
    const tampered = [h, Buffer.from(JSON.stringify(payload)).toString('base64url'), s].join('.');
    expect((await scan(controller, { token: tampered })).status).toBe(400);
  });

  test.each([
    ['random text', 'hello'],
    ['an "alg none" token', `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"tid":1,"mid":1}').toString('base64url')}.`],
  ])('refuses %s', async (_l, token) => {
    expect((await scan(controller, { token })).status).toBe(400);
  });

  test('refuses a correctly signed token that points to an unknown ticket or the wrong match', async () => {
    const id = await buyTicket(7);
    expect((await scan(controller, { token: signTicketToken(99999, 1) })).body.error.code).toBe('UNKNOWN_TICKET');
    expect((await scan(controller, { token: signTicketToken(id, 2) })).body.error.code).toBe('UNKNOWN_TICKET');
  });

  test('missing or wrongly typed token field -> 400', async () => {
    expect((await scan(controller, {})).status).toBe(400);
    expect((await scan(controller, { token: { $ne: null } })).status).toBe(400); // NoSQL-style injection attempt
  });

  test('10 simultaneous scans of the same ticket: exactly one is accepted', async () => {
    const id = await buyTicket(9);
    const token = signTicketToken(id, 1);
    const results = await Promise.all(Array.from({ length: 10 }, () => scan(controller, { token })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
  });

  test('a ticket of a cancelled match is refused', async () => {
    // create a new match through the admin API, buy a seat, cancel the match, then scan
    const create = await request(app).post('/api/admin/matches').set(auth(admin)).send({
      stadiumId: 1, homeTeamId: 1, awayTeamId: 3, kickoffAt: new Date(Date.now() + 5 * 864e5).toISOString(),
      status: 'on_sale', prices: [{ categoryId: 1, priceCents: 1500 }],
    });
    expect(create.status).toBe(201);
    const matchId = create.body.id;
    const id = await buyTicket(1, matchId); // seat 1 is free for this NEW match
    const cancel = await request(app).patch(`/api/admin/matches/${matchId}`).set(auth(admin)).send({ status: 'cancelled' });
    expect(cancel.status).toBe(200);
    const res = await scan(controller, { token: signTicketToken(id, matchId) });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_CANCELLED');
  });
});
