'use strict';
const { pool } = require('../db/pool');

// Data access layer: the ONLY place that contains SQL.
// Every value goes through $1, $2... (parameterized queries): user input is never
// concatenated into the SQL text, which blocks SQL injection.

const COLUMNS = `id, email, password_hash AS "passwordHash",
                 first_name AS "firstName", last_name AS "lastName", role`;

async function findByEmail(email, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM users WHERE lower(email) = lower($1)`, [email]);
  return rows[0] || null;
}

async function findById(id, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** Role is NOT a parameter: a new account is always a spectator (column default). */
async function create({ email, passwordHash, firstName, lastName }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNS}`,
    [email, passwordHash, firstName, lastName]
  );
  return rows[0];
}

module.exports = { findByEmail, findById, create };
