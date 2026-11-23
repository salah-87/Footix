'use strict';
const { withTransaction } = require('../db/pool');
const matchRepo = require('../repositories/match.repository');
const orderRepo = require('../repositories/order.repository');
const ticketRepo = require('../repositories/ticket.repository');
const audit = require('./audit.service');
const { notFound, conflict, unprocessable } = require('../utils/errors');

/**
 * Core business rule: buy seats for a match WITHOUT ever selling a seat twice.
 *
 * Business rules (see docs/01-cahier-des-besoins.md):
 *  RG1 the match must be on sale and not started
 *  RG2 each seat must exist, belong to the stadium and have a price for this match
 *  RG3 a seat can be sold only once per match (enforced by the DATABASE)
 *  RG4 the order is all-or-nothing (transaction)
 *  RG5 at most N seats per order (validated before, see Joi schema)
 */
async function createOrder(user, { matchId, seatIds }) {
  try {
    const result = await withTransaction(async (client) => {
      // RG1
      const match = await matchRepo.findById(matchId, client);
      if (!match) throw notFound('MATCH_NOT_FOUND', 'Match not found');
      if (match.status !== 'on_sale') throw conflict('MATCH_NOT_ON_SALE', 'Tickets are not on sale for this match');
      if (new Date(match.kickoffAt) <= new Date()) throw conflict('MATCH_ALREADY_STARTED', 'This match has already started');

      // RG2: the price comes from the DATABASE, never from the client
      const seats = await orderRepo.findSellableSeats(matchId, seatIds, client);
      if (seats.length !== seatIds.length) {
        throw unprocessable('INVALID_SEATS', 'One or more seats do not exist or are not on sale for this match');
      }

      const totalCents = seats.reduce((sum, s) => sum + s.priceCents, 0);
      const order = await orderRepo.insertOrder(user.id, totalCents, client);

      // RG3 + RG4: if one seat is already taken, the INSERT fails and everything is rolled back
      const tickets = await ticketRepo.insertMany(order.id, matchId, seats, client);
      return { order, tickets, seats };
    });

    await audit.record('order.created', user, {
      orderId: result.order.id, matchId, seatCount: seatIds.length, totalCents: result.order.totalCents,
    });
    return {
      id: result.order.id,
      totalCents: result.order.totalCents,
      createdAt: result.order.createdAt,
      tickets: result.tickets.map((t) => {
        const seat = result.seats.find((s) => s.seatId === t.seatId);
        return { id: t.id, matchId, standName: seat.standName, row: seat.row, number: seat.number, priceCents: t.priceCents };
      }),
    };
  } catch (err) {
    // 23505 on our named constraint = someone else bought one of these seats a moment ago
    if (err.code === '23505' && err.constraint === 'tickets_match_seat_unique') {
      throw conflict('SEAT_ALREADY_SOLD', 'At least one of the selected seats has just been sold');
    }
    throw err;
  }
}

const listMyOrders = (userId) => orderRepo.listByUser(userId);

module.exports = { createOrder, listMyOrders };
