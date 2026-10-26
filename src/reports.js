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

/**
 * Generates and downloads Sales & Bills Report as CSV
 */
export function exportSalesAndBillsReport({ orders, startDate, endDate, periodLabel = 'Custom' }) {
  const filteredOrders = filterByDateRange(orders, 'createdAt', startDate, endDate);

  const rows = [
    ['MT BITES — SALES & BILLS REPORT'],
    [`Period: ${periodLabel}`, `From: ${startDate || 'All Time'}`, `To: ${endDate || 'Present'}`],
    [`Generated: ${new Date().toLocaleString('en-PK')}`],
    [],
    [
      'Order #',
      'Date & Time',
      'Order Type',
      'Table #',
      'Staff / Waiter',
      'Status',
      'Payment Status',
      'Items Summary',
      'Total Items Qty',
      'Discount (PKR)',
      'Total Bill (PKR)'
    ]
  ];

  let totalSales = 0;
  let totalPaidSales = 0;
  let totalUnpaidSales = 0;
  let totalItemsCount = 0;

  for (const o of filteredOrders) {
    const itemsSummary = (o.items || [])
      .map(i => `${i.name}${i.variant && i.variant !== 'Regular' ? ` (${i.variant})` : ''} x${i.quantity}`)
      .join('; ');
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

  const filename = `MT-Bites-Sales-Report-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${startDate || 'start'}_to_${endDate || 'end'}.csv`;
  downloadCsv(filename, rows);
}

/**
 * Generates and downloads Dishes / Things Sold Breakdown Report
 */
export function exportThingsSoldReport({ orders, startDate, endDate, periodLabel = 'Custom' }) {
  const filteredOrders = filterByDateRange(orders, 'createdAt', startDate, endDate);

  // Group by item name + variant
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
    rows.push([
      index + 1,
      item.name,
      item.variant,
      item.unitPrice,
      item.quantity,
      item.ordersCount,
      item.totalRevenue
    ]);
  });

  rows.push([]);
  rows.push(['SUMMARY TOTALS']);
  rows.push(['Total Distinct Menu Items Sold:', sortedItems.length]);
  rows.push(['Total Food Servings / Units Sold:', grandQty]);
  rows.push(['Total Gross Dish Sales (PKR):', grandRevenue]);

  const filename = `MT-Bites-Dishes-Sold-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${startDate || 'start'}_to_${endDate || 'end'}.csv`;
  downloadCsv(filename, rows);
}

/**
 * Generates and downloads Expenses Report
 */
export function exportExpensesReport({ expenses, startDate, endDate, periodLabel = 'Custom' }) {
  const filteredExpenses = filterByDateRange(expenses, 'createdAt', startDate, endDate);

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

  const filename = `MT-Bites-Expenses-Report-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${startDate || 'start'}_to_${endDate || 'end'}.csv`;
  downloadCsv(filename, rows);
}

/**
 * Generates and downloads Inventory & Stock Movements Report
 */
export function exportInventoryReport({ inventory, movements, startDate, endDate, periodLabel = 'Custom' }) {
  const filteredMovements = filterByDateRange(movements || [], 'createdAt', startDate, endDate);

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

  const filename = `MT-Bites-Inventory-Report-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${startDate || 'start'}_to_${endDate || 'end'}.csv`;
  downloadCsv(filename, rows);
}

/**
 * Generates an executive comprehensive printable / CSV summary combining Sales, Expenses, and Stock
 */
export function exportComprehensiveExecutiveReport({ orders, expenses, inventory, movements, startDate, endDate, periodLabel = 'Custom' }) {
  const filteredOrders = filterByDateRange(orders, 'createdAt', startDate, endDate);
  const filteredExpenses = filterByDateRange(expenses, 'createdAt', startDate, endDate);

  const paidOrders = filteredOrders.filter(o => o.paymentStatus === 'paid');
  const unpaidOrders = filteredOrders.filter(o => o.paymentStatus === 'unpaid');

  const cashCollected = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingCash = unpaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalSalesVal = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netCashFlow = cashCollected - totalExpenses;

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

  const filename = `MT-Bites-Executive-Summary-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${startDate || 'start'}_to_${endDate || 'end'}.csv`;
  downloadCsv(filename, rows);
}
