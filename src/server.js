'use strict';
const config = require('./config/env');
const app = require('./app');
const { pool } = require('./db/pool');
const { connectMongo } = require('./db/mongo');
const logger = require('./utils/logger');

async function main() {
  await pool.query('SELECT 1'); // fail fast if PostgreSQL is unreachable
  connectMongo();               // NOT awaited on purpose: logs are secondary, the API must start even if MongoDB is slow or down
  const server = app.listen(config.port, () => logger.info(`Footix API listening on port ${config.port}`));

  // Graceful shutdown (docker stop sends SIGTERM)
  const stop = () => server.close(async () => { await pool.end(); process.exit(0); });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((err) => {
  logger.error('Startup failed', { message: err.message });
  process.exit(1);
});
