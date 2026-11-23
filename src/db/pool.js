'use strict';
const { Pool } = require('pg');
const config = require('../config/env');
const logger = require('../utils/logger');

// A pool reuses a limited number of connections instead of opening one per request.
const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
pool.on('error', (err) => logger.error('Unexpected PostgreSQL error', { message: err.message }));

/**
 * Runs `work(client)` inside a SQL transaction.
 * Everything succeeds (COMMIT) or nothing is saved (ROLLBACK).
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} work
 * @returns {Promise<T>}
 */
async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // always give the connection back to the pool
  }
}

module.exports = { pool, withTransaction };
