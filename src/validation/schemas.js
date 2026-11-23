'use strict';
const Joi = require('joi');
const config = require('../config/env');

const id = Joi.number().integer().positive();
// tlds.allow:false -> accepts any domain suffix (needed for admin@footix.test in demos)
const email = Joi.string().trim().lowercase().max(254).email({ tlds: { allow: false } });

// bcrypt only uses the first 72 bytes of a password: a longer limit would be misleading.
const password = Joi.string()
  .min(10)
  .max(72)
  .pattern(/^(?=.*[A-Za-z])(?=.*\d)/)
  .messages({ 'string.pattern.base': 'Password must contain at least one letter and one digit' });

module.exports = {
  idParam: Joi.object({ id: id.required() }),
  seatMapParams: Joi.object({ id: id.required(), sectorId: id.required() }),

  register: Joi.object({
    email: email.required(),
    password: password.required(),
    firstName: Joi.string().trim().min(1).max(80).required(),
    lastName: Joi.string().trim().min(1).max(80).required(),
    // no "role" key on purpose: it is stripped, everybody registers as a spectator
  }),

  login: Joi.object({
    email: email.required(),
    password: Joi.string().max(72).required(),
  }),

  createOrder: Joi.object({
    matchId: id.required(),
    seatIds: Joi.array().items(id).min(1).max(config.maxSeatsPerOrder).unique().required(),
  }),

  scan: Joi.object({
    token: Joi.string().trim().max(2000).required(),
  }),

  createMatch: Joi.object({
    stadiumId: id.required(),
    homeTeamId: id.required(),
    awayTeamId: id.required(),
    kickoffAt: Joi.date().iso().greater('now').required(),
    status: Joi.string().valid('draft', 'on_sale').default('draft'),
    prices: Joi.array()
      .items(Joi.object({ categoryId: id.required(), priceCents: Joi.number().integer().min(0).max(500000).required() }))
      .min(1)
      .unique('categoryId')
      .required(),
  }),

  updateMatch: Joi.object({
    kickoffAt: Joi.date().iso().greater('now'),
    status: Joi.string().valid('draft', 'on_sale', 'cancelled'),
  }).min(1),

  auditQuery: Joi.object({
    action: Joi.string().max(60),
    limit: Joi.number().integer().min(1).max(200).default(50),
  }),
};
