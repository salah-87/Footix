'use strict';
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DAY = 24 * 3600 * 1000;
const PASSWORD = 'Passw0rd!test';

/**
 * Rebuilds an empty database from db/01_schema.sql and inserts a tiny, predictable dataset.
 *
 * Seats (ids): stand 1 "Nord" = 1..10 (2 rows x 5) | stand 2 "Sud" = 11..14
 *              stand 3 "Sans prix" = 15..16 (no price for match 1)
 *              stand 4 (OTHER stadium) = 17..18
 * Matches: 1 on sale (future) | 2 draft | 3 cancelled | 4 on sale but already started
 * Users:   1 spectator, 2 controller, 3 admin, 4 second spectator
 */
async function resetDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const hash = bcrypt.hashSync(PASSWORD, 4);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(fs.readFileSync(path.join(__dirname, '../../db/01_schema.sql'), 'utf8'));

  await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES
      ('fan@test.fr', $1, 'Fan', 'One', 'spectator'),
      ('controle@test.fr', $1, 'Ctrl', 'Gate', 'controller'),
      ('admin@test.fr', $1, 'Ad', 'Min', 'admin'),
      ('fan2@test.fr', $1, 'Fan', 'Two', 'spectator')`, [hash]);
  await pool.query(`INSERT INTO teams (name, city) VALUES ('Team A','A'),('Team B','B'),('Team C','C')`);
  await pool.query(`INSERT INTO stadiums (name, city) VALUES ('Main','X'),('Other','Y')`);
  await pool.query(`INSERT INTO stands (stadium_id, name) VALUES (1,'Nord'),(1,'Sud'),(1,'Sans prix'),(2,'Autre stade')`);
  await pool.query(
    `INSERT INTO seats (stand_id, row_number, seat_number)
     SELECT 1, r, n FROM generate_series(1,2) r, generate_series(1,5) n
     UNION ALL SELECT 2, 1, n FROM generate_series(1,4) n
     UNION ALL SELECT 3, 1, n FROM generate_series(1,2) n
     UNION ALL SELECT 4, 1, n FROM generate_series(1,2) n`);
  await pool.query(
    `INSERT INTO matches (stadium_id, home_team_id, away_team_id, kickoff_at, status) VALUES
      (1,1,2, now() + interval '7 days',  'on_sale'),
      (1,1,3, now() + interval '8 days',  'draft'),
      (1,2,3, now() + interval '9 days',  'cancelled'),
      (1,2,1, now() - interval '1 day',   'on_sale')`);
  await pool.query(
    `INSERT INTO match_stand_prices (match_id, stand_id, price_cents) VALUES
      (1,1,1000),(1,2,2500),(2,1,1000),(3,1,1000),(4,1,1000)`);
  await pool.end();
}

module.exports = { resetDb, PASSWORD, DAY };
