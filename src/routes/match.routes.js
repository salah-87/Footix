'use strict';
const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const validate = require('../middlewares/validate');
const schemas = require('../validation/schemas');
const matchService = require('../services/match.service');

const router = express.Router();

// Public routes: browsing does not require an account.
router.get('/', asyncHandler(async (req, res) => {
  res.json(await matchService.listMatches());
}));

router.get('/:id', validate(schemas.idParam, 'params'), asyncHandler(async (req, res) => {
  res.json(await matchService.getMatchDetails(req.params.id));
}));

router.get('/:id/stands/:standId/seats', validate(schemas.seatMapParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await matchService.getSeatMap(req.params.id, req.params.standId));
}));

module.exports = router;
