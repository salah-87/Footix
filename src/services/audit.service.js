'use strict';
const AuditLog = require('../models/AuditLog');
const ScanLog = require('../models/ScanLog');
const { isMongoReady } = require('../db/mongo');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

// Logging must NEVER break the business operation: a ticket that was sold
// must stay sold even if MongoDB is down. So these functions swallow their errors.

/** Records a business event (who did what). */
async function record(action, actor, details = {}) {
  try {
    if (!isMongoReady()) return;
    await AuditLog.create({ action, actorId: actor?.id, actorRole: actor?.role, details });
  } catch (err) {
    logger.error('Audit log write failed', { action, message: err.message });
  }
}

/** Records one scan attempt at the gate. */
async function recordScan({ ticketId, matchId, controllerId, result }) {
  try {
    if (!isMongoReady()) return;
    await ScanLog.create({ ticketId, matchId, controllerId, result });
  } catch (err) {
    logger.error('Scan log write failed', { result, message: err.message });
  }
}

function assertReady() {
  if (!isMongoReady()) {
    throw new AppError(503, 'LOGS_UNAVAILABLE', 'Log storage is currently unavailable');
  }
}

async function listAudit({ action, limit }) {
  assertReady();
  // The filter is built from an object, never from a string: no NoSQL injection
  // as long as `action` was validated as a plain string (see Joi schema).
  const filter = action ? { action: String(action) } : {};
  return AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}

async function listScans({ limit }) {
  assertReady();
  return ScanLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = { record, recordScan, listAudit, listScans };
