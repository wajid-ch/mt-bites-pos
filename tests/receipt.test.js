import { test } from 'node:test';
import assert from 'node:assert/strict';
import { receiptDocument, receiptDotWidth, generateReceiptPdf } from '../src/receipt.js';

const order = {
  number: 'MT-261018-ABC', createdAt: '2026-10-18T12:00:00+05:00',
  orderType: 'Dine-in', tableNumber: '04', customerName: '', note: 'No onions',
  items: [{ name:'Zinger Burger', variant:'Regular', quantity:2, unitPrice:330 }],
  subtotal:660, discount:10, total:650, paymentStatus:'unpaid', cashReceived:null, change:null
};

test('customer receipt has amount, price, and unpaid label', () => {
  const html = receiptDocument(order, 'customer');
  assert.match(html, /CUSTOMER BILL/);
  assert.match(html, /Rs\. 650/);
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

test('80mm and 58mm receipts span 100% full width without centered max-width shrinking', () => {
  const html80 = receiptDocument(order, 'customer', 'MT Bites', '80mm');
  assert.match(html80, /@page \{ size: 80mm auto; margin: 0; \}/);
  assert.match(html80, /width: 100%/);
  assert.doesNotMatch(html80, /max-width: 80mm/);
  assert.doesNotMatch(html80, /margin: 0 auto/);

  const html58 = receiptDocument(order, 'customer', 'MT Bites', '58mm');
  assert.match(html58, /@page \{ size: 58mm auto; margin: 0; \}/);
  assert.match(html58, /width: 100%/);
  assert.doesNotMatch(html58, /max-width: 58mm/);
});

test('generateReceiptPdf creates exact 80mm and 58mm roll width PDF documents', () => {
  const doc80 = generateReceiptPdf(order, 'customer', 'MT Bites', '80mm');
  assert.equal(Math.round(doc80.internal.pageSize.getWidth()), 80);

  const doc58 = generateReceiptPdf(order, 'kitchen', 'MT Bites', '58mm');
  assert.equal(Math.round(doc58.internal.pageSize.getWidth()), 58);
});

test('printer dot widths match 58mm (384) and 80mm (576) thermal heads', () => {
  assert.equal(receiptDotWidth('58mm'), 384);
  assert.equal(receiptDotWidth('80mm'), 576);
});
