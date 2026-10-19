import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, hasPermission } from '../src/auth.js';

test('hashPin produces consistent hash for same pin and salt', () => {
  const hash1 = hashPin('2026', 'admin_salt');
  const hash2 = hashPin('2026', 'admin_salt');
  assert.equal(hash1, hash2);
  assert.ok(hash1.length >= 8);
});

test('hashPin produces different hashes for different pins or salts', () => {
  const h1 = hashPin('2026', 'salt1');
  const h2 = hashPin('2027', 'salt1');
  const h3 = hashPin('2026', 'salt2');
  assert.notEqual(h1, h2);
  assert.notEqual(h1, h3);
});

test('hasPermission allows waiters to take orders and collect cash but not edit menu or view financials', () => {
  assert.equal(hasPermission('waiter', 'create_order'), true);
  assert.equal(hasPermission('waiter', 'view_orders'), true);
  assert.equal(hasPermission('waiter', 'collect_cash'), true);
  assert.equal(hasPermission('waiter', 'print_receipt'), true);

  // Forbidden for waiters
  assert.equal(hasPermission('waiter', 'edit_prices'), false);
  assert.equal(hasPermission('waiter', 'view_financials'), false);
  assert.equal(hasPermission('waiter', 'manage_staff'), false);
  assert.equal(hasPermission('waiter', 'delete_records'), false);
});

test('hasPermission grants full access to admin', () => {
  assert.equal(hasPermission('admin', 'create_order'), true);
  assert.equal(hasPermission('admin', 'edit_prices'), true);
  assert.equal(hasPermission('admin', 'view_financials'), true);
  assert.equal(hasPermission('admin', 'manage_staff'), true);
  assert.equal(hasPermission('admin', 'delete_records'), true);
});

test('brute-force lockout triggers after 5 failed attempts and clears on reset', async () => {
  const { recordFailedAttempt, getLockoutRemaining, clearFailedAttempts } = await import('../src/auth.js');
  const testUser = 'test_attacker_' + Date.now();

  // Initially not locked
  assert.equal(getLockoutRemaining(testUser), 0);

  // 4 failed attempts - not locked yet
  for (let i = 1; i <= 4; i++) {
    const res = recordFailedAttempt(testUser);
    assert.equal(res.attempts, i);
    assert.equal(res.lockedFor, 0);
    assert.equal(getLockoutRemaining(testUser), 0);
  }

  // 5th failed attempt triggers lockout
  const fifth = recordFailedAttempt(testUser);
  assert.equal(fifth.attempts, 5);
  assert.ok(fifth.lockedFor > 0);
  assert.ok(getLockoutRemaining(testUser) > 0);

  // Clear attempts unlocks the account
  clearFailedAttempts(testUser);
  assert.equal(getLockoutRemaining(testUser), 0);
});

