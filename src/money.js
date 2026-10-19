import { generateId, generateOrderNumber, localDateKey as idLocalDateKey } from './id.js';

export { generateId, generateOrderNumber };

/** Store money as whole PKR rupees for this MVP; no fractional rupee menu prices. */
export const rs = (value) => `Rs. ${Math.round(Number(value) || 0).toLocaleString('en-PK')}`;

export const parseAmount = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
};

export const lineTotal = (item) => Math.round(Number(item.unitPrice || 0) * Number(item.quantity || 0));

export const cartSubtotal = (cart) => cart.reduce((sum, item) => sum + lineTotal(item), 0);

export const cartTotal = (cart, discount = 0) => Math.max(0, cartSubtotal(cart) - Math.max(0, Number(discount || 0)));

export const localDateKey = idLocalDateKey;

/**
 * Backward-compatible orderNumber export that does not fail in insecure contexts.
 */
export const orderNumber = (date = new Date()) => generateOrderNumber(date);

export const fmtDate = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(value);
  }
};
