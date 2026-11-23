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
    LEFT JOIN match_category_prices p ON p.match_id = m.id
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

/**
 * Price categories of the stadium of a match, with the price for THIS match
 * (null = not sold online) and the number of seats left.
 */
async function getCategoryAvailability(matchId, db = pool) {
  const { rows } = await db.query(
    `SELECT c.id AS "categoryId", c.code, c.name, c.description, c.color,
            p.price_cents AS "priceCents",
            count(s.id)::int AS capacity,
            count(t.id)::int AS sold
     FROM matches m
     JOIN stands st          ON st.stadium_id = m.stadium_id
     JOIN sectors se         ON se.stand_id = st.id
     JOIN seat_categories c  ON c.id = se.category_id
     JOIN seats s            ON s.sector_id = se.id
     LEFT JOIN match_category_prices p ON p.match_id = m.id AND p.category_id = c.id
     LEFT JOIN tickets t     ON t.seat_id = s.id AND t.match_id = m.id
     WHERE m.id = $1
     GROUP BY c.id, p.price_cents
     ORDER BY c.sort_order, c.id`, [matchId]);
  return rows;
}

/** Every sector of the stadium, grouped later by stand, with what is left for this match. */
async function getSectorAvailability(matchId, db = pool) {
  const { rows } = await db.query(
    `SELECT st.id AS "standId", st.name AS "standName", st.position,
            se.id AS "sectorId", se.code, se.name, se.tier, se.position_index AS "positionIndex",
            se.category_id AS "categoryId",
            (p.price_cents IS NOT NULL) AS "onSale",
            count(s.id)::int AS capacity,
            count(t.id)::int AS sold,
            count(s.id) FILTER (WHERE s.is_accessible AND t.id IS NULL)::int AS "accessibleFree"
     FROM matches m
     JOIN stands st   ON st.stadium_id = m.stadium_id
     JOIN sectors se  ON se.stand_id = st.id
     JOIN seats s     ON s.sector_id = se.id
     LEFT JOIN match_category_prices p ON p.match_id = m.id AND p.category_id = se.category_id
     LEFT JOIN tickets t ON t.seat_id = s.id AND t.match_id = m.id
     WHERE m.id = $1
     GROUP BY st.id, se.id, p.price_cents
     ORDER BY st.id, se.tier, se.position_index`, [matchId]);
  return rows;
}

/**
 * One sector for one match, ONLY if it is in the match's stadium and its category
 * has a price for this match. null otherwise (not sold online).
 */
async function findSectorForMatch(matchId, sectorId, db = pool) {
  const { rows } = await db.query(
    `SELECT se.id AS "sectorId", se.code, se.name, se.tier,
            st.name AS "standName", st.position,
            c.id AS "categoryId", c.code AS "categoryCode", c.name AS "categoryName",
            c.description AS "categoryDescription", c.color AS "categoryColor",
            p.price_cents AS "priceCents"
     FROM sectors se
     JOIN stands st ON st.id = se.stand_id
     JOIN matches m ON m.id = $1 AND m.stadium_id = st.stadium_id
     JOIN seat_categories c ON c.id = se.category_id
     JOIN match_category_prices p ON p.match_id = m.id AND p.category_id = c.id
     WHERE se.id = $2`, [matchId, sectorId]);
  return rows[0] || null;
}

/** Seat map of one sector for one match: each seat is free or sold. */
async function getSeatMap(matchId, sectorId, db = pool) {
  const { rows } = await db.query(
    `SELECT s.id AS "seatId", s.row_number AS "row", s.seat_number AS "number",
            s.is_accessible AS accessible, (t.id IS NOT NULL) AS sold
     FROM seats s
     LEFT JOIN tickets t ON t.seat_id = s.id AND t.match_id = $1
     WHERE s.sector_id = $2
     ORDER BY s.row_number, s.seat_number`, [matchId, sectorId]);
  return rows;
}

/** How many of these categories are used by at least one sector of the stadium? */
async function countCategoriesOfStadium(stadiumId, categoryIds, db = pool) {
  const { rows } = await db.query(
    `SELECT count(DISTINCT se.category_id)::int AS n
     FROM sectors se JOIN stands st ON st.id = se.stand_id
     WHERE st.stadium_id = $1 AND se.category_id = ANY($2::int[])`,
    [stadiumId, categoryIds]);
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
    `INSERT INTO match_category_prices (match_id, category_id, price_cents)
     SELECT $1, p.category_id, p.price_cents
     FROM unnest($2::int[], $3::int[]) AS p(category_id, price_cents)`,
    [matchId, prices.map((p) => p.categoryId), prices.map((p) => p.priceCents)]);
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

/** Admin: stadiums with the price categories they contain, and teams (for the "create a match" form). */
async function getReference(db = pool) {
  const stadiums = await db.query(`
    SELECT sd.id, sd.name, sd.city,
           json_agg(json_build_object('id', c.id, 'code', c.code, 'name', c.name, 'color', c.color,
                                      'sectors', c.sectors)
                    ORDER BY c.sort_order) AS categories
    FROM stadiums sd
    JOIN LATERAL (
      SELECT c.id, c.code, c.name, c.color, c.sort_order, count(*)::int AS sectors
      FROM stands st JOIN sectors se ON se.stand_id = st.id JOIN seat_categories c ON c.id = se.category_id
      WHERE st.stadium_id = sd.id
      GROUP BY c.id) c ON true
    GROUP BY sd.id ORDER BY sd.name`);
  const teams = await db.query(`SELECT id, name, city FROM teams ORDER BY name`);
  return { stadiums: stadiums.rows, teams: teams.rows };
}

module.exports = {
  listAll, getReference,
  listOnSale, findById, findDetails, getCategoryAvailability, getSectorAvailability,
  findSectorForMatch, getSeatMap, countCategoriesOfStadium, teamsExist, stadiumExists, insert, insertPrices, update,
};
