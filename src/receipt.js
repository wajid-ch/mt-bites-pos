import { fmtDate, rs, lineTotal } from './money.js';

export function receiptDocument(order, type = 'customer', shopName = 'MT Bites', thermalWidth = '80mm') {
  const safe = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kitchen = type === 'kitchen';
  const is58 = thermalWidth === '58mm';
  const pageSize = is58 ? '58mm auto' : '80mm auto';
  const bodyWidth = is58 ? '50mm' : '74mm';
  const fontSize = is58 ? '11px' : '12px';
  const titleSize = is58 ? '17px' : '20px';

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
    @page { size: ${pageSize}; margin: 2mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: ${fontSize};
      width: ${bodyWidth};
      margin: 0 auto;
      color: #000;
      line-height: 1.35;
      background: #fff;
    }
    .header { text-align: center; margin-bottom: 8px; }
    h1 { margin: 0; font-size: ${titleSize}; letter-spacing: -0.5px; text-transform: uppercase; font-weight: 900; }
    .brand-sub { font-size: 10px; letter-spacing: 1.5px; margin-top: 2px; }
    .badge {
      display: inline-block;
      border: 1px solid #000;
      padding: 3px 8px;
      margin: 6px 0;
      font-weight: 800;
      font-size: ${is58 ? '12px' : '13px'};
      letter-spacing: 0.5px;
    }
    .meta-table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 11px; }
    .meta-table td { padding: 1px 0; }
    .rule { border-top: 1px dashed #000; margin: 6px 0; }
    .rule-double { border-top: 2px solid #000; margin: 6px 0; }
    table.items { width: 100%; border-collapse: collapse; font-size: ${fontSize}; }
    table.items th { border-bottom: 1px dashed #000; padding: 4px 1px; font-weight: 700; font-size: 10px; }
    table.items td { padding: 4px 1px; vertical-align: top; }
    .qty { width: 34px; text-align: center; font-weight: 900; font-size: 13px; }
    .right { text-align: right; white-space: nowrap; }
    .variant-label { font-size: 10px; color: #333; }
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
    .footer { text-align: center; font-size: 10px; margin-top: 8px; }
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
