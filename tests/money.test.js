import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartSubtotal, cartTotal, parseAmount, localDateKey } from '../src/money.js';
test('correct cart subtotal and discount', () => {
  const lines = [{ unitPrice: 330, quantity: 2 }, { unitPrice: 650, quantity: 1 }];
  assert.equal(cartSubtotal(lines), 1310);
  assert.equal(cartTotal(lines, 100), 1210);
});
test('bad or negative monetary amounts are rejected', () => {
  assert.equal(parseAmount(-1), null);
  assert.equal(parseAmount(2.5), null);
  assert.equal(parseAmount(250), 250);
});
test('date keys use local year-month-day', () => {
  assert.equal(localDateKey(new Date(2026, 9, 18)), '2026-10-18');
});
