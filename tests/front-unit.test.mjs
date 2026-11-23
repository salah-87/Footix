// Unit tests of the browser helpers (pure functions, no DOM needed).
// Run with: npm run test:front   (Node's built-in test runner, ES modules)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeReturn, euros, ApiError } from '../public/js/common.js';
import { safeColor, textColor } from '../public/js/stadium.js';

test('safeReturn keeps a local path', () => {
  assert.equal(safeReturn('/match?id=1'), '/match?id=1');
  assert.equal(safeReturn('/billets'), '/billets');
});

test('safeReturn blocks open redirects to another site', () => {
  for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '', null, 42]) {
    assert.equal(safeReturn(bad), '/', `should refuse ${String(bad)}`);
  }
});

test('euros formats cents in French', () => {
  assert.equal(euros(2250).replace(/\s/g, ' '), '22,50 €');
  assert.equal(euros(0).replace(/\s/g, ' '), '0,00 €');
});

test('ApiError carries the HTTP status and the stable error code', () => {
  const err = new ApiError(409, 'SEAT_ALREADY_SOLD', 'Cette place vient d’être vendue.');
  assert.ok(err instanceof Error);
  assert.equal(err.status, 409);
  assert.equal(err.code, 'SEAT_ALREADY_SOLD');
});

test('safeColor only accepts #rrggbb colours (no CSS injection)', () => {
  assert.equal(safeColor('#C9A227'), '#C9A227');
  for (const bad of ['red', 'url(x)', '#fff', '#12345g', '#123456;background:url(x)']) {
    assert.equal(safeColor(bad), '#5a6681');
  }
});

test('textColor picks a readable text colour on each block colour', () => {
  assert.equal(textColor('#ffffff'), '#0b1f4b'); // dark text on a light block
  assert.equal(textColor('#0b1f4b'), '#ffffff'); // white text on a dark block
});
