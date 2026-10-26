import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Package,
  Layers,
  CheckCircle2,
  Filter,
  Printer,
  ChevronRight,
  Flame,
  ArrowDownToLine,
  Receipt
} from 'lucide-react';
import { rs, localDateKey, lineTotal } from '../money.js';
import {
  exportSalesAndBillsReport,
  exportThingsSoldReport,
  exportExpensesReport,
  exportInventoryReport,
  exportComprehensiveExecutiveReport,
  filterByDateRange
} from '../reports.js';

export default function ReportsView({
  orders = [],
  expenses = [],
  inventory = [],
  movements = [],
  onNavigate
}) {
  // Preset options: 'today', 'yesterday', 'this_week', 'this_month', 'last_month', 'custom', 'all'
  const [preset, setPreset] = useState('today');

  const todayStr = useMemo(() => localDateKey(new Date()), []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDateKey(d);
  }, []);

  const weekStartStr = useMemo(() => {
    const d = new Date();
    // Start of current week (Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return localDateKey(monday);
  }, []);

  const monthStartStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  const lastMonthRange = useMemo(() => {
    const d = new Date();
    const prevMonthEnd = new Date(d.getFullYear(), d.getMonth(), 0);
    const prevMonthStart = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return {
      start: localDateKey(prevMonthStart),
      end: localDateKey(prevMonthEnd)
    };
  }, []);

  // Custom date picker states
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);

  // Active calculated date range
  const { startDate, endDate, periodLabel } = useMemo(() => {
    switch (preset) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr, periodLabel: 'Today' };
      case 'yesterday':
        return { startDate: yesterdayStr, endDate: yesterdayStr, periodLabel: 'Yesterday' };
      case 'this_week':
        return { startDate: weekStartStr, endDate: todayStr, periodLabel: 'This Week' };
      case 'this_month':
        return { startDate: monthStartStr, endDate: todayStr, periodLabel: 'This Month' };
      case 'last_month':
        return { startDate: lastMonthRange.start, endDate: lastMonthRange.end, periodLabel: 'Last Month' };
      case 'all':
        return { startDate: '', endDate: '', periodLabel: 'All Time' };
      case 'custom':
      default:
        return { startDate: customStart, endDate: customEnd, periodLabel: `Custom (${customStart} to ${customEnd})` };
    }
  }, [preset, todayStr, yesterdayStr, weekStartStr, monthStartStr, lastMonthRange, customStart, customEnd]);

  // Filtered live dataset for previews
  const filteredOrders = useMemo(() => {
    return filterByDateRange(orders, 'createdAt', startDate, endDate);
  }, [orders, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    return filterByDateRange(expenses, 'createdAt', startDate, endDate);
  }, [expenses, startDate, endDate]);

  const paidOrders = useMemo(() => filteredOrders.filter(o => o.paymentStatus === 'paid'), [filteredOrders]);
  const unpaidOrders = useMemo(() => filteredOrders.filter(o => o.paymentStatus === 'unpaid'), [filteredOrders]);

  const cashInflow = useMemo(() => paidOrders.reduce((sum, o) => sum + (o.total || 0), 0), [paidOrders]);
  const expensesSum = useMemo(() => filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0), [filteredExpenses]);
  const netCashBalance = cashInflow - expensesSum;
  const pendingCash = useMemo(() => unpaidOrders.reduce((sum, o) => sum + (o.total || 0), 0), [unpaidOrders]);

  // Things sold summary in selected period
  const dishesSoldSummary = useMemo(() => {
    const map = new Map();
    for (const o of filteredOrders) {
      for (const i of o.items || []) {
        const k = `${i.name} (${i.variant || 'Regular'})`;
        const existing = map.get(k) || { name: i.name, variant: i.variant || 'Regular', qty: 0, revenue: 0 };
        existing.qty += i.quantity || 0;
        existing.revenue += lineTotal(i);
        map.set(k, existing);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [filteredOrders]);

  const totalServingsSold = useMemo(() => {
    return dishesSoldSummary.reduce((sum, item) => sum + item.qty, 0);
  }, [dishesSoldSummary]);

  return (
    <div className="reports-page-container">
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1>Financial & Operational Reports</h1>
          <p>Download daily, weekly, monthly, and custom-dated audits for sales, dishes sold, expenses, and inventory.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => exportComprehensiveExecutiveReport({
            orders,
            expenses,
            inventory,
            movements,
            startDate,
            endDate,
            periodLabel
          })}
        >
          <ArrowDownToLine size={18} />
          <span>Download Executive Summary</span>
        </button>
      </div>

      {/* Date Filter & Presets Card */}
      <div className="panel report-filter-panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} color="#fb923c" />
            <h2 style={{ margin: 0 }}>Select Report Period</h2>
          </div>
          <span className="period-badge">{periodLabel}</span>
        </div>

        {/* Quick Date Presets Bar */}
        <div className="report-preset-pills">
          <button
            type="button"
            className={`preset-pill ${preset === 'today' ? 'active' : ''}`}
            onClick={() => setPreset('today')}
          >
            Today (آج)
          </button>
          <button
            type="button"
            className={`preset-pill ${preset === 'yesterday' ? 'active' : ''}`}
            onClick={() => setPreset('yesterday')}
          >
            Yesterday (کل)
          </button>
          <button
            type="button"
            className={`preset-pill ${preset === 'this_week' ? 'active' : ''}`}
            onClick={() => setPreset('this_week')}
          >
            This Week (اس ہفتے)
          </button>
          <button
            type="button"
            className={`preset-pill ${preset === 'this_month' ? 'active' : ''}`}
            onClick={() => setPreset('this_month')}
          >
            This Month (اس ماہ)
          </button>
          <button
            type="button"
            className={`preset-pill ${preset === 'last_month' ? 'active' : ''}`}
            onClick={() => setPreset('last_month')}
          >
            Last Month (گزشتہ ماہ)
          </button>
          <button
            type="button"
            className={`preset-pill ${preset === 'all' ? 'active' : ''}`}
            onClick={() => setPreset('all')}
          >
            All Time (تمام ریکارڈ)
          </button>
          <button
            type="button"
            className={`preset-pill ${preset === 'custom' ? 'active' : ''}`}
            onClick={() => setPreset('custom')}
          >
            Custom Dates (تاریخ منتخب کریں)
          </button>
        </div>

        {/* Custom Date Pickers */}
        {preset === 'custom' && (
          <div className="custom-dates-row">
            <div className="date-input-group">
              <label>From Date (شروع تاریخ):</label>
              <input
                type="date"
                value={customStart}
                max={customEnd || todayStr}
                onChange={e => setCustomStart(e.target.value)}
              />
            </div>
            <div className="date-input-group">
              <label>To Date (اختتامی تاریخ):</label>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={todayStr}
                onChange={e => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Period Metrics Summary Cards */}
      <div className="kpi-grid">
        <div className="kpi-card card-gold">
          <div className="kpi-icon-wrap">
            <DollarSign size={22} />
          </div>
          <span className="kpi-label">Cash Collected</span>
          <strong className="kpi-value">{rs(cashInflow)}</strong>
          <small className="kpi-sub">{paidOrders.length} paid orders</small>
        </div>

        <div className="kpi-card card-coral">
          <div className="kpi-icon-wrap">
            <Receipt size={22} />
          </div>
          <span className="kpi-label">Total Expenses</span>
          <strong className="kpi-value">{rs(expensesSum)}</strong>
          <small className="kpi-sub">{filteredExpenses.length} expense entries</small>
        </div>

        <div className="kpi-card card-blue">
          <div className="kpi-icon-wrap">
            <TrendingUp size={22} />
          </div>
          <span className="kpi-label">Net Cash In-Hand</span>
          <strong className="kpi-value">{rs(netCashBalance)}</strong>
          <small className="kpi-sub">Inflow minus expenses</small>
        </div>

        <div className="kpi-card card-lavender">
          <div className="kpi-icon-wrap">
            <ShoppingBag size={22} />
          </div>
          <span className="kpi-label">Items Sold</span>
          <strong className="kpi-value">{totalServingsSold}</strong>
          <small className="kpi-sub">Across {filteredOrders.length} orders</small>
        </div>
      </div>

      {/* Individual Download Cards Grid */}
      <div className="report-cards-grid">
        {/* 1. Sales & Bills Report */}
        <div className="panel report-action-card">
          <div className="report-card-top">
            <div className="report-icon-box gold">
              <Receipt size={24} />
            </div>
            <div>
              <h3>Sales & Bills Report</h3>
              <p>Individual order numbers, waiter name, table, cash amounts, status and discounts.</p>
            </div>
          </div>

          <div className="report-card-stats">
            <div>
              <span>Orders:</span>
              <strong>{filteredOrders.length}</strong>
            </div>
            <div>
              <span>Total Volume:</span>
              <strong>{rs(cashInflow + pendingCash)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={() => exportSalesAndBillsReport({ orders, startDate, endDate, periodLabel })}
          >
            <Download size={16} />
            <span>Download Sales CSV</span>
          </button>
        </div>

        {/* 2. Dishes / Things Sold Report */}
        <div className="panel report-action-card">
          <div className="report-card-top">
            <div className="report-icon-box lavender">
              <Flame size={24} />
            </div>
            <div>
              <h3>Dishes & Things Sold</h3>
              <p>Detailed item-by-item breakdown of quantities sold, popular dishes, and item revenue.</p>
            </div>
          </div>

          <div className="report-card-stats">
            <div>
              <span>Distinct Items:</span>
              <strong>{dishesSoldSummary.length}</strong>
            </div>
            <div>
              <span>Servings Sold:</span>
              <strong>{totalServingsSold}</strong>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={() => exportThingsSoldReport({ orders, startDate, endDate, periodLabel })}
          >
            <Download size={16} />
            <span>Download Dishes Sold CSV</span>
          </button>
        </div>

        {/* 3. Expenses Report */}
        <div className="panel report-action-card">
          <div className="report-card-top">
            <div className="report-icon-box coral">
              <DollarSign size={24} />
            </div>
            <div>
              <h3>Expenses Report</h3>
              <p>Categorized spending logs: kitchen supplies, ingredients, utilities, maintenance, and staff wages.</p>
            </div>
          </div>

          <div className="report-card-stats">
            <div>
              <span>Entries:</span>
              <strong>{filteredExpenses.length}</strong>
            </div>
            <div>
              <span>Total Amount:</span>
              <strong>{rs(expensesSum)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={() => exportExpensesReport({ expenses, startDate, endDate, periodLabel })}
          >
            <Download size={16} />
            <span>Download Expenses CSV</span>
          </button>
        </div>

        {/* 4. Inventory Valuation & Audit */}
        <div className="panel report-action-card">
          <div className="report-card-top">
            <div className="report-icon-box blue">
              <Package size={24} />
            </div>
            <div>
              <h3>Inventory & Audit Report</h3>
              <p>Current stock levels, ingredient costs, inventory valuations, low-stock warnings, and period logs.</p>
            </div>
          </div>

          <div className="report-card-stats">
            <div>
              <span>Tracked Stock:</span>
              <strong>{inventory.length} items</strong>
            </div>
            <div>
              <span>Stock Logs:</span>
              <strong>{movements.length}</strong>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={() => exportInventoryReport({ inventory, movements, startDate, endDate, periodLabel })}
          >
            <Download size={16} />
            <span>Download Inventory CSV</span>
          </button>
        </div>
      </div>

      {/* Live Preview Table of Dishes Sold in Selected Period */}
      <div className="panel report-preview-panel">
        <div className="panel-header">
          <div>
            <h2>Dishes Sold in Period ({periodLabel})</h2>
            <p>Live snapshot before downloading CSV</p>
          </div>
          <span className="badge">{dishesSoldSummary.length} Items</span>
        </div>

        {dishesSoldSummary.length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Dish / Product Name</th>
                  <th>Size / Variant</th>
                  <th>Quantity Sold</th>
                  <th>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {dishesSoldSummary.slice(0, 10).map((dish, idx) => (
                  <tr key={idx}>
                    <td><strong>{idx + 1}</strong></td>
                    <td><strong>{dish.name}</strong></td>
                    <td><span className="variant-pill">{dish.variant}</span></td>
                    <td><strong>{dish.qty}</strong></td>
                    <td><strong style={{ color: '#fb923c' }}>{rs(dish.revenue)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-subpanel" style={{ padding: '30px', textAlign: 'center' }}>
            <p>No orders recorded in this date period ({periodLabel}).</p>
          </div>
        )}
      </div>
    </div>
  );
}
