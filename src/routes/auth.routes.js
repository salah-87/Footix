'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const asyncHandler = require('../middlewares/asyncHandler');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const schemas = require('../validation/schemas');
const authService = require('../services/auth.service');

const router = express.Router();

// Brute-force protection: limited login attempts per IP and time window.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many login attempts, try again later' } },
});

router.post('/register', validate(schemas.register), asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json(user);
}));

router.post('/login', loginLimiter, validate(schemas.login), asyncHandler(async (req, res) => {
  res.json(await authService.login(req.body));
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json(await authService.getProfile(req.user.id));
}));

module.exports = router;
