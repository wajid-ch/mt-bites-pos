import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateId, generateOrderNumber, compactCode } from '../src/id.js';

test('generateId produces valid UUID v4 format in normal environment', () => {
  const id = generateId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('generateId works in insecure HTTP context when crypto.randomUUID is undefined', () => {
  // Simulate non-secure context (e.g. http://192.168.x.x where randomUUID is not exposed, only getRandomValues)
  const mockCrypto = {
    getRandomValues: (buf) => globalThis.crypto.getRandomValues(buf)
  };
  const id = generateId(mockCrypto);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('generateId works when neither randomUUID nor getRandomValues are present', () => {
  const id = generateId(null);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('generateId produces collision-free IDs across 1,000 iterations', () => {
  const set = new Set();
  for (let i = 0; i < 1000; i++) {
    const id = generateId();
    assert.equal(set.has(id), false, `Collision detected for ID: ${id}`);
    set.add(id);
  }
  assert.equal(set.size, 1000);
});

test('generateOrderNumber follows MT-YYMMDD-XXXX format without crypto.randomUUID', () => {
  const mockCrypto = {
    getRandomValues: (buf) => globalThis.crypto.getRandomValues(buf)
  };
  const date = new Date(2026, 9, 18); // Oct 18, 2026
  const orderNum = generateOrderNumber(date, mockCrypto);
  assert.match(orderNum, /^MT-261018-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
});

test('compactCode generates requested length with unambiguous characters', () => {
  const code = compactCode(6);
  assert.equal(code.length, 6);
  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
});
