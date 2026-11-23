'use strict';
const mongoose = require('mongoose');
const config = require('../config/env');
const logger = require('../utils/logger');

/** Connects to MongoDB (audit and scan logs). Optional: the API still works without it. */
async function connectMongo() {
  if (!config.mongoUrl) {
    logger.warn('MONGO_URL not set: audit and scan logs are disabled');
    return false;
  }
  try {
    await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 5000 });
    logger.info('MongoDB connected');
    return true;
  } catch (err) {
    logger.error('MongoDB connection failed', { message: err.message });
    return false;
  }
}

const isMongoReady = () => mongoose.connection.readyState === 1;

module.exports = { connectMongo, isMongoReady };
