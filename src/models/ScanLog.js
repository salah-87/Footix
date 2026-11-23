'use strict';
const mongoose = require('mongoose');

// Every scan attempt at the stadium gate, accepted or not.
const scanLogSchema = new mongoose.Schema({
  ticketId:     { type: Number },
  matchId:      { type: Number, index: true },
  controllerId: { type: Number },
  result: {
    type: String,
    required: true,
    enum: ['accepted', 'already_used', 'invalid_signature', 'unknown_ticket', 'match_cancelled'],
  },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('ScanLog', scanLogSchema);
