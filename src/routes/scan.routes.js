'use strict';
const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/authenticate');
const schemas = require('../validation/schemas');
const ticketService = require('../services/ticket.service');

const router = express.Router();

// Only gate staff (controller) and admins can scan.
router.post('/', authenticate, authorize('controller', 'admin'), validate(schemas.scan),
  asyncHandler(async (req, res) => {
    res.json(await ticketService.scanTicket(req.body.token, req.user));
  }));

module.exports = router;
