'use strict';
const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const schemas = require('../validation/schemas');
const orderService = require('../services/order.service');

const router = express.Router();
router.use(authenticate); // every order route requires a logged-in user

router.post('/', validate(schemas.createOrder), asyncHandler(async (req, res) => {
  // The buyer is ALWAYS taken from the token, never from the request body.
  res.status(201).json(await orderService.createOrder(req.user, req.body));
}));

router.get('/me', asyncHandler(async (req, res) => {
  res.json(await orderService.listMyOrders(req.user.id));
}));

module.exports = router;
