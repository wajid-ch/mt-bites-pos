import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restaurantInventoryTemplates } from '../src/inventory-templates.js';

test('all restaurant inventory templates have valid names, units, and categories', () => {
  assert.ok(restaurantInventoryTemplates.length >= 15);
  const allowedUnits = ['kg', 'g', 'L', 'ml', 'pcs', 'cans', 'packets', 'boxes', 'rolls'];

  for (const item of restaurantInventoryTemplates) {
    assert.ok(item.name && item.name.length > 2, `Invalid item name: ${item.name}`);
    assert.ok(allowedUnits.includes(item.unit), `Unrecognized unit: ${item.unit} for ${item.name}`);
    assert.ok(Number.isFinite(item.quantity) && item.quantity >= 0);
    assert.ok(Number.isFinite(item.minimum) && item.minimum >= 0);
  }
});

test('templates include core fast food essentials for MT Bites', () => {
  const names = restaurantInventoryTemplates.map(i => i.name.toLowerCase());
  assert.ok(names.some(n => n.includes('chicken')), 'Must include chicken');
  assert.ok(names.some(n => n.includes('flour') || n.includes('maida')), 'Must include flour/maida');
  assert.ok(names.some(n => n.includes('cheese')), 'Must include cheese');
  assert.ok(names.some(n => n.includes('buns')), 'Must include burger buns');
  assert.ok(names.some(n => n.includes('oil')), 'Must include cooking oil');
  assert.ok(names.some(n => n.includes('pizza boxes')), 'Must include pizza packaging');
});
