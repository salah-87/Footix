'use strict';
const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/authenticate');
const schemas = require('../validation/schemas');
const matchService = require('../services/match.service');
const audit = require('../services/audit.service');

const router = express.Router();
router.use(authenticate, authorize('admin')); // the whole router is admin-only

router.get('/matches', asyncHandler(async (req, res) => {
  res.json(await matchService.listAllMatches());
}));

router.get('/reference', asyncHandler(async (req, res) => {
  res.json(await matchService.getReference());
}));

router.post('/matches', validate(schemas.createMatch), asyncHandler(async (req, res) => {
  res.status(201).json(await matchService.createMatch(req.body, req.user));
}));

router.patch('/matches/:id', validate(schemas.idParam, 'params'), validate(schemas.updateMatch),
  asyncHandler(async (req, res) => {
    res.json(await matchService.updateMatch(req.params.id, req.body, req.user));
  }));

router.get('/audit', validate(schemas.auditQuery, 'query'), asyncHandler(async (req, res) => {
  res.json(await audit.listAudit(req.query));
}));

router.get('/scans', validate(schemas.auditQuery, 'query'), asyncHandler(async (req, res) => {
  res.json(await audit.listScans(req.query));
}));

module.exports = router;
