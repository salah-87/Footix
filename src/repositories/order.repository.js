'use strict';
const { pool } = require('../db/pool');

async function insertOrder(userId, totalCents, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO orders (user_id, total_cents) VALUES ($1, $2)
     RETURNING id, total_cents AS "totalCents", created_at AS "createdAt"`,
    [userId, totalCents]);
  return rows[0];
}

/**
 * Seats that exist, belong to the stadium of the match AND have a price for this match.
 * If a requested seat is missing from the result, it is not sellable for this match.
 */
async function findSellableSeats(matchId, seatIds, db = pool) {
  const { rows } = await db.query(
    `SELECT se.id AS "seatId", se.row_number AS "row", se.seat_number AS "number",
            st.name AS "standName", p.price_cents AS "priceCents"
     FROM seats se
     JOIN stands st ON st.id = se.stand_id
     JOIN matches m ON m.id = $1 AND m.stadium_id = st.stadium_id
     JOIN match_stand_prices p ON p.match_id = m.id AND p.stand_id = st.id
     WHERE se.id = ANY($2::int[])`,
    [matchId, seatIds]);
  return rows;
}

async function listByUser(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT o.id, o.total_cents AS "totalCents", o.created_at AS "createdAt",
            json_agg(json_build_object('id', t.id, 'matchId', t.match_id,
                     'seatId', t.seat_id, 'priceCents', t.price_cents, 'status', t.status)
                     ORDER BY t.id) AS tickets
     FROM orders o
     JOIN tickets t ON t.order_id = o.id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC, o.id DESC`, [userId]);
  return rows;
}

module.exports = { insertOrder, findSellableSeats, listByUser };
