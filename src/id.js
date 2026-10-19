/**
 * Collision-resistant, secure-context-independent ID generator for MT Bites POS.
 * 
 * Works in:
 * - Secure contexts (HTTPS, localhost): uses crypto.randomUUID where supported.
 * - Insecure contexts (HTTP over LAN, e.g. http://192.168.x.x:5173 on Android):
 *   falls back to crypto.getRandomValues if present, or high-precision timestamp + counter + random.
 * - Node.js testing environments.
 */

// Safe alphanumeric character set for human-readable codes (avoids 0/O and 1/I/l confusion)
const ALPHANUM = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

let counter = 0;

function resolveCrypto(explicitCrypto) {
  if (explicitCrypto !== undefined) return explicitCrypto;
  return typeof globalThis !== 'undefined' ? (globalThis.crypto || globalThis.msCrypto) : null;
}

/**
 * Generates random bytes across secure and insecure browser/Node contexts.
 * @param {number} length 
 * @param {object|null|undefined} customCrypto Optional custom crypto object for testing
 * @returns {Uint8Array}
 */
export function getRandomBytes(length, customCrypto) {
  const bytes = new Uint8Array(length);
  const cryptoObj = resolveCrypto(customCrypto);

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    try {
      return cryptoObj.getRandomValues(bytes);
    } catch {
      // Fall through to PRNG if getRandomValues fails
    }
  }

  // Fallback PRNG seeded with time, high-res performance, and monotonic counter
  for (let i = 0; i < length; i++) {
    counter = (counter + 1) & 0xffff;
    const time = Date.now() & 0xff;
    const perf = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? Math.floor(performance.now() * 1000) & 0xff
      : 0;
    const rand = Math.floor(Math.random() * 256);
    bytes[i] = (time ^ perf ^ counter ^ rand) & 0xff;
  }
  return bytes;
}

/**
 * Generates an RFC4122 v4 UUID string.
 * Secure-context independent: works even on http://192.168.x.x LAN addresses.
 * @param {object|null|undefined} customCrypto Optional custom crypto object for testing
 * @returns {string}
 */
export function generateId(customCrypto) {
  const cryptoObj = resolveCrypto(customCrypto);

  // Use native crypto.randomUUID only if available and functional
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    try {
      return cryptoObj.randomUUID();
    } catch {
      // Ignore and fallback below
    }
  }

  // RFC4122 version 4 UUID implementation using random bytes
  const bytes = getRandomBytes(16, customCrypto);
  // Set version to 0100 (v4)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant to 10xx (RFC4122)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generates a short, readable random code for receipts and order numbers.
 * @param {number} length 
 * @param {object|null|undefined} customCrypto Optional custom crypto object for testing
 * @returns {string}
 */
export function compactCode(length = 4, customCrypto) {
  const bytes = getRandomBytes(length, customCrypto);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHANUM[bytes[i] % ALPHANUM.length];
  }
  return result;
}

/**
 * Formats a local YYYY-MM-DD date key.
 * @param {Date} date 
 * @returns {string}
 */
export function localDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

/**
 * Generates a human-friendly, collision-resistant MT Bites order number.
 * Format: MT-YYMMDD-XXXX (e.g. MT-261018-7K2M)
 * @param {Date} date 
 * @param {object|null|undefined} customCrypto Optional custom crypto object for testing
 * @returns {string}
 */
export function generateOrderNumber(date = new Date(), customCrypto) {
  const d = date instanceof Date ? date : new Date(date);
  const datePart = localDateKey(d).replaceAll('-', '').slice(2);
  return `MT-${datePart}-${compactCode(4, customCrypto)}`;
}
