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
 * Categories: 1 "CAT1" | 2 "VIP" | 3 "VISIT" (never priced: not sold online)
 * Seats (ids): sector 1 "N1" (stand Nord, CAT1) = 1..10 (2 rows x 5), seat 1 is PMR
 *              sector 2 "L1" (stand Sud, loge VIP) = 11..14
 *              sector 3 "E2" (stand Est, VISIT, no price) = 15..16
 *              sector 4 "X1" (OTHER stadium, CAT1) = 17..18
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
  await pool.query(
    `INSERT INTO stands (stadium_id, name, position) VALUES
      (1,'Nord','nord'),(1,'Sud','sud'),(1,'Est','est'),(2,'Autre stade','nord')`);
  await pool.query(
    `INSERT INTO seat_categories (code, name, description, color, sort_order) VALUES
      ('CAT1','Catégorie 1','Centre','#0b1f4b',2),
      ('VIP','Hospitalité VIP','Loge','#c5a253',1),
      ('VISIT','Parcage visiteurs','Club adverse','#5a6681',3)`);
  await pool.query(
    `INSERT INTO sectors (stand_id, category_id, code, name, tier, position_index) VALUES
      (1,1,'N1','Bloc N1','bas',1),(2,2,'L1','Loge 1','loge',1),
      (3,3,'E2','Parcage E2','bas',1),(4,1,'X1','Bloc X1','bas',1)`);
  await pool.query(
    `INSERT INTO seats (sector_id, row_number, seat_number, is_accessible)
     SELECT 1, r, n, (r = 1 AND n = 1) FROM generate_series(1,2) r, generate_series(1,5) n
     UNION ALL SELECT 2, 1, n, false FROM generate_series(1,4) n
     UNION ALL SELECT 3, 1, n, false FROM generate_series(1,2) n
     UNION ALL SELECT 4, 1, n, false FROM generate_series(1,2) n`);
  await pool.query(
    `INSERT INTO matches (stadium_id, home_team_id, away_team_id, kickoff_at, status) VALUES
      (1,1,2, now() + interval '7 days',  'on_sale'),
      (1,1,3, now() + interval '8 days',  'draft'),
      (1,2,3, now() + interval '9 days',  'cancelled'),
      (1,2,1, now() - interval '1 day',   'on_sale')`);
  await pool.query(
    `INSERT INTO match_category_prices (match_id, category_id, price_cents) VALUES
      (1,1,1000),(1,2,2500),(2,1,1000),(3,1,1000),(4,1,1000)`);
  await pool.end();
}

module.exports = { resetDb, PASSWORD, DAY };
