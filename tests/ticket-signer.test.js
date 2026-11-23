'use strict';
// Unit tests of the TicketSigner class: no database, no HTTP server.
const jwt = require('jsonwebtoken');
const TicketSigner = require('../src/utils/TicketSigner');

const SECRET = 'a-test-secret-of-at-least-32-characters';

describe('TicketSigner', () => {
  const signer = new TicketSigner(SECRET);

  test('a token it signed is accepted and gives back the ticket and the match', () => {
    const payload = signer.verify(signer.sign(12, 3));
    expect(payload).toMatchObject({ tid: 12, mid: 3, iss: 'footix' });
  });

  test('a token signed with another secret is refused', () => {
    const other = new TicketSigner('another-secret-of-at-least-32-characters');
    expect(() => signer.verify(other.sign(12, 3))).toThrow(jwt.JsonWebTokenError);
  });

  test('a modified token is refused (ticket id changed in the payload)', () => {
    const [header, , signature] = signer.sign(12, 3).split('.');
    const forged = Buffer.from(JSON.stringify({ tid: 13, mid: 3, iss: 'footix' })).toString('base64url');
    expect(() => signer.verify(`${header}.${forged}.${signature}`)).toThrow(jwt.JsonWebTokenError);
  });

  test('an unsigned token ("alg": "none") is refused', () => {
    const unsigned = jwt.sign({ tid: 12, mid: 3, iss: 'footix' }, null, { algorithm: 'none' });
    expect(() => signer.verify(unsigned)).toThrow(jwt.JsonWebTokenError);
  });

  test('a token from another issuer is refused', () => {
    const elsewhere = new TicketSigner(SECRET, 'other-app');
    expect(() => signer.verify(elsewhere.sign(12, 3))).toThrow(jwt.JsonWebTokenError);
  });

  test('the secret cannot be read from outside the object', () => {
    expect(signer.secret).toBeUndefined();
    expect(Object.keys(signer)).toEqual([]);
    expect(JSON.stringify(signer)).not.toContain(SECRET);
  });

  test('an empty secret is refused when the object is built', () => {
    expect(() => new TicketSigner('')).toThrow(TypeError);
    expect(() => new TicketSigner(undefined)).toThrow(TypeError);
  });
});
