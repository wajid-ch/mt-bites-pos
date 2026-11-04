import * as jspdfModule from 'jspdf';
import { fmtDate, rs, lineTotal } from './money.js';

const JsPDF = jspdfModule.jsPDF || jspdfModule.default?.jsPDF || jspdfModule.default;

/**
 * Generates full-width HTML for browser printing.
 * IMPORTANT: Never set `max-width: 80mm` or `margin: 0 auto` on `body`!
 * When an OS/mobile printer driver defaults to A4 (210mm) and "Fits to Paper"
 * onto an 80mm thermal roll, restricting `body` to `max-width: 80mm` centered
 * inside a 210mm viewport shrinks the receipt down to ~30mm in the center of the roll!
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
// Embeds exact physical paper width (80mm or 58mm) in the PDF MediaBox and
// renders crisp vector text edge-to-edge across the entire thermal roll.
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
    return sizePt * 0.3528 * 1.32; // mm line height
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

  // Header
  centerText(String(shopName || 'MT Bites').toUpperCase(), is58 ? 15 : 18, 'bold');
  centerText('KASHMIR · FAST FOOD POS', is58 ? 8 : 9, 'bold');
  y += 1.2;
  drawBox(kitchen ? 'KITCHEN TICKET' : 'CUSTOMER BILL', is58 ? 10.5 : 12);

  // Meta rows spanning full width
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

  // Column Header
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

  // Items
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

  // Kitchen note
  if (order.note) {
    rowText(`Kitchen Note: ${order.note}`, '', is58 ? 9 : 10, 'bold');
    drawRule(true, 0.45);
  }

  // Totals
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

  y += 8; // Bottom tear margin
  return Math.ceil(y);
}

/**
 * Builds a jsPDF document locked to the exact thermal roll width (80mm or 58mm)
 * with full-width vector text from left edge to right edge.
 */
export function generateReceiptPdf(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const paperW = thermalWidth === '58mm' ? 58 : 80;
  // Pass 1: measure exact required roll height
  const measureDoc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [paperW, 250] });
  const requiredH = Math.max(85, drawThermalPdfLayout(measureDoc, false, paperW, order, type, shopName));

  // Pass 2: create exact-dimension roll PDF
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

  // Header
  center(String(shopName || 'MT Bites').toUpperCase(), 38, 900);
  center('KASHMIR · FAST FOOD POS', 18, 700);
  y += 4 * s;
  boxed(kitchen ? 'KITCHEN TICKET' : 'CUSTOMER BILL', 24);

  // Meta
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

  // Extra blank paper at the bottom so the receipt can be torn off cleanly
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
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px',
    overflowY: 'auto', gap: '10px'
  });

  const baseFile = `${order.number || 'receipt'}-${type}`;
  const btnStyle = 'padding:12px 14px;border-radius:10px;border:0;font-weight:800;font-size:14px;min-height:46px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;';
  overlay.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;width:100%;max-width:440px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;">
        <button id="mt-rcpt-pdf" style="${btnStyle}background:#fb923c;color:#1a0f06;flex:1.2;">
          📄 Download ${thermalWidth} Roll PDF (Best for Thermal)
        </button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;">
        <button id="mt-rcpt-print-full" style="${btnStyle}background:#10b981;color:#052e16;flex:1;">
          🖨️ Direct Print (Full Width)
        </button>
        <button id="mt-rcpt-print-a4scale" style="${btnStyle}background:#facc15;color:#1a0f06;flex:1;" title="Use this if your printer driver is locked to A4 paper size and shrinks prints">
          🔍 Print (A4-to-80mm Boost)
        </button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;">
        <a id="mt-rcpt-dl" href="${dataUrl}" download="${baseFile}.png" style="${btnStyle}background:#fff;color:#000;text-decoration:none;flex:1;text-align:center;">
          🖼️ Save PNG Image
        </a>
        <button id="mt-rcpt-close" style="${btnStyle}background:#3b332a;color:#fff;flex:1;">
          ✕ Close
        </button>
      </div>
    </div>
    <p style="color:#e5e7eb;font:600 12.5px Arial;max-width:440px;text-align:center;margin:2px 0;line-height:1.4;">
      <strong>Using SPEED-X ${thermalWidth} Thermal Printer:</strong><br/>
      • Tap <strong>Download ${thermalWidth} Roll PDF</strong> to open a PDF locked to exact ${thermalWidth} roll size with edge-to-edge text.<br/>
      • Or tap <strong>Direct Print (Full Width)</strong> (in printer preferences, set Paper Size to <strong>80mm</strong> or tap <strong>A4-to-80mm Boost</strong> if your driver is stuck on A4).
    </p>
    <img src="${dataUrl}" alt="Receipt preview" style="width:100%;max-width:${thermalWidth === '58mm' ? 310 : 390}px;background:#fff;border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,0.5);" />
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#mt-rcpt-close').onclick = () => overlay.remove();

  overlay.querySelector('#mt-rcpt-pdf').onclick = () => {
    const doc = generateReceiptPdf(order, type, shopName, thermalWidth);
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    // Open PDF in new tab for immediate printing and also trigger download
    const win = window.open(pdfUrl, '_blank');
    if (!win) {
      doc.save(`${baseFile}-${thermalWidth}.pdf`);
    } else {
      doc.save(`${baseFile}-${thermalWidth}.pdf`);
    }
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
 * Generates a full-width receipt preview with 1-click 80mm Roll PDF,
 * Full-Width Direct Print, and A4-Driver Boost Print.
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
 * - 'pdf': Immediately generates & opens/downloads exact 80mm/58mm Roll PDF
 * - 'browser': Direct full-width 100% HTML print
 * - 'a4-boost': Direct HTML print with scaled-up fonts for A4-locked printer drivers
 * - 'image' (default): Opens the receipt preview hub with PDF, Direct Print & A4-Boost buttons
 */
export function printReceipt(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm', printMode = 'image') {
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
