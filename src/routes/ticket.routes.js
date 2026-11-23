'use strict';
const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const schemas = require('../validation/schemas');
const ticketService = require('../services/ticket.service');

const router = express.Router();
router.use(authenticate);

router.get('/me', asyncHandler(async (req, res) => {
  res.json(await ticketService.listMyTickets(req.user.id));
}));

router.get('/:id/qr', validate(schemas.idParam, 'params'), asyncHandler(async (req, res) => {
  res.json(await ticketService.getTicketQr(req.user.id, req.params.id));
}));

module.exports = router;
