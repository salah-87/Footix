'use strict';
const mongoose = require('mongoose');

// NoSQL: flexible "details" document, high write volume, no joins needed.
const auditLogSchema = new mongoose.Schema({
  action:    { type: String, required: true, index: true }, // e.g. "order.created"
  actorId:   { type: Number },
  actorRole: { type: String },
  details:   { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
