import React, { useMemo } from 'react';
import {
  Wallet, ShoppingBag, Clock, TrendingUp, BarChart3, Flame,
  Package, AlertTriangle, ArrowRight, Plus, CheckCircle2, Coffee,
  FileSpreadsheet
} from 'lucide-react';
import { rs, localDateKey } from '../money.js';

export default function DashboardView({
  orders = [],
  expenses = [],
  inventory = [],
  onNavigate
}) {
  const todayKey = localDateKey();

  const paidOrders = useMemo(() => orders.filter(o => o.paymentStatus === 'paid'), [orders]);
  const unpaidOrders = useMemo(() => orders.filter(o => o.paymentStatus === 'unpaid'), [orders]);

  const todaysOrders = useMemo(() => orders.filter(o => localDateKey(new Date(o.createdAt)) === todayKey), [orders, todayKey]);
  const todaysPaidOrders = useMemo(() => paidOrders.filter(o => localDateKey(new Date(o.paidAt || o.createdAt)) === todayKey), [paidOrders, todayKey]);
  const todaysExpenses = useMemo(() => expenses.filter(e => localDateKey(new Date(e.createdAt)) === todayKey), [expenses, todayKey]);

  const todayRevenue = useMemo(() => todaysPaidOrders.reduce((sum, o) => sum + o.total, 0), [todaysPaidOrders]);
  const todayExpensesTotal = useMemo(() => todaysExpenses.reduce((sum, e) => sum + e.amount, 0), [todaysExpenses]);
  const pendingCashTotal = useMemo(() => unpaidOrders.reduce((sum, o) => sum + o.total, 0), [unpaidOrders]);

  // 7-day revenue trend chart
  const weeklyTrend = useMemo(() => {
    return [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dKey = localDateKey(d);
      const dayTotal = paidOrders
        .filter(o => localDateKey(new Date(o.paidAt || o.createdAt)) === dKey)
        .reduce((sum, o) => sum + o.total, 0);

      return {
        dateStr: dKey,
        dayLabel: d.toLocaleDateString('en-PK', { weekday: 'short' }),
        value: dayTotal
      };
    });
  }, [paidOrders]);

  const maxTrendValue = Math.max(...weeklyTrend.map(t => t.value), 1);

  // Top selling menu items
  const topProducts = useMemo(() => {
    const counts = new Map();
    for (const order of paidOrders) {
      for (const item of order.items || []) {
        counts.set(item.name, (counts.get(item.name) || 0) + item.quantity);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [paidOrders]);

  // Low stock inventory items
  const lowStockItems = useMemo(() => {
    return inventory.filter(item => item.quantity <= item.minimum);
  }, [inventory]);

  return (
    <div className="dashboard-view-container">
      {/* Top Banner */}
      <div className="page-heading">
        <div>
          <h1>Operations Dashboard</h1>
          <p>Real-time sales, order progress, and inventory snapshot</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate('reports')}
          >
            <FileSpreadsheet size={17} />
            <span>Reports & Audits</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate('pos')}
          >
            <Plus size={17} />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card card-gold">
          <div className="kpi-icon-wrap">
            <Wallet size={22} />
          </div>
          <span className="kpi-label">Cash Collected Today</span>
          <strong className="kpi-value">{rs(todayRevenue)}</strong>
          <small className="kpi-sub">From {todaysPaidOrders.length} paid orders</small>
        </div>

        <div className="kpi-card card-lavender">
          <div className="kpi-icon-wrap">
            <ShoppingBag size={22} />
          </div>
          <span className="kpi-label">Orders Taken Today</span>
          <strong className="kpi-value">{todaysOrders.length}</strong>
          <small className="kpi-sub">{todaysOrders.length - todaysPaidOrders.length} pending payment</small>
        </div>

        <div className="kpi-card card-blue">
          <div className="kpi-icon-wrap">
            <Clock size={22} />
          </div>
          <span className="kpi-label">Pending Cash</span>
          <strong className="kpi-value">{rs(pendingCashTotal)}</strong>
          <small className="kpi-sub">{unpaidOrders.length} unpaid orders total</small>
        </div>

        <div className="kpi-card card-coral">
          <div className="kpi-icon-wrap">
            <TrendingUp size={22} />
          </div>
          <span className="kpi-label">Today's Expenses</span>
          <strong className="kpi-value">{rs(todayExpensesTotal)}</strong>
          <small className="kpi-sub">{todaysExpenses.length} entries recorded</small>
        </div>
      </div>

      {/* Charts & Analytics Row */}
      <div className="analytics-grid">
        {/* 7-Day Trend */}
        <section className="panel trend-panel">
          <div className="panel-header">
            <div>
              <h2>Cash Sales Trend</h2>
              <p>Last 7 days · Paid orders only</p>
            </div>
            <BarChart3 size={20} />
          </div>

          <div className="bar-chart-wrap">
            {weeklyTrend.map((col, idx) => {
              const heightPct = col.value ? Math.max((col.value / maxTrendValue) * 100, 5) : 2;
              return (
                <div key={idx} className="bar-column">
                  <span className="bar-num">
                    {col.value ? `${Math.round(col.value / 1000)}k` : '0'}
                  </span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ height: `${heightPct}%` }}
                      title={`${col.dateStr}: ${rs(col.value)}`}
                    />
                  </div>
                  <span className="bar-day">{col.dayLabel}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top 5 Selling Products */}
        <section className="panel top-products-panel">
          <div className="panel-header">
            <div>
              <h2>Top Selling Dishes</h2>
              <p>Ranked by units sold on this device</p>
            </div>
            <Flame size={20} />
          </div>

          {topProducts.length > 0 ? (
            <div className="ranking-table">
              {topProducts.map(([name, count], index) => (
                <div key={name} className="rank-row">
                  <div className={`rank-badge rank-${index + 1}`}>
                    {index + 1}
                  </div>
                  <strong className="rank-name">{name}</strong>
                  <span className="rank-count">{count} sold</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-subpanel">
              <Coffee size={28} />
              <p>No paid orders recorded yet.</p>
            </div>
          )}
        </section>
      </div>

      {/* Inventory & Cash Flow Breakdown Row */}
      <div className="analytics-grid">
        {/* Stock Alerts */}
        <section className="panel stock-alerts-panel">
          <div className="panel-header">
            <div>
              <h2>Stock Alerts</h2>
              <p>Items at or below minimum threshold</p>
            </div>
            <Package size={20} />
          </div>

          {lowStockItems.length > 0 ? (
            <div className="stock-alert-list">
              {lowStockItems.slice(0, 5).map(item => (
                <div key={item.id} className="stock-alert-row">
                  <span className="stock-warn-icon">!</span>
                  <div className="stock-alert-info">
                    <strong>{item.name}</strong>
                    <small>Threshold: {item.minimum} {item.unit}</small>
                  </div>
                  <strong className="stock-current-qty">
                    {item.quantity} {item.unit}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-subpanel">
              <CheckCircle2 size={28} className="success-icon" />
              <p>All stock levels are currently above minimum threshold.</p>
            </div>
          )}

          <button
            type="button"
            className="text-link-btn"
            onClick={() => onNavigate('inventory')}
          >
            <span>Manage Inventory & Ingredients</span>
            <ArrowRight size={15} />
          </button>
        </section>

        {/* Operational Cash Snapshot with Disclaimer */}
        <section className="panel cash-flow-panel">
          <div className="panel-header">
            <div>
              <h2>Operational Cash Snapshot</h2>
              <p>Today's cash inflow vs entered expenses</p>
            </div>
            <Wallet size={20} />
          </div>

          <div className="cash-breakdown-box">
            <div className="cash-row">
              <span>Cash Collected (Paid Orders):</span>
              <strong>{rs(todayRevenue)}</strong>
            </div>
            <div className="cash-row">
              <span>Recorded Cash Expenses:</span>
              <strong className="expense-text">-{rs(todayExpensesTotal)}</strong>
            </div>
            <div className="cash-row cash-net-highlight">
              <span>Net Cash Flow Today:</span>
              <strong className="net-cash-val">{rs(todayRevenue - todayExpensesTotal)}</strong>
            </div>
          </div>

          <div className="accounting-disclaimer">
            <AlertTriangle size={15} />
            <p>
              <strong>Accounting Note:</strong> True restaurant net profit requires automated ingredient recipe costing, payroll, rent amortization, and spoilage valuation. This figure represents operational cash balance only.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
