import * as jspdfModule from 'jspdf';
import { fmtDate, rs, lineTotal } from './money.js';

const JsPDF = jspdfModule.jsPDF || jspdfModule.default?.jsPDF || jspdfModule.default;

/**
 * Generates native ESC/POS markup string for the Android "Thermer / Bluetooth Print"
 * app (`mate.bluetoothprint`) using its exact `<BAF>Content` tag specification:
 * - B (Bold): 0 = no, 1 = yes
 * - A (Align): 0 = left, 1 = center, 2 = right
 * - F (Format): 0 = normal, 1 = double Height, 2 = double Height + Width, 3 = double Width
 *
 * For 80mm thermal printers (SPEED-X SP-90A), standard Font A spans 48 characters per line
 * (or 32 characters for 58mm printers). Formatting columns across 48 chars prints natively
 * in the printer's built-in hardware font across 100% of the 80mm roll width!
 */
export function buildThermerString(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const kitchen = type === 'kitchen';
  const is58 = thermalWidth === '58mm';
  const lineChars = is58 ? 32 : 48; // 48 chars = full 80mm hardware width; 32 chars = full 58mm width
  const dashLine = '-'.repeat(lineChars);
  const eqLine = '='.repeat(lineChars);

  const clean = (s) =>
    String(s ?? '')
      .replace(/[<>]/g, '')
      .replace(/·/g, '-')
      .replace(/×/g, 'x')
      .trim();

  // Pad left and right text to fill the exact 48-character (80mm) or 32-character (58mm) line
  const lr = (left, right, width = lineChars) => {
    const l = clean(left);
    const r = clean(right);
    if (!r) return l;
    const space = width - l.length - r.length;
    if (space >= 1) {
      return l + ' '.repeat(space) + r;
    }
    // Wrap left text if too long
    const maxL = Math.max(10, width - r.length - 1);
    return l.slice(0, maxL) + ' ' + r;
  };

  // Format 3-column item row: ITEM | QTY | AMOUNT across full 48/32 chars
  const itemRow = (name, qty, amount, width = lineChars) => {
    const qStr = `${qty}x`.padEnd(4, ' ');
    const aStr = clean(amount).padStart(is58 ? 9 : 11, ' ');
    const nameWidth = width - qStr.length - aStr.length - 1;
    const cleanName = clean(name);
    const lines = [];
    for (let i = 0; i < cleanName.length; i += nameWidth) {
      const chunk = cleanName.slice(i, i + nameWidth);
      if (i === 0) {
        lines.push(qStr + chunk.padEnd(nameWidth, ' ') + ' ' + aStr);
      } else {
        lines.push('    ' + chunk);
      }
    }
    return lines.join('\n');
  };

  const parts = [];

  // 1. Restaurant Header (Bold=1, Align=1 Center, Format=2 Double Height+Width)
  parts.push(`<112>${clean(shopName || 'MT BITES').toUpperCase()}`);
  parts.push(`<110>KASHMIR - FAST FOOD POS`);
  parts.push(`<111>${kitchen ? '[ KITCHEN TICKET ]' : '[ CUSTOMER BILL ]'}`);
  parts.push(`<100>${eqLine}`);

  // 2. Order Meta (Bold=1, Align=0 Left, Format=0 Normal)
  parts.push(`<100>${lr(`Order: ${order.number || ''}`, fmtDate(order.createdAt))}`);
  const typeLabel = `Type: ${order.orderType || 'Dine-in'}${order.tableNumber ? ` (Table ${order.tableNumber})` : ''}`;
  parts.push(`<100>${lr(typeLabel, order.serverName ? `Staff: ${order.serverName}` : '')}`);
  if (order.customerName) {
    parts.push(`<100>Customer: ${clean(order.customerName)}`);
  }
  parts.push(`<100>${dashLine}`);

  // 3. Column Headers
  const hdrQty = 'QTY '.padEnd(4, ' ');
  const hdrAmt = 'AMOUNT'.padStart(is58 ? 9 : 11, ' ');
  const hdrItem = 'ITEM'.padEnd(lineChars - hdrQty.length - hdrAmt.length - 1, ' ');
  parts.push(`<100>${hdrQty}${hdrItem} ${hdrAmt}`);
  parts.push(`<100>${dashLine}`);

  // 4. Items
  for (const item of order.items || []) {
    if (kitchen) {
      // Extra tall text for kitchen readability (Format=1 Double Height)
      parts.push(`<101>${itemRow(item.name || 'Item', item.quantity || 1, rs(lineTotal(item)))}`);
    } else {
      parts.push(`<100>${itemRow(item.name || 'Item', item.quantity || 1, rs(lineTotal(item)))}`);
    }
    if (item.variant && item.variant !== 'Regular') {
      parts.push(`<000>    Size/Option: ${clean(item.variant)}`);
    }
  }

  parts.push(`<100>${dashLine}`);

  // 5. Kitchen Note
  if (order.note) {
    parts.push(`<101>NOTE: ${clean(order.note)}`);
    parts.push(`<100>${dashLine}`);
  }

  // 6. Totals
  parts.push(`<100>${lr('Subtotal:', rs(order.subtotal))}`);
  if (order.discount) {
    parts.push(`<100>${lr('Discount:', `-${rs(order.discount)}`)}`);
  }
  parts.push(`<100>${eqLine}`);

  // Grand Total in Double Height (Format=1)
  parts.push(`<101>${lr(kitchen ? 'ORDER TOTAL:' : 'NET TOTAL:', rs(order.total))}`);
  parts.push(`<100>${eqLine}`);

  // 7. Payment Status Banner (Centered, Double Height+Width)
  const statusBanner = kitchen
    ? '*** PREPARE ORDER NOW ***'
    : order.paymentStatus === 'paid'
      ? '*** CASH PAID ***'
      : '*** UNPAID ***';
  parts.push(`<111>${statusBanner}`);

  if (!kitchen && order.paymentStatus === 'paid' && order.cashReceived !== null && order.cashReceived !== undefined) {
    parts.push(`<100>${lr('Cash Received:', rs(order.cashReceived))}`);
    parts.push(`<100>${lr('Change Due:', rs(order.change))}`);
  }

  // 8. Footer
  parts.push(`<010> `);
  if (!kitchen) {
    parts.push(`<110>Thank you for choosing MT Bites!`);
    parts.push(`<010>Please visit again.`);
  } else {
    parts.push(`<110>MT Bites Kitchen Copy - ${order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}`);
  }
  parts.push(`<010> `);
  parts.push(`<010> `);

  return parts.join('\n');
}

/**
 * Builds the `JSON_FORCE_OBJECT` dictionary (`{ "000": { type: 0, content, bold, align, format }, ... }`)
 * used by Thermer's Browser Print feature on BOTH:
 * - iPhone / iOS (`bprint://<RESPONSEURL>`)
 * - Android (`my.bluetoothprint.scheme://<RESPONSEURL>`)
 *
 * CRITICAL FIXES based on real iPhone Thermer `WEB_PRINT` behavior:
 * 1. Zero-padded keys (`"000"`, `"001"`, ..., `"010"`): Thermer on iOS sorts dictionary keys
 *    alphabetically as strings (`"0"`, `"1"`, `"10"`, `"11"`, ..., `"2"`), which previously
 *    scrambled line 10 (Subtotal/Total) above line 2 (Kitchen Ticket / Items)!
 *    Zero-padded keys `"000"`, `"001"`, ..., `"025"` guarantee 100% strict top-to-bottom order!
 * 2. Non-breaking spaces (`\u00A0`): Thermer collapses multiple regular spaces (`'   '`) into a
 *    single space (`' '`), which squashed left-right columns together (`Subtotal: Rs. 330`).
 *    Using `\u00A0` preserves exact 2-column & 3-column receipt alignment across all 48 chars!
 */
export function buildThermerJsonObject(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const kitchen = type === 'kitchen';
  const is58 = thermalWidth === '58mm';
  // Thermer's default line width in WEB_PRINT is 32 chars (58mm) or 42/48 chars (80mm).
  // Using 32 chars for 58mm and 42 chars for 80mm prevents any line wrapping while keeping columns crisp.
  const lineChars = is58 ? 32 : 42;
  const nbsp = '\u00A0';
  const dashLine = '-'.repeat(lineChars);
  const eqLine = '='.repeat(lineChars);

  const clean = (s) =>
    String(s ?? '')
      .replace(/[<>]/g, '')
      .replace(/·/g, '-')
      .replace(/×/g, 'x')
      .trim();

  // Pad left and right text with non-breaking spaces (\u00A0) so Thermer never collapses column spacing
  const lr = (left, right, width = lineChars) => {
    const l = clean(left);
    const r = clean(right);
    if (!r) return l;
    const space = width - l.length - r.length;
    if (space >= 1) return l + nbsp.repeat(space) + r;
    const maxL = Math.max(10, width - r.length - 1);
    return l.slice(0, maxL) + nbsp + r;
  };

  // Format 3-column item row: QTY | ITEM | AMOUNT with \u00A0 column padding
  const itemRow = (name, qty, amount, width = lineChars) => {
    const qRaw = `${qty}x`;
    const qStr = qRaw + nbsp.repeat(Math.max(1, 4 - qRaw.length));
    const aRaw = clean(amount);
    const amtColW = is58 ? 9 : 11;
    const aStr = nbsp.repeat(Math.max(0, amtColW - aRaw.length)) + aRaw;
    const nameWidth = width - 4 - amtColW - 1;
    const cleanName = clean(name);
    const lines = [];
    for (let i = 0; i < cleanName.length; i += nameWidth) {
      const chunk = cleanName.slice(i, i + nameWidth);
      if (i === 0) {
        const paddedName = chunk + nbsp.repeat(Math.max(0, nameWidth - chunk.length));
        lines.push(`${qStr}${paddedName}${nbsp}${aStr}`);
      } else {
        lines.push(`${nbsp.repeat(4)}${chunk}`);
      }
    }
    return lines;
  };

  const entries = [];
  const addText = (content, bold = 1, align = 0, format = 0) => {
    entries.push({ type: 0, content: String(content), bold, align, format });
  };

  // 1. Header
  addText(clean(shopName || 'MT BITES').toUpperCase(), 1, 1, 2); // Double Height + Width, Centered
  addText('KASHMIR - FAST FOOD POS', 1, 1, 0);
  addText(kitchen ? '[ KITCHEN TICKET ]' : '[ CUSTOMER BILL ]', 1, 1, 1);
  addText(eqLine, 1, 1, 0);

  // 2. Meta (Clean separate lines so Order #, Date, Table, and Staff are super clear)
  addText(lr('Order #:', order.number || ''), 1, 0, 0);
  addText(lr('Date:', fmtDate(order.createdAt)), 0, 0, 0);
  const typeVal = `${order.orderType || 'Dine-in'}${order.tableNumber ? ` (Table ${order.tableNumber})` : ''}`;
  addText(lr('Type:', typeVal), 1, 0, 0);
  if (order.serverName) {
    addText(lr('Staff:', order.serverName), 0, 0, 0);
  }
  if (order.customerName) {
    addText(lr('Customer:', order.customerName), 1, 0, 0);
  }
  addText(dashLine, 1, 1, 0);

  // 3. Column Header
  const amtColW = is58 ? 9 : 11;
  const nameColW = lineChars - 4 - amtColW - 1;
  const hdr =
    `QTY${nbsp}` +
    `ITEM${nbsp.repeat(Math.max(0, nameColW - 4))}` +
    `${nbsp}` +
    `${nbsp.repeat(Math.max(0, amtColW - 6))}AMOUNT`;
  addText(hdr, 1, 0, 0);
  addText(dashLine, 1, 1, 0);

  // 4. Items
  for (const item of order.items || []) {
    const lines = itemRow(item.name || 'Item', item.quantity || 1, rs(lineTotal(item)));
    for (const ln of lines) {
      addText(ln, 1, 0, 0);
    }
    if (item.variant && item.variant !== 'Regular') {
      addText(`${nbsp.repeat(4)}(${clean(item.variant)})`, 0, 0, 0);
    }
  }
  addText(dashLine, 1, 1, 0);

  // 5. Note
  if (order.note) {
    addText(`KITCHEN NOTE: ${clean(order.note)}`, 1, 0, 0);
    addText(dashLine, 1, 1, 0);
  }

  // 6. Totals
  addText(lr('Subtotal:', rs(order.subtotal)), 1, 0, 0);
  if (order.discount) {
    addText(lr('Discount:', `-${rs(order.discount)}`), 1, 0, 0);
  }
  addText(eqLine, 1, 1, 0);
  addText(lr(kitchen ? 'ORDER TOTAL:' : 'NET TOTAL:', rs(order.total)), 1, 1, 1);
  addText(eqLine, 1, 1, 0);

  // 7. Payment Status
  const statusBanner = kitchen
    ? '*** PREPARE ORDER NOW ***'
    : order.paymentStatus === 'paid'
      ? '*** CASH PAID ***'
      : '*** UNPAID ***';
  addText(statusBanner, 1, 1, 1);

  if (!kitchen && order.paymentStatus === 'paid' && order.cashReceived !== null && order.cashReceived !== undefined) {
    addText(lr('Cash Received:', rs(order.cashReceived)), 1, 0, 0);
    addText(lr('Change Due:', rs(order.change)), 1, 0, 0);
  }

  // 8. Footer
  if (!kitchen) {
    addText('Thank you for choosing MT Bites!', 1, 1, 0);
    addText('Please visit again.', 0, 1, 0);
  } else {
    addText(`MT Bites Kitchen Copy - ${order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}`, 1, 1, 0);
  }
  addText(' ', 0, 0, 0);

  // Convert to JSON_FORCE_OBJECT dictionary with zero-padded keys ("000", "001", "002"...)
  // so alphabetical key sorting in iOS Thermer preserves exact top-to-bottom receipt order!
  const forcedObj = {};
  entries.forEach((entry, idx) => {
    const paddedKey = String(idx).padStart(3, '0');
    forcedObj[paddedKey] = entry;
  });
  return forcedObj;
}

function toBase64Url(str) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Builds the `bprint://<RESPONSEURL>` (iPhone/iOS) and `my.bluetoothprint.scheme://<RESPONSEURL>`
 * (Android) Browser Print deep links that Thermer fetches JSON from.
 */
export function buildThermerSchemeUrls(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const jsonObj = buildThermerJsonObject(order, type, shopName, thermalWidth);
  const encoded = toBase64Url(JSON.stringify(jsonObj));
  const origin =
    typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://mtbites.netlify.app';
  const responseUrl = `${origin}/api/thermer-print?d=${encoded}`;
  return {
    responseUrl,
    iosUrl: `bprint://${responseUrl}`,
    androidSchemeUrl: `my.bluetoothprint.scheme://${responseUrl}`
  };
}

/**
 * Builds the direct Android `intent://` URI that launches the Thermer / Bluetooth Print
 * app (`mate.bluetoothprint`) with `ACTION_SEND` and `EXTRA_TEXT` populated with the
 * `<BAF>` formatted string.
 */
export function buildThermerIntentUrl(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const payload = buildThermerString(order, type, shopName, thermalWidth);
  const encodedText = encodeURIComponent(payload);
  return `intent:#Intent;action=android.intent.action.SEND;type=text/plain;package=mate.bluetoothprint;S.android.intent.extra.TEXT=${encodedText};end`;
}

/**
 * Sends the `<BAF>` formatted receipt directly to the Thermer (`mate.bluetoothprint`)
 * app on Android using the native Web Share API (`navigator.share({ text })`), which
 * triggers Android's native `Intent.ACTION_SEND` (`text/plain` + `EXTRA_TEXT`) WITHOUT
 * Chrome redirecting to the Play Store!
 */
export async function sendToThermerApp(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const payload = buildThermerString(order, type, shopName, thermalWidth);

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        text: payload
      });
      return 'shared-text';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      console.warn('navigator.share failed, copying to clipboard instead:', err);
    }
  }

  // Fallback if browser doesn't support navigator.share: copy to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(payload);
      return 'copied';
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  }
  return 'unsupported';
}

/**
 * Builds the `JSON_FORCE_OBJECT` dictionary (`{ "000": ..., "001": ... }`) for
 * Inventory + Recent Stock Movement Logs so it prints cleanly via Thermer on
 * iPhone (`bprint://`) and Android (`my.bluetoothprint.scheme://`).
 */
export function buildInventoryThermerJsonObject(
  items = [],
  movements = [],
  shopName = 'MT Bites',
  thermalWidth = '80mm',
  categoryFilter = 'All'
) {
  const is58 = thermalWidth === '58mm';
  const lineChars = is58 ? 32 : 42;
  const nbsp = '\u00A0';
  const dashLine = '-'.repeat(lineChars);
  const eqLine = '='.repeat(lineChars);

  const clean = (s) =>
    String(s ?? '')
      .replace(/[<>]/g, '')
      .replace(/·/g, '-')
      .replace(/×/g, 'x')
      .trim();

  const lr = (left, right, width = lineChars) => {
    const l = clean(left);
    const r = clean(right);
    if (!r) return l;
    const space = width - l.length - r.length;
    if (space >= 1) return l + nbsp.repeat(space) + r;
    const maxL = Math.max(10, width - r.length - 1);
    return l.slice(0, maxL) + nbsp + r;
  };

  const entries = [];
  const addText = (content, bold = 1, align = 0, format = 0) => {
    entries.push({ type: 0, content: String(content), bold, align, format });
  };

  const lowCount = items.filter(i => Number(i.quantity || 0) <= Number(i.minimum || 0)).length;
  addText(clean(shopName || 'MT BITES').toUpperCase(), 1, 1, 2);
  addText('INVENTORY & STOCK LOGS', 1, 1, 1);
  addText(eqLine, 1, 1, 0);
  addText(lr('Printed:', fmtDate(new Date().toISOString())), 0, 0, 0);
  addText(lr('Category:', categoryFilter || 'All'), 1, 0, 0);
  addText(lr(`Items: ${items.length}`, `Low Stock: ${lowCount}`), 1, 0, 0);
  addText(dashLine, 1, 1, 0);

  addText(lr('ITEM', 'STOCK'), 1, 0, 0);
  addText(dashLine, 1, 1, 0);

  if (items.length === 0) {
    addText('No items in this category.', 0, 1, 0);
  } else {
    for (const item of items) {
      const qtyNum = Number(item.quantity || 0);
      const minNum = Number(item.minimum || 0);
      const tag = qtyNum <= 0 ? ' [OUT]' : qtyNum <= minNum ? ' [LOW]' : '';
      addText(lr(`${item.name}${tag}`, `${qtyNum} ${item.unit || ''}`), 1, 0, 0);
    }
  }

  const byId = new Map(items.map(i => [i.id, i]));
  const recentMovs = [...movements]
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 15);

  addText(eqLine, 1, 1, 0);
  addText('RECENT STOCK MOVEMENTS', 1, 1, 0);
  addText(dashLine, 1, 1, 0);

  if (recentMovs.length === 0) {
    addText('No stock movements recorded.', 0, 1, 0);
  } else {
    for (const m of recentMovs) {
      const itemObj = byId.get(m.itemId);
      const itemName = itemObj?.name || 'Item';
      const deltaStr = m.delta > 0 ? `+${m.delta}` : `${m.delta}`;
      addText(lr(itemName, `${deltaStr} ${itemObj?.unit || ''}`), 1, 0, 0);
      addText(`  ${clean(m.reason || '')} (${fmtDate(m.createdAt)})`, 0, 0, 0);
    }
  }

  addText(eqLine, 1, 1, 0);
  addText('MT Bites Stock Audit Ticket', 1, 1, 0);
  addText(' ', 0, 0, 0);

  const forcedObj = {};
  entries.forEach((entry, idx) => {
    forcedObj[String(idx).padStart(3, '0')] = entry;
  });
  return forcedObj;
}

/**
 * Builds `<BAF>` ESC/POS markup string for Android Thermer (`mate.bluetoothprint`)
 * for Inventory + Recent Stock Movements.
 */
export function buildInventoryThermerString(
  items = [],
  movements = [],
  shopName = 'MT Bites',
  thermalWidth = '80mm',
  categoryFilter = 'All'
) {
  const jsonObj = buildInventoryThermerJsonObject(items, movements, shopName, thermalWidth, categoryFilter);
  return Object.keys(jsonObj)
    .sort()
    .map(k => {
      const e = jsonObj[k];
      return `<${e.bold ? 1 : 0}${e.align ?? 0}${e.format ?? 0}>${String(e.content || '').replace(/\u00A0/g, ' ')}`;
    })
    .join('\n');
}

export function buildInventoryThermerSchemeUrls(
  items = [],
  movements = [],
  shopName = 'MT Bites',
  thermalWidth = '80mm',
  categoryFilter = 'All'
) {
  const jsonObj = buildInventoryThermerJsonObject(items, movements, shopName, thermalWidth, categoryFilter);
  const encoded = toBase64Url(JSON.stringify(jsonObj));
  const origin =
    typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://mtbites.netlify.app';
  const responseUrl = `${origin}/api/thermer-print?d=${encoded}`;
  return {
    responseUrl,
    iosUrl: `bprint://${responseUrl}`,
    androidSchemeUrl: `my.bluetoothprint.scheme://${responseUrl}`
  };
}

export function generateInventoryPdf(
  items = [],
  movements = [],
  shopName = 'MT Bites',
  thermalWidth = '80mm',
  categoryFilter = 'All'
) {
  const paperW = thermalWidth === '58mm' ? 58 : 80;
  const margin = paperW <= 58 ? 2.5 : 3.5;
  const innerW = paperW - margin * 2;
  const rightX = paperW - margin;
  const centerX = paperW / 2;
  const is58 = paperW <= 58;

  const drawPass = (doc, draw) => {
    let y = 5;
    const setFont = (sizePt, style = 'bold') => {
      doc.setFont('helvetica', style);
      doc.setFontSize(sizePt);
      return sizePt * 0.3528 * 1.32;
    };
    const center = (txt, sizePt) => {
      const lh = setFont(sizePt, 'bold');
      for (const ln of doc.splitTextToSize(String(txt ?? ''), innerW)) {
        if (draw) doc.text(ln, centerX, y + lh * 0.78, { align: 'center' });
        y += lh;
      }
    };
    const row = (left, right = '', sizePt = is58 ? 8.5 : 9.5, style = 'bold') => {
      const lh = setFont(sizePt, style);
      const rStr = String(right ?? '');
      const rW = rStr ? doc.getTextWidth(rStr) + 3 : 0;
      const lines = doc.splitTextToSize(String(left ?? ''), Math.max(20, innerW - rW));
      lines.forEach((ln, idx) => {
        if (draw) {
          doc.text(ln, margin, y + lh * 0.78, { align: 'left' });
          if (idx === 0 && rStr) doc.text(rStr, rightX, y + lh * 0.78, { align: 'right' });
        }
        y += lh;
      });
    };
    const rule = () => {
      y += 1.5;
      if (draw) {
        doc.setLineWidth(0.45);
        doc.line(margin, y, rightX, y);
      }
      y += 2;
    };

    center(String(shopName || 'MT Bites').toUpperCase(), is58 ? 14 : 17);
    center('INVENTORY & STOCK LOGS', is58 ? 10 : 11);
    rule();
    row('Printed:', fmtDate(new Date().toISOString()), is58 ? 8 : 9, 'normal');
    row('Category:', categoryFilter || 'All', is58 ? 8 : 9, 'bold');
    rule();
    row('ITEM', 'STOCK', is58 ? 8.5 : 9.5, 'bold');
    rule();
    for (const item of items) {
      const qtyNum = Number(item.quantity || 0);
      const minNum = Number(item.minimum || 0);
      const tag = qtyNum <= 0 ? ' [OUT]' : qtyNum <= minNum ? ' [LOW]' : '';
      row(`${item.name}${tag}`, `${qtyNum} ${item.unit || ''}`, is58 ? 8.5 : 9.5, 'bold');
    }
    rule();
    center('RECENT MOVEMENTS', is58 ? 9 : 10);
    rule();
    const byId = new Map(items.map(i => [i.id, i]));
    const recentMovs = [...movements]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 15);
    for (const m of recentMovs) {
      const itemObj = byId.get(m.itemId);
      const deltaStr = m.delta > 0 ? `+${m.delta}` : `${m.delta}`;
      row(itemObj?.name || 'Item', `${deltaStr} ${itemObj?.unit || ''}`, is58 ? 8 : 9, 'bold');
      row(`  ${m.reason || ''} (${fmtDate(m.createdAt)})`, '', is58 ? 7 : 8, 'normal');
    }
    y += 8;
    return Math.ceil(y);
  };

  const measureDoc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [paperW, 250] });
  const h = Math.max(85, drawPass(measureDoc, false));
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [paperW, h] });
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  drawPass(doc, true);
  return doc;
}

export function inventoryDocument(
  items = [],
  movements = [],
  shopName = 'MT Bites',
  thermalWidth = '80mm',
  categoryFilter = 'All'
) {
  const safe = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const is58 = thermalWidth === '58mm';
  const byId = new Map(items.map(i => [i.id, i]));
  const recentMovs = [...movements]
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 15);

  const itemRows = items.map(i => {
    const qty = Number(i.quantity || 0);
    const min = Number(i.minimum || 0);
    const tag = qty <= 0 ? ' [OUT]' : qty <= min ? ' [LOW]' : '';
    return `<tr><td><strong>${safe(i.name)}${tag}</strong></td><td class="right">${qty} ${safe(i.unit || '')}</td></tr>`;
  }).join('');

  const movRows = recentMovs.map(m => {
    const itemObj = byId.get(m.itemId);
    const deltaStr = m.delta > 0 ? `+${m.delta}` : `${m.delta}`;
    return `<tr><td><strong>${safe(itemObj?.name || 'Item')}</strong><div>${safe(m.reason || '')} (${safe(fmtDate(m.createdAt))})</div></td><td class="right"><strong>${deltaStr} ${safe(itemObj?.unit || '')}</strong></td></tr>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Inventory Report</title>
  <style>
    @page { size: ${is58 ? '58mm auto' : '80mm auto'}; margin: 0; }
    * { box-sizing: border-box; color: #000 !important; }
    html, body { margin: 0; padding: 0; width: 100%; background: #fff; font-family: Arial, sans-serif; font-size: ${is58 ? '13px' : '15px'}; font-weight: 700; }
    body { padding: 2mm 3mm; }
    body.a4-driver-scale { font-size: 36px; padding: 4mm 6mm; }
    h1 { margin: 0; text-align: center; font-size: 22px; text-transform: uppercase; }
    body.a4-driver-scale h1 { font-size: 56px; }
    .sub { text-align: center; margin-bottom: 6px; }
    .rule { border-top: 2px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 3px 1px; vertical-align: top; }
    td div { font-size: 0.85em; font-weight: 600; }
    .right { text-align: right; white-space: nowrap; }
  </style></head><body>
    <h1>${safe(shopName)}</h1>
    <div class="sub">INVENTORY &amp; STOCK LOGS<br/>${safe(fmtDate(new Date().toISOString()))} · ${safe(categoryFilter)}</div>
    <div class="rule"></div>
    <table>${itemRows || '<tr><td colspan="2">No stock items</td></tr>'}</table>
    <div class="rule"></div>
    <div class="sub">RECENT MOVEMENTS (LAST 15)</div>
    <table>${movRows || '<tr><td colspan="2">No movements recorded</td></tr>'}</table>
  </body></html>`;
}

export async function printInventoryReport(
  items = [],
  movements = [],
  shopName = 'MT Bites',
  thermalWidth = '80mm',
  printMode = 'image',
  { categoryFilter = 'All' } = {}
) {
  if (printMode === 'thermer-ios') {
    const { iosUrl } = buildInventoryThermerSchemeUrls(items, movements, shopName, thermalWidth, categoryFilter);
    window.location.href = iosUrl;
    return 'thermer-ios';
  }
  if (printMode === 'thermer-android-scheme') {
    const { androidSchemeUrl } = buildInventoryThermerSchemeUrls(items, movements, shopName, thermalWidth, categoryFilter);
    window.location.href = androidSchemeUrl;
    return 'thermer-android-scheme';
  }
  if (printMode === 'pdf') {
    const doc = generateInventoryPdf(items, movements, shopName, thermalWidth, categoryFilter);
    doc.save(`inventory-logs-${thermalWidth}.pdf`);
    return 'pdf';
  }
  if (printMode === 'browser' || printMode === 'a4-boost') {
    let html = inventoryDocument(items, movements, shopName, thermalWidth, categoryFilter);
    if (printMode === 'a4-boost') html = html.replace('<body>', '<body class="a4-driver-scale">');
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position: 'fixed', width: '0', height: '0', border: '0', visibility: 'hidden' });
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (e) { console.error(e); }
      window.setTimeout(() => iframe.remove(), 120000);
    };
    iframe.srcdoc = html;
    return printMode;
  }

  // Default: open unified Print Hub overlay with iPhone bprint://, Android Thermer, 80mm PDF & Browser Print
  document.getElementById('mt-receipt-preview')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'mt-receipt-preview';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '9999', background: 'rgba(0,0,0,0.88)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px',
    overflowY: 'auto', gap: '10px'
  });

  const { iosUrl, androidSchemeUrl } = buildInventoryThermerSchemeUrls(items, movements, shopName, thermalWidth, categoryFilter);
  const bafText = buildInventoryThermerString(items, movements, shopName, thermalWidth, categoryFilter);
  const btnStyle = 'padding:12px 14px;border-radius:10px;border:0;font-weight:800;font-size:14px;min-height:46px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;text-align:center;';

  overlay.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;width:100%;max-width:440px;">
      <h3 style="color:#fff;margin:0;text-align:center;font-family:Arial,sans-serif;">Print Inventory &amp; Stock Logs (${thermalWidth})</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;">
        <a href="${iosUrl}" style="${btnStyle}background:#22c55e;color:#052e16;flex:1;font-size:14.5px;">
          🍎 iPhone Thermer (bprint://)
        </a>
        <a href="${androidSchemeUrl}" style="${btnStyle}background:#10b981;color:#052e16;flex:1;font-size:14.5px;">
          🤖 Android Browser Print
        </a>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;">
        <button id="mt-inv-share" style="${btnStyle}background:#34d399;color:#052e16;flex:1;">
          📲 Share Text to Thermer App
        </button>
        <button id="mt-inv-pdf" style="${btnStyle}background:#fb923c;color:#1a0f06;flex:1;">
          📄 ${thermalWidth} Roll PDF
        </button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;">
        <button id="mt-inv-browser" style="${btnStyle}background:#e5e7eb;color:#111827;flex:1;">
          🖨️ Browser Print
        </button>
        <button id="mt-inv-a4" style="${btnStyle}background:#facc15;color:#1a0f06;flex:1;">
          🔍 A4-to-80mm Boost
        </button>
        <button id="mt-inv-close" style="${btnStyle}background:#3b332a;color:#fff;flex:0.7;">
          ✕ Close
        </button>
      </div>
      <pre style="background:#fff;color:#000;padding:12px;border-radius:8px;font-size:12px;overflow:auto;max-height:55vh;white-space:pre-wrap;">${bafText.replace(/<[01][012][0123]>/g, '')}</pre>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#mt-inv-close').onclick = () => overlay.remove();
  overlay.querySelector('#mt-inv-share').onclick = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: bafText }); return; } catch {}
    }
    if (navigator.clipboard) await navigator.clipboard.writeText(bafText);
    alert('Copied Thermer <BAF> inventory text to clipboard!');
  };
  overlay.querySelector('#mt-inv-pdf').onclick = () => {
    const doc = generateInventoryPdf(items, movements, shopName, thermalWidth, categoryFilter);
    const blobUrl = URL.createObjectURL(doc.output('blob'));
    window.open(blobUrl, '_blank');
    doc.save(`inventory-logs-${thermalWidth}.pdf`);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };
  overlay.querySelector('#mt-inv-browser').onclick = () => printInventoryReport(items, movements, shopName, thermalWidth, 'browser', { categoryFilter });
  overlay.querySelector('#mt-inv-a4').onclick = () => printInventoryReport(items, movements, shopName, thermalWidth, 'a4-boost', { categoryFilter });
  return 'preview';
}

/**
 * Generates full-width HTML for browser printing.
 * Setting `width: 100%; max-width: none;` guarantees the receipt fills 100% of the paper
 * edge-to-edge whether the driver is set to 80mm Roll or A4 Fit-to-Page.
 */
export function receiptDocument(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const safe = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kitchen = type === 'kitchen';
  const is58 = thermalWidth === '58mm';
  const pageSize = is58 ? '58mm auto' : '80mm auto';
  const fontSize = is58 ? '14px' : '16px';
  const titleSize = is58 ? '24px' : '28px';

  const rows = (order.items || []).map(item => `
    <tr>
      <td>
        <strong>${safe(item.name)}</strong>
        ${item.variant && item.variant !== 'Regular' ? `<div class="variant-label">${safe(item.variant)}</div>` : ''}
      </td>
      <td class="qty">${item.quantity}</td>
      <td class="right">${rs(lineTotal(item))}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${kitchen ? 'Kitchen Ticket' : 'Receipt'} ${safe(order.number)}</title>
  <style>
    @page { size: ${pageSize}; margin: 0; }
    * { box-sizing: border-box; color: #000 !important; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #fff;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${fontSize};
      font-weight: 700;
      width: 100%;
      padding: 2mm 3mm;
      margin: 0;
      line-height: 1.32;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    /* When printer driver is stuck on A4 and scales page down by 2.6x, scale fonts up proportionally */
    body.a4-driver-scale {
      font-size: 38px;
      padding: 4mm 6mm;
    }
    body.a4-driver-scale h1 { font-size: 64px; }
    body.a4-driver-scale .brand-sub { font-size: 28px; }
    body.a4-driver-scale .badge { font-size: 34px; padding: 8px 18px; border-width: 3px; }
    body.a4-driver-scale .meta-table { font-size: 34px; }
    body.a4-driver-scale table.items { font-size: 38px; }
    body.a4-driver-scale table.items th { font-size: 32px; border-bottom-width: 4px; padding: 8px 2px; }
    body.a4-driver-scale table.items td { padding: 8px 2px; }
    body.a4-driver-scale .qty { width: 90px; font-size: 40px; }
    body.a4-driver-scale .variant-label { font-size: 30px; }
    body.a4-driver-scale .note-box { font-size: 32px; padding: 12px; border-width: 3px; }
    body.a4-driver-scale .grand-total { font-size: 44px; }
    body.a4-driver-scale .status-stamp { font-size: 36px; padding: 10px; border-width: 4px; }
    body.a4-driver-scale .footer { font-size: 28px; }
    body.a4-driver-scale .rule { border-top-width: 4px; margin: 12px 0; }
    body.a4-driver-scale .rule-double { border-top-width: 6px; margin: 12px 0; }

    .header { text-align: center; margin-bottom: 8px; width: 100%; }
    h1 { margin: 0; font-size: ${titleSize}; letter-spacing: -0.5px; text-transform: uppercase; font-weight: 900; }
    .brand-sub { font-size: 12px; letter-spacing: 1px; margin-top: 2px; }
    .badge {
      display: inline-block;
      border: 2px solid #000;
      padding: 3px 10px;
      margin: 6px 0;
      font-weight: 900;
      font-size: ${is58 ? '12px' : '14px'};
      letter-spacing: 0.5px;
    }
    .meta-table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: ${is58 ? '13px' : '14px'}; }
    .meta-table td { padding: 2px 0; vertical-align: top; }
    .rule { border-top: 2px dashed #000; margin: 6px 0; width: 100%; }
    .rule-double { border-top: 3px solid #000; margin: 6px 0; width: 100%; }
    table.items { width: 100%; border-collapse: collapse; font-size: ${fontSize}; }
    table.items th { border-bottom: 2px dashed #000; padding: 4px 1px; font-weight: 900; font-size: ${is58 ? '12px' : '14px'}; }
    table.items td { padding: 4px 1px; vertical-align: top; }
    .qty { width: 36px; text-align: center; font-weight: 900; font-size: ${is58 ? '15px' : '17px'}; }
    .right { text-align: right; white-space: nowrap; }
    .variant-label { font-size: ${is58 ? '12px' : '13px'}; }
    .note-box {
      border: 2px dashed #000;
      padding: 6px;
      margin: 6px 0;
      font-size: 13px;
      background: #fafafa;
      width: 100%;
    }
    .total-row { display: flex; justify-content: space-between; margin: 3px 0; width: 100%; }
    .grand-total {
      display: flex;
      justify-content: space-between;
      font-size: ${is58 ? '16px' : '19px'};
      font-weight: 900;
      margin: 4px 0;
      width: 100%;
    }
    .status-stamp {
      text-align: center;
      border: 2px solid #000;
      padding: 5px;
      margin: 8px 0;
      font-weight: 900;
      font-size: 15px;
      letter-spacing: 1px;
      width: 100%;
    }
    .footer { text-align: center; font-size: 12px; margin-top: 8px; padding-bottom: 8mm; width: 100%; }
    .print-controls { margin: 16px 0; text-align: center; }
    .print-controls button {
      padding: 8px 16px;
      font-size: 13px;
      cursor: pointer;
      border-radius: 4px;
      border: 1px solid #333;
      background: #f0f0f0;
    }
    @media print { .print-controls { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${safe(shopName)}</h1>
    <div class="brand-sub">KASHMIR · FAST FOOD POS</div>
    <div class="badge">${kitchen ? 'KITCHEN TICKET' : 'CUSTOMER BILL'}</div>
  </div>

  <table class="meta-table">
    <tr>
      <td><strong>Order:</strong> ${safe(order.number)}</td>
      <td class="right">${safe(fmtDate(order.createdAt))}</td>
    </tr>
    <tr>
      <td><strong>Type:</strong> ${safe(order.orderType)}${order.tableNumber ? ` · Table ${safe(order.tableNumber)}` : ''}</td>
      <td class="right">${order.serverName ? `Staff: ${safe(order.serverName)}` : ''}</td>
    </tr>
    ${order.customerName ? `<tr><td colspan="2"><strong>Customer:</strong> ${safe(order.customerName)}</td></tr>` : ''}
  </table>

  <div class="rule"></div>

  <table class="items">
    <thead>
      <tr>
        <th align="left">ITEM</th>
        <th class="qty">QTY</th>
        <th class="right">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="rule"></div>

  ${order.note ? `
    <div class="note-box">
      <strong>Kitchen Instructions:</strong><br>
      ${safe(order.note)}
    </div>
  ` : ''}

  <div class="total-row"><span>Subtotal:</span> <strong>${rs(order.subtotal)}</strong></div>
  ${order.discount ? `<div class="total-row"><span>Discount:</span> <strong>-${rs(order.discount)}</strong></div>` : ''}
  <div class="rule-double"></div>
  <div class="grand-total">
    <span>${kitchen ? 'ORDER TOTAL:' : 'NET TOTAL:'}</span>
    <strong>${rs(order.total)}</strong>
  </div>
  <div class="status-stamp">
    ${kitchen ? 'PREPARE ORDER NOW' : (order.paymentStatus === 'paid' ? 'CASH PAID' : 'UNPAID')}
  </div>
  ${!kitchen && order.paymentStatus === 'paid' && order.cashReceived !== null ? `
    <div class="total-row"><span>Cash Received:</span> <strong>${rs(order.cashReceived)}</strong></div>
    <div class="total-row"><span>Change Due:</span> <strong>${rs(order.change)}</strong></div>
  ` : ''}
  ${!kitchen ? `
    <div class="footer">
      Thank you for choosing MT Bites!<br>
      Please visit again.
    </div>
  ` : `
    <div class="footer">
      MT Bites Kitchen Ticket · ${order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
    </div>
  `}

  <div class="print-controls">
    <button onclick="window.print()">Print Ticket</button>
  </div>
</body>
</html>`;
}

export function openReceipt(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm', a4DriverScale = false) {
  let html = receiptDocument(order, type, shopName, thermalWidth);
  if (a4DriverScale) {
    html = html.replace('<body>', '<body class="a4-driver-scale">');
  }
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Print preview');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden'
  });
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (error) {
      console.error('Printer dialog could not be opened', error);
    }
    window.setTimeout(() => iframe.remove(), 120000);
  };
  iframe.srcdoc = html;
}

// ==========================================================================
// EXACT ROLL-SIZE THERMAL PDF GENERATOR (80mm / 58mm Roll PDF)
// ==========================================================================

function drawThermalPdfLayout(doc, draw, paperW, order, type, shopName) {
  const is58 = paperW <= 58;
  const margin = is58 ? 2.5 : 3.5;
  const innerW = paperW - margin * 2;
  const rightX = paperW - margin;
  const centerX = paperW / 2;
  const kitchen = type === 'kitchen';
  let y = 5;

  const setFont = (sizePt, style = 'bold') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(sizePt);
    return sizePt * 0.3528 * 1.32;
  };

  const centerText = (text, sizePt, style = 'bold') => {
    const lh = setFont(sizePt, style);
    const lines = doc.splitTextToSize(String(text ?? ''), innerW);
    for (const line of lines) {
      if (draw) {
        doc.text(line, centerX, y + lh * 0.78, { align: 'center' });
      }
      y += lh;
    }
  };

  const rowText = (left, right = '', sizePt = is58 ? 9.5 : 11, style = 'bold') => {
    const lh = setFont(sizePt, style);
    const rightStr = String(right ?? '');
    const rightW = rightStr ? doc.getTextWidth(rightStr) + 3 : 0;
    const maxLeftW = Math.max(20, innerW - rightW);
    const lines = doc.splitTextToSize(String(left ?? ''), maxLeftW);
    lines.forEach((line, idx) => {
      if (draw) {
        doc.text(line, margin, y + lh * 0.78, { align: 'left' });
        if (idx === 0 && rightStr) {
          doc.text(rightStr, rightX, y + lh * 0.78, { align: 'right' });
        }
      }
      y += lh;
    });
  };

  const drawRule = (dashed = true, lineWidth = 0.45) => {
    y += 1.5;
    if (draw) {
      doc.setLineWidth(lineWidth);
      if (dashed && typeof doc.setLineDashPattern === 'function') {
        doc.setLineDashPattern([1.5, 1.0], 0);
      }
      doc.line(margin, y, rightX, y);
      if (dashed && typeof doc.setLineDashPattern === 'function') {
        doc.setLineDashPattern([], 0);
      }
    }
    y += 2;
  };

  const drawBox = (text, sizePt) => {
    const lh = setFont(sizePt, 'bold');
    const boxH = lh + 3.2;
    if (draw) {
      doc.setLineWidth(0.6);
      if (typeof doc.setLineDashPattern === 'function') {
        doc.setLineDashPattern([], 0);
      }
      doc.rect(margin, y, innerW, boxH);
      doc.text(String(text ?? ''), centerX, y + 1.4 + lh * 0.78, { align: 'center' });
    }
    y += boxH + 2;
  };

  centerText(String(shopName || 'MT Bites').toUpperCase(), is58 ? 15 : 18, 'bold');
  centerText('KASHMIR · FAST FOOD POS', is58 ? 8 : 9, 'bold');
  y += 1.2;
  drawBox(kitchen ? 'KITCHEN TICKET' : 'CUSTOMER BILL', is58 ? 10.5 : 12);

  rowText(`Order: ${order.number || ''}`, fmtDate(order.createdAt), is58 ? 8.5 : 9.5, 'bold');
  rowText(
    `Type: ${order.orderType || ''}${order.tableNumber ? ` · Table ${order.tableNumber}` : ''}`,
    order.serverName ? `Staff: ${order.serverName}` : '',
    is58 ? 8.5 : 9.5,
    'bold'
  );
  if (order.customerName) {
    rowText(`Customer: ${order.customerName}`, '', is58 ? 8.5 : 9.5, 'bold');
  }

  drawRule(true, 0.45);

  const headerSize = is58 ? 8.5 : 9.5;
  const headerLh = setFont(headerSize, 'bold');
  const qtyColX = rightX - (is58 ? 20 : 25);
  if (draw) {
    doc.text('ITEM', margin, y + headerLh * 0.78, { align: 'left' });
    doc.text('QTY', qtyColX, y + headerLh * 0.78, { align: 'center' });
    doc.text('AMOUNT', rightX, y + headerLh * 0.78, { align: 'right' });
  }
  y += headerLh;
  drawRule(true, 0.45);

  const itemFontSize = is58 ? 9.5 : 11;
  for (const item of order.items || []) {
    const lh = setFont(itemFontSize, 'bold');
    const amountStr = rs(lineTotal(item));
    const maxItemW = qtyColX - margin - 5;
    const nameLines = doc.splitTextToSize(String(item.name || ''), maxItemW);
    nameLines.forEach((line, idx) => {
      if (draw) {
        doc.text(line, margin, y + lh * 0.78, { align: 'left' });
        if (idx === 0) {
          doc.text(String(item.quantity || 1), qtyColX, y + lh * 0.78, { align: 'center' });
          doc.text(amountStr, rightX, y + lh * 0.78, { align: 'right' });
        }
      }
      y += lh;
    });
    if (item.variant && item.variant !== 'Regular') {
      const varLh = setFont(is58 ? 8 : 9, 'bold');
      if (draw) {
        doc.text(`  (${item.variant})`, margin, y + varLh * 0.78, { align: 'left' });
      }
      y += varLh;
    }
    y += 0.6;
  }

  drawRule(true, 0.45);

  if (order.note) {
    rowText(`Kitchen Note: ${order.note}`, '', is58 ? 9 : 10, 'bold');
    drawRule(true, 0.45);
  }

  rowText('Subtotal:', rs(order.subtotal), is58 ? 9.5 : 10.5, 'bold');
  if (order.discount) {
    rowText('Discount:', `-${rs(order.discount)}`, is58 ? 9.5 : 10.5, 'bold');
  }
  drawRule(false, 0.7);
  rowText(kitchen ? 'ORDER TOTAL:' : 'NET TOTAL:', rs(order.total), is58 ? 12 : 14, 'bold');
  y += 1.5;

  drawBox(
    kitchen ? 'PREPARE ORDER NOW' : (order.paymentStatus === 'paid' ? 'CASH PAID' : 'UNPAID'),
    is58 ? 10.5 : 12
  );

  if (!kitchen && order.paymentStatus === 'paid' && order.cashReceived !== null && order.cashReceived !== undefined) {
    rowText('Cash Received:', rs(order.cashReceived), is58 ? 9 : 10, 'bold');
    rowText('Change Due:', rs(order.change), is58 ? 9 : 10, 'bold');
  }

  y += 1.5;
  if (!kitchen) {
    centerText('Thank you for choosing MT Bites!', is58 ? 8.5 : 9.5, 'bold');
    centerText('Please visit again.', is58 ? 8.5 : 9.5, 'bold');
  } else {
    centerText(`MT Bites Kitchen Ticket · ${order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}`, is58 ? 8.5 : 9.5, 'bold');
  }

  y += 8;
  return Math.ceil(y);
}

export function generateReceiptPdf(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const paperW = thermalWidth === '58mm' ? 58 : 80;
  const measureDoc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [paperW, 250] });
  const requiredH = Math.max(85, drawThermalPdfLayout(measureDoc, false, paperW, order, type, shopName));

  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [paperW, requiredH]
  });
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  drawThermalPdfLayout(doc, true, paperW, order, type, shopName);
  return doc;
}

// ==========================================================================
// IMAGE RECEIPT MODE (576 dots for 80mm / 384 dots for 58mm)
// ==========================================================================

export const receiptDotWidth = (thermalWidth = '80mm') => (thermalWidth === '58mm' ? 384 : 576);

function layoutReceipt(ctx, draw, W, order, type, shopName) {
  const s = W / 384;
  const pad = Math.round(6 * s);
  const inner = W - pad * 2;
  const kitchen = type === 'kitchen';
  let y = pad;

  const setFont = (size, weight = 700) => {
    ctx.font = `${weight} ${Math.round(size * s)}px Arial, Helvetica, sans-serif`;
    return Math.round(size * s * 1.32);
  };

  const wrap = (str, maxW) => {
    const words = String(str ?? '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxW || !line) {
        line = test;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const center = (str, size, weight = 800) => {
    const lh = setFont(size, weight);
    for (const line of wrap(str, inner)) {
      if (draw) {
        ctx.textAlign = 'center';
        ctx.fillText(line, W / 2, y + lh * 0.78);
      }
      y += lh;
    }
  };

  const row = (left, right = '', size = 22, weight = 700) => {
    const lh = setFont(size, weight);
    const rightW = right ? ctx.measureText(right).width + 10 * s : 0;
    const lines = wrap(left, inner - rightW);
    lines.forEach((line, i) => {
      if (draw) {
        ctx.textAlign = 'left';
        ctx.fillText(line, pad, y + lh * 0.78);
        if (i === 0 && right) {
          ctx.textAlign = 'right';
          ctx.fillText(right, W - pad, y + lh * 0.78);
        }
      }
      y += lh;
    });
  };

  const rule = (dashed = true, thick = 2) => {
    y += 4 * s;
    if (draw) {
      ctx.save();
      ctx.lineWidth = thick * s;
      ctx.setLineDash(dashed ? [8 * s, 5 * s] : []);
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(W - pad, y);
      ctx.stroke();
      ctx.restore();
    }
    y += 6 * s;
  };

  const boxed = (str, size) => {
    const lh = setFont(size, 900);
    const h = lh + 10 * s;
    if (draw) {
      ctx.save();
      ctx.lineWidth = 3 * s;
      ctx.setLineDash([]);
      ctx.strokeRect(pad + 1, y, inner - 2, h);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.fillText(str, W / 2, y + 5 * s + lh * 0.78);
    }
    y += h + 6 * s;
  };

  center(String(shopName || 'MT Bites').toUpperCase(), 38, 900);
  center('KASHMIR · FAST FOOD POS', 18, 700);
  y += 4 * s;
  boxed(kitchen ? 'KITCHEN TICKET' : 'CUSTOMER BILL', 24);

  row(`Order: ${order.number || ''}`, fmtDate(order.createdAt), 20, 800);
  row(
    `Type: ${order.orderType || ''}${order.tableNumber ? ` · Table ${order.tableNumber}` : ''}`,
    order.serverName ? `Staff: ${order.serverName}` : '',
    20,
    800
  );
  if (order.customerName) row(`Customer: ${order.customerName}`, '', 20, 700);

  rule();
  row('ITEM', 'AMOUNT', 20, 900);
  rule();

  for (const item of order.items || []) {
    row(`${item.quantity} x ${item.name}`, rs(lineTotal(item)), 24, 800);
    if (item.variant && item.variant !== 'Regular') row(`    (${item.variant})`, '', 20, 700);
  }

  rule();

  if (order.note) {
    row(`NOTE: ${order.note}`, '', 22, 900);
    rule();
  }

  row('Subtotal:', rs(order.subtotal), 22, 700);
  if (order.discount) row('Discount:', `-${rs(order.discount)}`, 22, 700);
  rule(false, 3);
  row(kitchen ? 'ORDER TOTAL:' : 'NET TOTAL:', rs(order.total), 30, 900);
  y += 4 * s;
  boxed(kitchen ? 'PREPARE ORDER NOW' : (order.paymentStatus === 'paid' ? 'CASH PAID' : 'UNPAID'), 26);

  if (!kitchen && order.paymentStatus === 'paid' && order.cashReceived !== null && order.cashReceived !== undefined) {
    row('Cash Received:', rs(order.cashReceived), 21, 700);
    row('Change Due:', rs(order.change), 21, 700);
  }

  y += 4 * s;
  if (!kitchen) {
    center('Thank you for choosing MT Bites!', 18, 700);
    center('Please visit again.', 18, 700);
  } else {
    center(`MT Bites Kitchen Ticket · ${order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}`, 18, 700);
  }

  y += 32 * s;
  return Math.ceil(y);
}

export function renderReceiptCanvas(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const W = receiptDotWidth(thermalWidth);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = 10;
  const H = layoutReceipt(ctx, false, W, order, type, shopName);
  canvas.height = H;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.textBaseline = 'alphabetic';
  layoutReceipt(ctx, true, W, order, type, shopName);
  return canvas;
}

function showReceiptImagePreview(dataUrl, order, type, shopName, thermalWidth) {
  document.getElementById('mt-receipt-preview')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'mt-receipt-preview';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '9999', background: 'rgba(0,0,0,0.88)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px',
    overflowY: 'auto', gap: '10px'
  });

  const baseFile = `${order.number || 'receipt'}-${type}`;
  const { iosUrl, androidSchemeUrl } = buildThermerSchemeUrls(order, type, shopName, thermalWidth);
  const btnStyle = 'padding:12px 14px;border-radius:10px;border:0;font-weight:800;font-size:14px;min-height:46px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;text-align:center;';
  overlay.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;width:100%;max-width:440px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;">
        <a id="mt-rcpt-ios-bprint" href="${iosUrl}" style="${btnStyle}background:#22c55e;color:#052e16;flex:1;font-size:14.5px;box-shadow:0 4px 14px rgba(34,197,94,0.35);">
          🍎 iPhone Thermer Print (bprint://)
        </a>
        <a id="mt-rcpt-android-scheme" href="${androidSchemeUrl}" style="${btnStyle}background:#10b981;color:#052e16;flex:1;font-size:14.5px;">
          🤖 Android Browser Print
        </a>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;">
        <button id="mt-rcpt-thermer-share" style="${btnStyle}background:#34d399;color:#052e16;flex:1;">
          📲 Share Text to Thermer App
        </button>
        <button id="mt-rcpt-pdf" style="${btnStyle}background:#fb923c;color:#1a0f06;flex:1;">
          📄 ${thermalWidth} Roll PDF
        </button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;">
        <button id="mt-rcpt-print-full" style="${btnStyle}background:#e5e7eb;color:#111827;flex:1;">
          🖨️ Browser Print
        </button>
        <button id="mt-rcpt-print-a4scale" style="${btnStyle}background:#facc15;color:#1a0f06;flex:1;">
          🔍 A4-to-80mm Boost
        </button>
        <button id="mt-rcpt-close" style="${btnStyle}background:#3b332a;color:#fff;flex:0.7;">
          ✕ Close
        </button>
      </div>
    </div>
    <p id="mt-rcpt-tip" style="color:#e5e7eb;font:600 12px Arial;max-width:440px;text-align:center;margin:2px 0;line-height:1.45;">
      <strong>iPhone &amp; Android 1-Tap Printing via Bluetooth Print (Thermer):</strong><br/>
      • Enable <strong>Browser Print</strong> inside the Bluetooth Print app settings.<br/>
      • On <strong>iPhone</strong>: Tap <strong>🍎 iPhone Thermer Print (bprint://)</strong>.<br/>
      • On <strong>Android</strong>: Tap <strong>🤖 Android Browser Print</strong> or <strong>📲 Share Text to Thermer App</strong>!
    </p>
    <img src="${dataUrl}" alt="Receipt preview" style="width:100%;max-width:${thermalWidth === '58mm' ? 310 : 390}px;background:#fff;border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,0.5);" />
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#mt-rcpt-close').onclick = () => overlay.remove();

  overlay.querySelector('#mt-rcpt-thermer-share').onclick = async () => {
    const res = await sendToThermerApp(order, type, shopName, thermalWidth);
    if (res === 'copied') {
      const tip = overlay.querySelector('#mt-rcpt-tip');
      if (tip) tip.innerHTML = '<strong style="color:#4ade80;">✓ Copied &lt;BAF&gt; Receipt Text! Paste it in Thermer to print.</strong>';
    }
  };

  overlay.querySelector('#mt-rcpt-pdf').onclick = () => {
    const doc = generateReceiptPdf(order, type, shopName, thermalWidth);
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
    doc.save(`${baseFile}-${thermalWidth}.pdf`);
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  };

  overlay.querySelector('#mt-rcpt-print-full').onclick = () => {
    openReceipt(order, type, shopName, thermalWidth, false);
  };

  overlay.querySelector('#mt-rcpt-print-a4scale').onclick = () => {
    openReceipt(order, type, shopName, thermalWidth, true);
  };
}

/**
 * Generates a full-width receipt preview with 1-click Thermer App (`mate.bluetoothprint`)
 * native `<BAF>` printing, 80mm Roll PDF, and Browser Print.
 */
export async function shareReceiptImage(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const canvas = renderReceiptCanvas(order, type, shopName, thermalWidth);
  const dataUrl = canvas.toDataURL('image/png');
  showReceiptImagePreview(dataUrl, order, type, shopName, thermalWidth);
  return 'preview';
}

/**
 * Main print entry point.
 * Supports:
 * - 'thermer': Immediately fires Android Intent to `mate.bluetoothprint` with `<BAF>` tags
 * - 'pdf': Immediately generates & downloads exact 80mm/58mm Roll PDF
 * - 'browser': Direct full-width 100% HTML print
 * - 'a4-boost': Direct HTML print with scaled-up fonts for A4-locked printer drivers
 * - 'image' (default): Opens the receipt preview hub with Instant Thermer button + PDF + Print
 */
export function printReceipt(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm', printMode = 'image') {
  if (printMode === 'thermer-ios') {
    const { iosUrl } = buildThermerSchemeUrls(order, type, shopName, thermalWidth);
    window.location.href = iosUrl;
    return Promise.resolve('thermer-ios');
  }
  if (printMode === 'thermer-android-scheme') {
    const { androidSchemeUrl } = buildThermerSchemeUrls(order, type, shopName, thermalWidth);
    window.location.href = androidSchemeUrl;
    return Promise.resolve('thermer-android-scheme');
  }
  if (printMode === 'thermer') {
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '');
    if (isIOS) {
      const { iosUrl } = buildThermerSchemeUrls(order, type, shopName, thermalWidth);
      window.location.href = iosUrl;
      return Promise.resolve('thermer-ios');
    }
    return sendToThermerApp(order, type, shopName, thermalWidth);
  }
  if (printMode === 'pdf') {
    const baseFile = `${order.number || 'receipt'}-${type}-${thermalWidth}.pdf`;
    const doc = generateReceiptPdf(order, type, shopName, thermalWidth);
    doc.save(baseFile);
    return Promise.resolve('pdf');
  }
  if (printMode === 'browser') {
    openReceipt(order, type, shopName, thermalWidth, false);
    return Promise.resolve('browser');
  }
  if (printMode === 'a4-boost') {
    openReceipt(order, type, shopName, thermalWidth, true);
    return Promise.resolve('a4-boost');
  }
  return shareReceiptImage(order, type, shopName, thermalWidth);
}
