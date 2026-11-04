import { test } from 'node:test';
import assert from 'node:assert/strict';
import { receiptDocument } from '../src/receipt.js';
const order = {
  number: 'MT-261018-ABC', createdAt: '2026-10-18T12:00:00+05:00',
  orderType: 'Dine-in', tableNumber: '04', customerName: '', note: 'No onions',
  items: [{ name:'Zinger Burger', variant:'Regular', quantity:2, unitPrice:330 }],
  subtotal:660, discount:10, total:650, paymentStatus:'unpaid', cashReceived:null, change:null
};

test('customer receipt has amount, price, and unpaid label', () => {
  const html = receiptDocument(order, 'customer');
  assert.match(html, /CUSTOMER BILL/);
  assert.match(html, /Rs. 650/);
  assert.match(html, /UNPAID/);
});
test('kitchen receipt includes food items and pricing as requested', () => {
  const html = receiptDocument(order, 'kitchen');
  assert.match(html, /Zinger Burger/);
  assert.match(html, /No onions/);
  assert.match(html, /Rs\. 650/);
  assert.match(html, /KITCHEN TICKET/);
});
test('receipt HTML safely escapes user-supplied text', () => {
  const html = receiptDocument({...order,note:'<script>alert("x")</script>'}, 'kitchen');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
test('58mm receipt uses full paper width, zero page margin and readable font size', () => {
  const html = receiptDocument(order, 'customer', 'MT Bites', '58mm');
  assert.match(html, /@page \{ size: 58mm auto; margin: 0; \}/);
  assert.match(html, /width: 100%/);
  assert.match(html, /font-size: 14px/);
  assert.doesNotMatch(html, /width: 50mm/);
});
test('printer dot widths match 58mm (384) and 80mm (576) thermal heads', async () => {
  const { receiptDotWidth } = await import('../src/receipt.js');
  assert.equal(receiptDotWidth('58mm'), 384);
  assert.equal(receiptDotWidth('80mm'), 576);
});
