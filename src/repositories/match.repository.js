'use strict';
const { pool } = require('../db/pool');

/** Public list: matches on sale that have not started yet. */
async function listOnSale(db = pool) {
  const { rows } = await db.query(`
    SELECT m.id, m.kickoff_at AS "kickoffAt", m.status,
           home.name AS "homeTeam", away.name AS "awayTeam",
           sd.name AS stadium, sd.city,
           MIN(p.price_cents)::int AS "minPriceCents"
    FROM matches m
    JOIN teams home    ON home.id = m.home_team_id
    JOIN teams away    ON away.id = m.away_team_id
    JOIN stadiums sd   ON sd.id = m.stadium_id
    LEFT JOIN match_stand_prices p ON p.match_id = m.id
    WHERE m.status = 'on_sale' AND m.kickoff_at > now()
    GROUP BY m.id, home.name, away.name, sd.name, sd.city
    ORDER BY m.kickoff_at`);
  return rows;
}

/** Raw row, used by business rules (status, date, stadium). */
async function findById(id, db = pool) {
  const { rows } = await db.query(
    `SELECT id, stadium_id AS "stadiumId", home_team_id AS "homeTeamId",
            away_team_id AS "awayTeamId", kickoff_at AS "kickoffAt", status
     FROM matches WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** Match details with names (for the public detail page). */
async function findDetails(id, db = pool) {
  const { rows } = await db.query(
    `SELECT m.id, m.kickoff_at AS "kickoffAt", m.status,
            home.name AS "homeTeam", away.name AS "awayTeam",
            sd.name AS stadium, sd.city
     FROM matches m
     JOIN teams home  ON home.id = m.home_team_id
     JOIN teams away  ON away.id = m.away_team_id
     JOIN stadiums sd ON sd.id = m.stadium_id
     WHERE m.id = $1`, [id]);
  return rows[0] || null;
}

/** For each stand: price, capacity, number of tickets already sold. */
async function getStandAvailability(matchId, db = pool) {
  const { rows } = await db.query(
    `SELECT s.id AS "standId", s.name, p.price_cents AS "priceCents",
            (SELECT count(*) FROM seats se WHERE se.stand_id = s.id)::int AS capacity,
            (SELECT count(*) FROM tickets t JOIN seats se ON se.id = t.seat_id
              WHERE t.match_id = $1 AND se.stand_id = s.id)::int AS sold
     FROM match_stand_prices p
     JOIN stands s ON s.id = p.stand_id
     WHERE p.match_id = $1
     ORDER BY s.id`, [matchId]);
  return rows;
}

/** Seat map of one stand for one match: each seat is free or sold. */
async function getSeatMap(matchId, standId, db = pool) {
  const { rows } = await db.query(
    `SELECT se.id AS "seatId", se.row_number AS "row", se.seat_number AS "number",
            (t.id IS NOT NULL) AS sold
     FROM seats se
     JOIN match_stand_prices p ON p.stand_id = se.stand_id AND p.match_id = $1
     LEFT JOIN tickets t ON t.seat_id = se.id AND t.match_id = $1
     WHERE se.stand_id = $2
     ORDER BY se.row_number, se.seat_number`, [matchId, standId]);
  return rows;
}

/** Which of these stands belong to the stadium? (consistency check for prices) */
async function countStandsOfStadium(stadiumId, standIds, db = pool) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM stands WHERE stadium_id = $1 AND id = ANY($2::int[])`,
    [stadiumId, standIds]);
  return rows[0].n;
}

async function teamsExist(ids, db = pool) {
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM teams WHERE id = ANY($1::int[])`, [ids]);
  return rows[0].n === new Set(ids).size;
}

async function stadiumExists(id, db = pool) {
  const { rows } = await db.query(`SELECT 1 FROM stadiums WHERE id = $1`, [id]);
  return rows.length === 1;
}

async function insert({ stadiumId, homeTeamId, awayTeamId, kickoffAt, status }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO matches (stadium_id, home_team_id, away_team_id, kickoff_at, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, stadium_id AS "stadiumId", home_team_id AS "homeTeamId",
               away_team_id AS "awayTeamId", kickoff_at AS "kickoffAt", status`,
    [stadiumId, homeTeamId, awayTeamId, kickoffAt, status]);
  return rows[0];
}

/** Inserts all the prices in one query using unnest on two parallel arrays. */
async function insertPrices(matchId, prices, db = pool) {
  await db.query(
    `INSERT INTO match_stand_prices (match_id, stand_id, price_cents)
     SELECT $1, p.stand_id, p.price_cents
     FROM unnest($2::int[], $3::int[]) AS p(stand_id, price_cents)`,
    [matchId, prices.map((p) => p.standId), prices.map((p) => p.priceCents)]);
}

async function update(id, { kickoffAt, status }, db = pool) {
  // COALESCE keeps the current value when a field is not provided.
  const { rows } = await db.query(
    `UPDATE matches
        SET kickoff_at = COALESCE($2, kickoff_at),
            status     = COALESCE($3, status)
      WHERE id = $1
      RETURNING id, kickoff_at AS "kickoffAt", status`,
    [id, kickoffAt ?? null, status ?? null]);
  return rows[0] || null;
}

/** Admin: every match, whatever its status, with the number of tickets sold. */
async function listAll(db = pool) {
  const { rows } = await db.query(`
    SELECT m.id, m.kickoff_at AS "kickoffAt", m.status,
           home.name AS "homeTeam", away.name AS "awayTeam", sd.name AS stadium,
           (SELECT count(*) FROM tickets t WHERE t.match_id = m.id)::int AS sold
    FROM matches m
    JOIN teams home  ON home.id = m.home_team_id
    JOIN teams away  ON away.id = m.away_team_id
    JOIN stadiums sd ON sd.id = m.stadium_id
    ORDER BY m.kickoff_at DESC`);
  return rows;
}

/** Admin: stadiums with their stands, and teams (to fill the "create a match" form). */
async function getReference(db = pool) {
  const stadiums = await db.query(`
    SELECT sd.id, sd.name, sd.city,
           json_agg(json_build_object('id', st.id, 'name', st.name) ORDER BY st.id) AS stands
    FROM stadiums sd JOIN stands st ON st.stadium_id = sd.id
    GROUP BY sd.id ORDER BY sd.name`);
  const teams = await db.query(`SELECT id, name, city FROM teams ORDER BY name`);
  return { stadiums: stadiums.rows, teams: teams.rows };
}

module.exports = {
  listAll, getReference,
  listOnSale, findById, findDetails, getStandAvailability, getSeatMap,
  countStandsOfStadium, teamsExist, stadiumExists, insert, insertPrices, update,
};
