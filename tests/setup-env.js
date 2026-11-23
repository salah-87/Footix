'use strict';
// Loaded by Jest BEFORE each test file: the tests use their own database and secrets.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://footix:footix_dev@localhost:5432/footix_test';
process.env.MONGO_URL = '';            // no MongoDB in tests: audit logs are mocked/spied
process.env.JWT_SECRET = 'test-login-secret-test-login-secret-1234';
process.env.TICKET_SECRET = 'test-ticket-secret-test-ticket-secret-12';
process.env.BCRYPT_COST = '4';          // fast hashing in tests only
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
process.env.MAX_SEATS_PER_ORDER = '6';
