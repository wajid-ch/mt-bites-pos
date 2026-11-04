import { fmtDate, rs, lineTotal } from './money.js';

export function receiptDocument(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const safe = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kitchen = type === 'kitchen';
  const is58 = thermalWidth === '58mm';
  const pageSize = is58 ? '58mm auto' : '80mm auto';
  // Use the full printable width (thermal printers cannot print faint/tiny text well)
  const bodyWidth = '100%';
  const fontSize = is58 ? '14px' : '15px';
  const titleSize = is58 ? '22px' : '26px';

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
    html, body { margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${fontSize};
      font-weight: 700;
      width: ${bodyWidth};
      max-width: ${is58 ? '58mm' : '80mm'};
      padding: 1.5mm;
      margin: 0 auto;
      line-height: 1.3;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header { text-align: center; margin-bottom: 8px; }
    h1 { margin: 0; font-size: ${titleSize}; letter-spacing: -0.5px; text-transform: uppercase; font-weight: 900; }
    .brand-sub { font-size: 12px; letter-spacing: 1px; margin-top: 2px; }
    .badge {
      display: inline-block;
      border: 1px solid #000;
      padding: 3px 8px;
      margin: 6px 0;
      font-weight: 800;
      font-size: ${is58 ? '12px' : '13px'};
      letter-spacing: 0.5px;
    }
    .meta-table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: ${is58 ? '13px' : '14px'}; }
    .meta-table td { padding: 1px 0; vertical-align: top; }
    .rule { border-top: 2px dashed #000; margin: 6px 0; }
    .rule-double { border-top: 3px solid #000; margin: 6px 0; }
    table.items { width: 100%; border-collapse: collapse; font-size: ${fontSize}; }
    table.items th { border-bottom: 2px dashed #000; padding: 4px 1px; font-weight: 900; font-size: ${is58 ? '12px' : '13px'}; }
    table.items td { padding: 4px 1px; vertical-align: top; }
    .qty { width: 30px; text-align: center; font-weight: 900; font-size: ${is58 ? '15px' : '16px'}; }
    .right { text-align: right; white-space: nowrap; }
    .variant-label { font-size: ${is58 ? '12px' : '13px'}; }
    .note-box {
      border: 1px dashed #000;
      padding: 6px;
      margin: 6px 0;
      font-size: 11px;
      background: #fafafa;
    }
    .total-row { display: flex; justify-content: space-between; margin: 3px 0; }
    .grand-total {
      display: flex;
      justify-content: space-between;
      font-size: ${is58 ? '14px' : '16px'};
      font-weight: 900;
      margin: 4px 0;
    }
    .status-stamp {
      text-align: center;
      border: 2px solid #000;
      padding: 4px;
      margin: 8px 0;
      font-weight: 900;
      font-size: 13px;
      letter-spacing: 1px;
    }
    .footer { text-align: center; font-size: 12px; margin-top: 8px; padding-bottom: 6mm; }
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
    ${kitchen ? 'PREPARE ORDER NOW' : (order.paymentStatus === 'paid' ? '✓ CASH PAID' : '⚠ UNPAID')}
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

export function openReceipt(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const html = receiptDocument(order, type, shopName, thermalWidth);
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
// IMAGE RECEIPT MODE (for Bluetooth thermal printer apps on Android)
// Mobile browsers print an A4 page and printer apps shrink it to 58mm,
// which makes text tiny. A PNG sized exactly to the printer's dot width
// (384 dots for 58mm, 576 dots for 80mm) prints at full width and readable.
// ==========================================================================

export const receiptDotWidth = (thermalWidth = '80mm') => (thermalWidth === '58mm' ? 384 : 576);

function layoutReceipt(ctx, draw, W, order, type, shopName) {
  const s = W / 384;
  const pad = Math.round(8 * s);
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
  center(String(shopName || 'MT Bites').toUpperCase(), 36, 900);
  center('KASHMIR - FAST FOOD', 17, 700);
  y += 4 * s;
  boxed(kitchen ? 'KITCHEN TICKET' : 'CUSTOMER BILL', 24);

  // Meta
  row(`Order: ${order.number || ''}`, '', 21, 800);
  row(fmtDate(order.createdAt), '', 20, 700);
  row(`Type: ${order.orderType || ''}${order.tableNumber ? ` - Table ${order.tableNumber}` : ''}`, '', 21, 800);
  if (order.serverName) row(`Staff: ${order.serverName}`, '', 20, 700);
  if (order.customerName) row(`Customer: ${order.customerName}`, '', 20, 700);

  rule();
  row('ITEM', 'AMOUNT', 19, 900);
  rule();

  for (const item of order.items || []) {
    row(`${item.quantity} x ${item.name}`, rs(lineTotal(item)), 23, 800);
    if (item.variant && item.variant !== 'Regular') row(`    ${item.variant}`, '', 19, 700);
  }

  rule();

  if (order.note) {
    row(`NOTE: ${order.note}`, '', 21, 900);
    rule();
  }

  row('Subtotal', rs(order.subtotal), 21, 700);
  if (order.discount) row('Discount', `-${rs(order.discount)}`, 21, 700);
  rule(false, 3);
  row(kitchen ? 'ORDER TOTAL' : 'NET TOTAL', rs(order.total), 30, 900);
  y += 4 * s;
  boxed(kitchen ? 'PREPARE ORDER NOW' : (order.paymentStatus === 'paid' ? 'PAID (CASH)' : 'UNPAID'), 26);

  if (!kitchen && order.paymentStatus === 'paid' && order.cashReceived !== null && order.cashReceived !== undefined) {
    row('Cash Received', rs(order.cashReceived), 21, 700);
    row('Change', rs(order.change), 21, 700);
  }

  y += 4 * s;
  if (!kitchen) {
    center('Thank you for choosing MT Bites!', 18, 700);
    center('Please visit again.', 18, 700);
  } else {
    center(`Kitchen copy - ${order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}`, 18, 700);
  }

  // Extra blank paper at the bottom so the receipt can be torn off cleanly
  y += 40 * s;
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

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function showReceiptImagePreview(dataUrl, fileName, thermalWidth) {
  document.getElementById('mt-receipt-preview')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'mt-receipt-preview';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '9999', background: 'rgba(0,0,0,0.85)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px',
    overflowY: 'auto', gap: '12px'
  });

  const btnStyle = 'padding:12px 16px;border-radius:10px;border:0;font-weight:800;font-size:15px;min-height:44px;cursor:pointer;';
  overlay.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:100%;max-width:420px;">
      <a id="mt-rcpt-dl" href="${dataUrl}" download="${fileName}" style="${btnStyle}background:#fb923c;color:#1a0f06;text-decoration:none;flex:1;text-align:center;">Save Image</a>
      <button id="mt-rcpt-print" style="${btnStyle}background:#fff;color:#000;flex:1;">Print</button>
      <button id="mt-rcpt-close" style="${btnStyle}background:#3b332a;color:#fff;flex:1;">Close</button>
    </div>
    <p style="color:#ddd;font:600 13px Arial;max-width:420px;text-align:center;margin:0;">
      Tip: Save the image and open it in your printer's app (or share it to the printer app) for full-width, clear printing.
    </p>
    <img src="${dataUrl}" alt="Receipt preview" style="width:100%;max-width:${thermalWidth === '58mm' ? 300 : 380}px;background:#fff;border-radius:6px;" />
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#mt-rcpt-close').onclick = () => overlay.remove();
  overlay.querySelector('#mt-rcpt-print').onclick = () => {
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position: 'fixed', width: '0', height: '0', border: '0', visibility: 'hidden' });
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (e) { console.error(e); }
      window.setTimeout(() => iframe.remove(), 120000);
    };
    iframe.srcdoc = `<!doctype html><html><head><style>
      @page { size: ${thermalWidth === '58mm' ? '58mm' : '80mm'} auto; margin: 0; }
      html,body{margin:0;padding:0;background:#fff;}
      img{width:100%;display:block;}
    </style></head><body><img src="${dataUrl}"></body></html>`;
  };
}

/**
 * Generates a printer-width PNG receipt and shares it to a printer app
 * (Android share sheet) or shows a preview with Save / Print buttons.
 */
export async function shareReceiptImage(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const canvas = renderReceiptCanvas(order, type, shopName, thermalWidth);
  const dataUrl = canvas.toDataURL('image/png');
  const fileName = `${order.number || 'receipt'}-${type}.png`;

  try {
    const file = new File([dataUrlToBlob(dataUrl)], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `${type === 'kitchen' ? 'Kitchen Ticket' : 'Customer Bill'} ${order.number || ''}` });
      return 'shared';
    }
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
    console.warn('Share failed, showing preview instead:', err);
  }

  showReceiptImagePreview(dataUrl, fileName, thermalWidth);
  return 'preview';
}

/**
 * Main print entry point. printMode: 'image' (phone + Bluetooth printer app) or 'browser'.
 */
export function printReceipt(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm', printMode = 'image') {
  if (printMode === 'browser') {
    openReceipt(order, type, shopName, thermalWidth);
    return Promise.resolve('browser');
  }
  return shareReceiptImage(order, type, shopName, thermalWidth);
}
