import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const menu = JSON.parse(readFileSync(new URL('../src/menu-source.json', import.meta.url)));

test('all menu entries have reasonable prices and names', () => {
  // 122 original variants + 6 new items (Twister, Loaded Pasta, Pan Fries, Egg Fried Rice, Chicken Fried Rice, Family Platter) = 128
  assert.equal(menu.menu_items.length, 128);
  for (const item of menu.menu_items) {
    assert.ok(item.product_name && item.category);
    assert.ok(Number.isInteger(item.price_pkr) && item.price_pkr > 0);
  }
});
test('photo menu contains core sample prices', () => {
  const variant = (name, size) => menu.menu_items.find(i => i.product_name === name && i.variant === size);
  assert.equal(variant('Tikka Pizza', 'Small').price_pkr, 650);
  assert.equal(variant('Tikka Pizza', 'Large').price_pkr, 1400);
  assert.equal(variant('Plain Fries', 'Small').price_pkr, 200);
});
test('ambiguous entries are flagged for review', () => {
  assert.equal(menu.menu_items.filter(i => i.needs_confirmation).length, 4);
});
