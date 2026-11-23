'use strict';
const jwt = require('jsonwebtoken');

/**
 * Signs and checks the token stored in a ticket's QR code: { tid: ticketId, mid: matchId }.
 * The signature proves that Footix issued the ticket: without the secret, nobody can
 * create a valid QR code. The secret is a private field (#secret), so no other module
 * can read it, log it or send it by mistake.
 */
class TicketSigner {
  #secret;
  #issuer;

  /**
   * @param {string} secret - HMAC key (its length is checked in config/env.js for production).
   * @param {string} [issuer='footix'] - Name written in every token and required when checking.
   */
  constructor(secret, issuer = 'footix') {
    if (typeof secret !== 'string' || secret.length === 0) {
      throw new TypeError('TicketSigner needs a non-empty secret');
    }
    this.#secret = secret;
    this.#issuer = issuer;
  }

  /**
   * @param {number} ticketId
   * @param {number} matchId
   * @returns {string} the signed token printed in the QR code
   */
  sign(ticketId, matchId) {
    return jwt.sign({ tid: ticketId, mid: matchId }, this.#secret, { algorithm: 'HS256', issuer: this.#issuer });
  }

  /**
   * @param {string} token - the text read from the QR code
   * @returns {{tid: number, mid: number}} the payload, only if the signature is valid
   * @throws {jwt.JsonWebTokenError} wrong signature, wrong algorithm (e.g. "none") or wrong issuer
   */
  verify(token) {
    return jwt.verify(token, this.#secret, { algorithms: ['HS256'], issuer: this.#issuer });
  }
}

module.exports = TicketSigner;
