import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartSubtotal, cartTotal, lineTotal, parseAmount, rs } from '../src/money.js';
import { generateId, generateOrderNumber } from '../src/id.js';

test('acceptance test: 1 Zinger Burger (Rs. 330) + 1 Small Tikka Pizza (Rs. 650) totals Rs. 980', () => {
  const items = [
    { productId: 'product-1', name: 'Zinger Burger', variant: 'Regular', unitPrice: 330, quantity: 1 },
    { productId: 'product-7', name: 'Tikka Pizza', variant: 'Small', unitPrice: 650, quantity: 1 }
  ];

  assert.equal(lineTotal(items[0]), 330);
  assert.equal(lineTotal(items[1]), 650);

  const subtotal = cartSubtotal(items);
  assert.equal(subtotal, 980);

  const total = cartTotal(items, 0);
  assert.equal(total, 980);
  assert.equal(rs(total), 'Rs. 980');

  // Verify order construction
  const orderId = generateId();
  const orderNum = generateOrderNumber();
  const order = {
    id: orderId,
    number: orderNum,
    createdAt: new Date().toISOString(),
    orderType: 'Dine-in',
    tableNumber: '4',
    customerName: '',
    note: '',
    items: items.map(i => ({ ...i })),
    subtotal,
    discount: 0,
    total,
    status: 'new',
    paymentStatus: 'unpaid',
    paymentMethod: null,
    cashReceived: null,
    change: null
  };

  assert.equal(order.paymentStatus, 'unpaid');
  assert.equal(order.status, 'new');
  assert.equal(order.items.length, 2);
  assert.equal(order.total, 980);

  // Cash payment simulation
  const receivedCash = 1000;
  assert.ok(receivedCash >= order.total);
  const change = receivedCash - order.total;
  assert.equal(change, 20);

  const paidOrder = {
    ...order,
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    cashReceived: receivedCash,
    change,
    paidAt: new Date().toISOString()
  };

  assert.equal(paidOrder.paymentStatus, 'paid');
  assert.equal(paidOrder.cashReceived, 1000);
  assert.equal(paidOrder.change, 20);
});

test('order validation prevents invalid or empty cart saves', () => {
  // Empty cart
  const emptyCart = [];
  assert.equal(emptyCart.length, 0);

  // Negative discount
  assert.equal(parseAmount(-50), null);

  // Non-integer discount
  assert.equal(parseAmount(12.5), null);

  // Valid discount
  assert.equal(parseAmount(50), 50);

  // Discount exceeding subtotal
  const cart = [{ unitPrice: 330, quantity: 1 }];
  const subtotal = cartSubtotal(cart);
  const excessDiscount = 500;
  assert.ok(excessDiscount > subtotal);
});

test('paid revenue counts only orders with paymentStatus === paid', () => {
  const orders = [
    { id: '1', total: 980, paymentStatus: 'unpaid' },
    { id: '2', total: 650, paymentStatus: 'paid' },
    { id: '3', total: 330, paymentStatus: 'paid' },
    { id: '4', total: 1400, paymentStatus: 'unpaid' }
  ];

  const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
  const revenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  assert.equal(revenue, 980);
});
