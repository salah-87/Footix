'use strict';
const { pool } = require('../db/pool');

/**
 * Creates all the tickets of an order in ONE statement.
 * If a (match, seat) pair already exists, PostgreSQL raises error 23505
 * (constraint tickets_match_seat_unique) and the whole transaction is rolled back.
 */
async function insertMany(orderId, matchId, seats, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO tickets (order_id, match_id, seat_id, price_cents)
     SELECT $1, $2, s.seat_id, s.price_cents
     FROM unnest($3::int[], $4::int[]) AS s(seat_id, price_cents)
     RETURNING id, seat_id AS "seatId", price_cents AS "priceCents", status`,
    [orderId, matchId, seats.map((s) => s.seatId), seats.map((s) => s.priceCents)]);
  return rows;
}

const SELECT_FOR_USER = `
  SELECT t.id, t.status, t.price_cents AS "priceCents",
         m.id AS "matchId", m.kickoff_at AS "kickoffAt", m.status AS "matchStatus",
         home.name AS "homeTeam", away.name AS "awayTeam",
         st.name AS "standName", se.row_number AS "row", se.seat_number AS "number"
  FROM tickets t
  JOIN orders o     ON o.id = t.order_id
  JOIN matches m    ON m.id = t.match_id
  JOIN teams home   ON home.id = m.home_team_id
  JOIN teams away   ON away.id = m.away_team_id
  JOIN seats se     ON se.id = t.seat_id
  JOIN stands st    ON st.id = se.stand_id`;

async function listByUser(userId, db = pool) {
  const { rows } = await db.query(`${SELECT_FOR_USER} WHERE o.user_id = $1 ORDER BY m.kickoff_at, t.id`, [userId]);
  return rows;
}

/** Ownership is part of the query: a user can never read someone else's ticket. */
async function findByIdForUser(ticketId, userId, db = pool) {
  const { rows } = await db.query(`${SELECT_FOR_USER} WHERE t.id = $1 AND o.user_id = $2`, [ticketId, userId]);
  return rows[0] || null;
}

async function findForScan(ticketId, db = pool) {
  const { rows } = await db.query(
    `SELECT t.id, t.match_id AS "matchId", t.status, t.used_at AS "usedAt",
            m.status AS "matchStatus"
     FROM tickets t JOIN matches m ON m.id = t.match_id
     WHERE t.id = $1`, [ticketId]);
  return rows[0] || null;
}

/**
 * Atomic "use once": the WHERE status = 'valid' makes the check and the update ONE operation.
 * With two simultaneous scans, only one UPDATE finds a 'valid' row; the other gets nothing.
 * @returns {Promise<boolean>} true if this call is the one that consumed the ticket
 */
async function markUsed(ticketId, controllerId, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE tickets SET status = 'used', used_at = now(), used_by = $2
     WHERE id = $1 AND status = 'valid'`, [ticketId, controllerId]);
  return rowCount === 1;
}

module.exports = { insertMany, listByUser, findByIdForUser, findForScan, markUsed };
