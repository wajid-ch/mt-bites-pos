import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { rs, lineTotal } from './money.js';

function safeCsv(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(filename, rows) {
  const csvContent = '\uFEFF' + rows.map(r => r.map(safeCsv).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function filterByDateRange(records, dateField, startDate, endDate) {
  if (!startDate && !endDate) return records;
  const start = startDate ? `${startDate}T00:00:00` : '1970-01-01T00:00:00';
  const end = endDate ? `${endDate}T23:59:59.999` : '2099-12-31T23:59:59.999';

  return records.filter(item => {
    const rawVal = item[dateField];
    if (!rawVal) return false;
    const dateStr = typeof rawVal === 'string' ? rawVal : new Date(rawVal).toISOString();
    return dateStr >= start && dateStr <= end;
  });
}

function initPdfDoc(title, subtitle, periodLabel, startDate, endDate) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Brand Header Bar
  doc.setFillColor(26, 21, 17); // Dark Charcoal #1a1511
  doc.rect(0, 0, 210, 32, 'F');

  // Accent Line
  doc.setFillColor(251, 146, 60); // Amber/Orange #fb923c
  doc.rect(0, 32, 210, 2, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('MT BITES FAST FOOD', 14, 13);

  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(251, 146, 60);
  doc.text(title.toUpperCase(), 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 190, 180);
  doc.text(`Period: ${periodLabel} (${startDate || 'All'} to ${endDate || 'Present'})  |  Generated: ${new Date().toLocaleString('en-PK')}`, 14, 27);

  return doc;
}

function addPdfFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 130, 120);
    doc.text(`MT Bites POS Audit System  •  Page ${i} of ${pageCount}`, 14, 290);
    doc.text('Confidential Restaurant Document', 150, 290);
  }
}

/**
 * SALES & BILLS REPORT (CSV & PDF)
 */
export function exportSalesAndBillsReport({ orders, startDate, endDate, periodLabel = 'Custom', format = 'csv' }) {
  const filteredOrders = filterByDateRange(orders, 'createdAt', startDate, endDate);

  if (format === 'pdf') {
    const doc = initPdfDoc('Sales & Bills Audit Report', 'Detailed transaction and billing records', periodLabel, startDate, endDate);

    let totalPaid = 0;
    let totalUnpaid = 0;

    const tableBody = filteredOrders.map(o => {
      if (o.paymentStatus === 'paid') totalPaid += o.total || 0;
      else totalUnpaid += o.total || 0;

      const itemsSummary = (o.items || [])
        .map(i => `${i.name}${i.variant && i.variant !== 'Regular' ? ` (${i.variant})` : ''} x${i.quantity}`)
        .join(', ');

      return [
        o.number,
        new Date(o.createdAt).toLocaleDateString('en-PK') + ' ' + new Date(o.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }),
        o.tableNumber ? `Table #${o.tableNumber}` : (o.orderType || 'Takeaway'),
        (o.status || '').toUpperCase(),
        (o.paymentStatus || '').toUpperCase(),
        itemsSummary,
        `Rs. ${(o.total || 0).toLocaleString('en-PK')}`
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Order #', 'Date & Time', 'Type / Table', 'Status', 'Payment', 'Items Summary', 'Total (PKR)']],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [35, 27, 20], textColor: [251, 146, 60], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 246, 244] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 26 },
        1: { cellWidth: 26 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 'auto' },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 24 }
      }
    });

    const finalY = (doc.lastAutoTable?.finalY || 40) + 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`Total Orders: ${filteredOrders.length}`, 14, finalY);
    doc.text(`Paid Cash Collected: Rs. ${totalPaid.toLocaleString('en-PK')}`, 14, finalY + 5);
    doc.text(`Pending Unpaid: Rs. ${totalUnpaid.toLocaleString('en-PK')}`, 14, finalY + 10);
    doc.text(`Total Sales Value: Rs. ${(totalPaid + totalUnpaid).toLocaleString('en-PK')}`, 14, finalY + 15);

    addPdfFooter(doc);
    doc.save(`MT-Bites-Sales-Bills-${periodLabel.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    return;
  }

  // CSV format
  const rows = [
    ['MT BITES — SALES & BILLS REPORT'],
    [`Period: ${periodLabel}`, `From: ${startDate || 'All Time'}`, `To: ${endDate || 'Present'}`],
    [`Generated: ${new Date().toLocaleString('en-PK')}`],
    [],
    ['Order #', 'Date & Time', 'Order Type', 'Table #', 'Staff / Waiter', 'Status', 'Payment Status', 'Items Summary', 'Total Items Qty', 'Discount (PKR)', 'Total Bill (PKR)']
  ];

  let totalSales = 0;
  let totalPaidSales = 0;
  let totalUnpaidSales = 0;
  let totalItemsCount = 0;

  for (const o of filteredOrders) {
    const itemsSummary = (o.items || []).map(i => `${i.name}${i.variant && i.variant !== 'Regular' ? ` (${i.variant})` : ''} x${i.quantity}`).join('; ');
    const itemsQty = (o.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
    totalSales += o.total || 0;
    if (o.paymentStatus === 'paid') totalPaidSales += o.total || 0;
    else totalUnpaidSales += o.total || 0;
    totalItemsCount += itemsQty;

    rows.push([
      o.number,
      new Date(o.createdAt).toLocaleString('en-PK'),
      o.orderType || 'Dine-in',
      o.tableNumber ? `#${o.tableNumber}` : '—',
      o.staffName || 'Staff',
      (o.status || '').toUpperCase(),
      (o.paymentStatus || '').toUpperCase(),
      itemsSummary,
      itemsQty,
      o.discount || 0,
      o.total || 0
    ]);
  }

  rows.push([]);
  rows.push(['SUMMARY TOTALS']);
  rows.push(['Total Orders:', filteredOrders.length]);
  rows.push(['Total Units Sold:', totalItemsCount]);
  rows.push(['Total Cash Collected (Paid):', totalPaidSales]);
  rows.push(['Pending Unpaid Bills:', totalUnpaidSales]);
  rows.push(['Gross Sales Value:', totalSales]);

  downloadCsv(`MT-Bites-Sales-Report-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${startDate || 'start'}_to_${endDate || 'end'}.csv`, rows);
}

/**
 * DISHES & THINGS SOLD REPORT (CSV & PDF)
 */
export function exportThingsSoldReport({ orders, startDate, endDate, periodLabel = 'Custom', format = 'csv' }) {
  const filteredOrders = filterByDateRange(orders, 'createdAt', startDate, endDate);

  const itemMap = new Map();
  for (const order of filteredOrders) {
    for (const item of order.items || []) {
      const key = `${item.name}__${item.variant || 'Regular'}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          name: item.name,
          variant: item.variant || 'Regular',
          unitPrice: item.unitPrice || 0,
          quantity: 0,
          totalRevenue: 0,
          ordersCount: 0
        });
      }
      const data = itemMap.get(key);
      data.quantity += item.quantity || 0;
      data.totalRevenue += lineTotal(item);
      data.ordersCount += 1;
    }
  }

  const sortedItems = [...itemMap.values()].sort((a, b) => b.quantity - a.quantity);

  if (format === 'pdf') {
    const doc = initPdfDoc('Dishes & Things Sold Report', 'Product popularity, servings sold, and menu revenue', periodLabel, startDate, endDate);

    let grandQty = 0;
    let grandRevenue = 0;

    const tableBody = sortedItems.map((item, idx) => {
      grandQty += item.quantity;
      grandRevenue += item.totalRevenue;
      return [
        idx + 1,
        item.name,
        item.variant,
        `Rs. ${item.unitPrice.toLocaleString('en-PK')}`,
        item.quantity,
        item.ordersCount,
        `Rs. ${item.totalRevenue.toLocaleString('en-PK')}`
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Dish / Product Name', 'Size / Variant', 'Unit Price', 'Servings Sold', 'Orders Count', 'Total Sales']],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.8 },
      headStyles: { fillColor: [35, 27, 20], textColor: [251, 146, 60], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 246, 244] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { fontStyle: 'bold', cellWidth: 'auto' },
        2: { cellWidth: 26 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
        5: { halign: 'center', cellWidth: 24 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 28 }
      }
    });

    const finalY = (doc.lastAutoTable?.finalY || 40) + 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`Distinct Menu Items Sold: ${sortedItems.length}`, 14, finalY);
    doc.text(`Total Food Servings Sold: ${grandQty}`, 14, finalY + 5);
    doc.text(`Gross Dish Sales: Rs. ${grandRevenue.toLocaleString('en-PK')}`, 14, finalY + 10);

    addPdfFooter(doc);
    doc.save(`MT-Bites-Dishes-Sold-${periodLabel.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    return;
  }

  // CSV format
  const rows = [
    ['MT BITES — DISHES & ITEMS SOLD REPORT'],
    [`Period: ${periodLabel}`, `From: ${startDate || 'All Time'}`, `To: ${endDate || 'Present'}`],
    [`Generated: ${new Date().toLocaleString('en-PK')}`],
    [],
    ['Rank', 'Dish / Product Name', 'Size / Variant', 'Unit Price (PKR)', 'Units Sold', 'Orders Count', 'Total Sales (PKR)']
  ];

  let grandQty = 0;
  let grandRevenue = 0;
  sortedItems.forEach((item, index) => {
    grandQty += item.quantity;
    grandRevenue += item.totalRevenue;
    rows.push([index + 1, item.name, item.variant, item.unitPrice, item.quantity, item.ordersCount, item.totalRevenue]);
  });

  rows.push([]);
  rows.push(['SUMMARY TOTALS']);
  rows.push(['Total Distinct Menu Items Sold:', sortedItems.length]);
  rows.push(['Total Food Servings / Units Sold:', grandQty]);
  rows.push(['Total Gross Dish Sales (PKR):', grandRevenue]);

  downloadCsv(`MT-Bites-Dishes-Sold-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${startDate || 'start'}_to_${endDate || 'end'}.csv`, rows);
}

/**
 * EXPENSES REPORT (CSV & PDF)
 */
export function exportExpensesReport({ expenses, startDate, endDate, periodLabel = 'Custom', format = 'csv' }) {
  const filteredExpenses = filterByDateRange(expenses, 'createdAt', startDate, endDate);

  if (format === 'pdf') {
    const doc = initPdfDoc('Expenses Audit Report', 'Detailed expenditure logs and category analysis', periodLabel, startDate, endDate);

    let totalExpenses = 0;
    const catMap = new Map();

    const tableBody = filteredExpenses.map(exp => {
      totalExpenses += exp.amount || 0;
      catMap.set(exp.category || 'General', (catMap.get(exp.category || 'General') || 0) + (exp.amount || 0));

      return [
        new Date(exp.createdAt).toLocaleDateString('en-PK'),
        exp.category || 'General',
        exp.description || exp.reason || '—',
        exp.paymentMethod || 'Cash',
        `Rs. ${(exp.amount || 0).toLocaleString('en-PK')}`
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Category', 'Expense Description / Reason', 'Payment Method', 'Amount (PKR)']],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.8 },
      headStyles: { fillColor: [35, 27, 20], textColor: [251, 146, 60], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 246, 244] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 30, fontStyle: 'bold' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 26 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 28 }
      }
    });

    const finalY = (doc.lastAutoTable?.finalY || 40) + 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`Total Expense Logs: ${filteredExpenses.length}`, 14, finalY);
    doc.text(`Total Expenses Amount: Rs. ${totalExpenses.toLocaleString('en-PK')}`, 14, finalY + 5);

    addPdfFooter(doc);
    doc.save(`MT-Bites-Expenses-${periodLabel.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    return;
  }

  // CSV format
  const rows = [
    ['MT BITES — EXPENSES REPORT'],
    [`Period: ${periodLabel}`, `From: ${startDate || 'All Time'}`, `To: ${endDate || 'Present'}`],
    [`Generated: ${new Date().toLocaleString('en-PK')}`],
    [],
    ['Date & Time', 'Category', 'Expense Description / Reason', 'Payment Method', 'Amount (PKR)']
  ];

  let totalExpenses = 0;
  const categoryTotals = new Map();
  for (const exp of filteredExpenses) {
    totalExpenses += exp.amount || 0;
    categoryTotals.set(exp.category || 'General', (categoryTotals.get(exp.category || 'General') || 0) + (exp.amount || 0));
    rows.push([
      new Date(exp.createdAt).toLocaleString('en-PK'),
      exp.category || 'General',
      exp.description || exp.reason || '—',
      exp.paymentMethod || 'Cash',
      exp.amount || 0
    ]);
  }

  rows.push([]);
  rows.push(['EXPENSE CATEGORY BREAKDOWN']);
  for (const [cat, sum] of categoryTotals.entries()) {
    rows.push([`${cat}:`, sum]);
  }
  rows.push([]);
  rows.push(['TOTAL EXPENSES (PKR):', totalExpenses]);

  downloadCsv(`MT-Bites-Expenses-Report-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${startDate || 'start'}_to_${endDate || 'end'}.csv`, rows);
}

/**
 * INVENTORY & STOCK AUDIT REPORT (CSV & PDF)
 */
export function exportInventoryReport({ inventory, movements, startDate, endDate, periodLabel = 'Custom', format = 'csv' }) {
  const filteredMovements = filterByDateRange(movements || [], 'createdAt', startDate, endDate);

  if (format === 'pdf') {
    const doc = initPdfDoc('Inventory & Stock Audit Report', 'Current ingredient stock levels and movements', periodLabel, startDate, endDate);

    let totalVal = 0;
    let lowCount = 0;

    const tableBody = inventory.map(item => {
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.unitCost) || 0;
      const val = qty * cost;
      totalVal += val;
      const isLow = qty <= (item.minimum || 0);
      if (isLow) lowCount++;

      return [
        item.name,
        item.category || 'General',
        `${qty} ${item.unit || 'pcs'}`,
        `${item.minimum || 0} ${item.unit || 'pcs'}`,
        `Rs. ${cost.toLocaleString('en-PK')}`,
        `Rs. ${val.toLocaleString('en-PK')}`,
        isLow ? 'LOW STOCK' : 'HEALTHY'
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Item Name', 'Category', 'Quantity', 'Min Threshold', 'Unit Cost', 'Est Value', 'Status']],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.8 },
      headStyles: { fillColor: [35, 27, 20], textColor: [251, 146, 60], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 246, 244] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 'auto' },
        1: { cellWidth: 26 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 22 },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
        6: { halign: 'center', fontStyle: 'bold', cellWidth: 22 }
      }
    });

    const finalY = (doc.lastAutoTable?.finalY || 40) + 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`Total Tracked Stock Items: ${inventory.length}`, 14, finalY);
    doc.text(`Items at/below minimum threshold: ${lowCount}`, 14, finalY + 5);
    doc.text(`Total Estimated Inventory Valuation: Rs. ${totalVal.toLocaleString('en-PK')}`, 14, finalY + 10);

    addPdfFooter(doc);
    doc.save(`MT-Bites-Inventory-${periodLabel.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    return;
  }

  // CSV format
  const rows = [
    ['MT BITES — INVENTORY STATUS & AUDIT REPORT'],
    [`Period: ${periodLabel}`, `From: ${startDate || 'All Time'}`, `To: ${endDate || 'Present'}`],
    [`Generated: ${new Date().toLocaleString('en-PK')}`],
    [],
    ['=== CURRENT STOCK VALUATION ==='],
    ['Item Name', 'Category', 'Current Quantity', 'Unit of Measure', 'Min Threshold', 'Unit Cost (PKR)', 'Est Total Value (PKR)', 'Status']
  ];

  let totalStockValuation = 0;
  let lowStockCount = 0;

  for (const item of inventory) {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.unitCost) || 0;
    const itemVal = qty * cost;
    totalStockValuation += itemVal;
    const isLow = qty <= (item.minimum || 0);
    if (isLow) lowStockCount++;

    rows.push([
      item.name,
      item.category || 'General',
      qty,
      item.unit || 'pcs',
      item.minimum || 0,
      cost,
      itemVal,
      isLow ? 'LOW STOCK' : 'HEALTHY'
    ]);
  }

  rows.push([]);
  rows.push(['Total Inventory Items Count:', inventory.length]);
  rows.push(['Items at or Below Minimum Threshold:', lowStockCount]);
  rows.push(['Total Estimated Inventory Valuation (PKR):', totalStockValuation]);

  if (filteredMovements.length > 0) {
    rows.push([]);
    rows.push(['=== STOCK MOVEMENTS & LOGS IN PERIOD ===']);
    rows.push(['Date & Time', 'Item Name', 'Movement Type', 'Quantity Changed', 'Reason / Reference', 'Logged By']);

    for (const m of filteredMovements) {
      const parentItem = inventory.find(i => i.id === m.itemId);
      rows.push([
        new Date(m.createdAt).toLocaleString('en-PK'),
        parentItem ? parentItem.name : (m.itemName || m.itemId),
        (m.type || '').toUpperCase(),
        m.quantityChange,
        m.reason || '—',
        m.staffName || 'Admin'
      ]);
    }
  }

  downloadCsv(`MT-Bites-Inventory-Report-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${startDate || 'start'}_to_${endDate || 'end'}.csv`, rows);
}

/**
 * EXECUTIVE OPERATIONS REPORT (CSV & PDF)
 */
export function exportComprehensiveExecutiveReport({ orders, expenses, inventory, movements, startDate, endDate, periodLabel = 'Custom', format = 'pdf' }) {
  const filteredOrders = filterByDateRange(orders, 'createdAt', startDate, endDate);
  const filteredExpenses = filterByDateRange(expenses, 'createdAt', startDate, endDate);

  const paidOrders = filteredOrders.filter(o => o.paymentStatus === 'paid');
  const unpaidOrders = filteredOrders.filter(o => o.paymentStatus === 'unpaid');

  const cashCollected = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingCash = unpaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalSalesVal = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netCashFlow = cashCollected - totalExpenses;

  if (format === 'pdf') {
    const doc = initPdfDoc('Executive Operations & Financial Audit', 'Comprehensive business performance overview', periodLabel, startDate, endDate);

    // Financial KPI Table
    autoTable(doc, {
      startY: 40,
      head: [['Financial Performance Metric', 'Amount (PKR)']],
      body: [
        ['Total Cash Collected (Paid Orders)', `Rs. ${cashCollected.toLocaleString('en-PK')}`],
        ['Recorded Operating Cash Expenses', `Rs. ${totalExpenses.toLocaleString('en-PK')}`],
        ['Net Operational Cash Flow (Inflow - Expenses)', `Rs. ${netCashFlow.toLocaleString('en-PK')}`],
        ['Pending Cash from Unpaid Orders', `Rs. ${pendingCash.toLocaleString('en-PK')}`],
        ['Total Gross Sales Booked', `Rs. ${totalSalesVal.toLocaleString('en-PK')}`]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3.2 },
      headStyles: { fillColor: [35, 27, 20], textColor: [251, 146, 60], fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right', fontStyle: 'bold', textColor: [20, 20, 20] }
      }
    });

    // Operational Activities Table
    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY || 40) + 10,
      head: [['Operational Activity', 'Count']],
      body: [
        ['Total Orders Processed', String(filteredOrders.length)],
        ['Paid Completed Orders', String(paidOrders.length)],
        ['Pending / Unpaid Bills', String(unpaidOrders.length)],
        ['Expense Logs Recorded', String(filteredExpenses.length)],
        ['Active Menu Stock Items Tracked', String(inventory.length)],
        ['Items Below Minimum Safety Threshold', String(inventory.filter(i => (i.quantity || 0) <= (i.minimum || 0)).length)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3.2 },
      headStyles: { fillColor: [35, 27, 20], textColor: [251, 146, 60], fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' }
      }
    });

    const finalY = (doc.lastAutoTable?.finalY || 40) + 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(110, 100, 90);
    doc.text('Note: This document reflects operational cash inflows and entered expenditures recorded on the MT Bites POS system.', 14, finalY);

    addPdfFooter(doc);
    doc.save(`MT-Bites-Executive-Report-${periodLabel.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    return;
  }

  // CSV format
  const rows = [
    ['========================================================'],
    ['MT BITES FAST FOOD — EXECUTIVE OPERATIONS REPORT'],
    [`Period: ${periodLabel}`],
    [`Range: ${startDate || 'Beginning'} to ${endDate || 'Current'}`],
    [`Generated On: ${new Date().toLocaleString('en-PK')}`],
    ['========================================================'],
    [],
    ['1. FINANCIAL SNAPSHOT'],
    ['Metric', 'Value (PKR)'],
    ['Total Cash Collected (Paid Orders):', cashCollected],
    ['Recorded Cash Expenses:', totalExpenses],
    ['Net Operational Cash Flow (Inflow - Expenses):', netCashFlow],
    ['Pending Cash from Unpaid Orders:', pendingCash],
    ['Total Gross Sales Booked:', totalSalesVal],
    [],
    ['2. OPERATIONAL ACTIVITY'],
    ['Total Orders Taken:', filteredOrders.length],
    ['Paid Completed Orders:', paidOrders.length],
    ['Pending / Unpaid Orders:', unpaidOrders.length],
    ['Total Recorded Expense Entries:', filteredExpenses.length],
    [],
    ['3. CURRENT INVENTORY SUMMARY'],
    ['Total Inventory Items Tracked:', inventory.length],
    ['Items Requiring Restock (Low):', inventory.filter(i => (i.quantity || 0) <= (i.minimum || 0)).length]
  ];

  downloadCsv(`MT-Bites-Executive-Summary-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${startDate || 'start'}_to_${endDate || 'end'}.csv`, rows);
}
