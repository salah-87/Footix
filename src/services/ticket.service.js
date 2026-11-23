'use strict';
const QRCode = require('qrcode');
const config = require('../config/env');
const ticketRepo = require('../repositories/ticket.repository');
const audit = require('./audit.service');
const { notFound, badRequest, conflict } = require('../utils/errors');
const TicketSigner = require('../utils/TicketSigner');

// One signer for the whole application, built with the QR code secret (see TicketSigner).
const signer = new TicketSigner(config.ticketSecret);

const signTicketToken = (ticketId, matchId) => signer.sign(ticketId, matchId);
const verifyTicketToken = (token) => signer.verify(token);

const listMyTickets = (userId) => ticketRepo.listByUser(userId);

async function getTicketQr(userId, ticketId) {
  // Not found OR not yours -> same 404, so ticket ids cannot be probed.
  const ticket = await ticketRepo.findByIdForUser(ticketId, userId);
  if (!ticket) throw notFound('TICKET_NOT_FOUND', 'Ticket not found');
  const token = signTicketToken(ticket.id, ticket.matchId);
  const qrDataUrl = await QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 2 });
  // token = the QR code content, shown as text for people who cannot display the image
  return { ticket, qrDataUrl, token };
}

/**
 * Gate control. Order of the checks:
 *  1. signature valid?  2. ticket exists?  3. match not cancelled?  4. not already used (atomic)
 */
async function scanTicket(token, controller) {
  const log = (result, extra = {}) =>
    audit.recordScan({ controllerId: controller.id, result, ...extra });

  let payload;
  try {
    payload = verifyTicketToken(token);
  } catch (err) {
    await log('invalid_signature');
    throw badRequest('INVALID_TICKET', 'This QR code is not a valid Footix ticket');
  }

  const ticket = await ticketRepo.findForScan(payload.tid);
  if (!ticket || ticket.matchId !== payload.mid) {
    await log('unknown_ticket', { ticketId: payload.tid, matchId: payload.mid });
    throw notFound('UNKNOWN_TICKET', 'Ticket not found');
  }
  if (ticket.matchStatus === 'cancelled') {
    await log('match_cancelled', { ticketId: ticket.id, matchId: ticket.matchId });
    throw conflict('MATCH_CANCELLED', 'This match has been cancelled');
  }

  const consumed = await ticketRepo.markUsed(ticket.id, controller.id);
  if (!consumed) {
    await log('already_used', { ticketId: ticket.id, matchId: ticket.matchId });
    throw conflict('TICKET_ALREADY_USED', 'This ticket has already been used', { usedAt: ticket.usedAt });
  }
  await log('accepted', { ticketId: ticket.id, matchId: ticket.matchId });
  // A reduced-fare ticket is valid, but the controller must see the proof (ID, disability card).
  return { ticketId: ticket.id, matchId: ticket.matchId, result: 'accepted', tariff: ticket.tariff };
}

module.exports = { signTicketToken, verifyTicketToken, listMyTickets, getTicketQr, scanTicket };
