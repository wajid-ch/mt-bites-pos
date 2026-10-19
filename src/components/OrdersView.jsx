import React, { useState, useMemo } from 'react';
import { Search, ChefHat, Printer, Banknote, ChevronRight, Check, X, Clock, ClipboardList } from 'lucide-react';
import { rs, fmtDate } from '../money.js';

export default function OrdersView({
  orders = [],
  onPrintOrder,
  onCollectCash,
  onUpdateOrderStatus
}) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const unpaidCount = useMemo(() => orders.filter(o => o.paymentStatus === 'unpaid').length, [orders]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(order => {
      // Status / Payment filter
      if (filter === 'unpaid' && order.paymentStatus !== 'unpaid') return false;
      if (['new', 'preparing', 'ready', 'completed'].includes(filter) && order.status !== filter) return false;

      // Query filter
      if (!q) return true;
      const itemsText = (order.items || []).map(i => `${i.name} ${i.variant || ''}`).join(' ');
      const haystack = `${order.number} ${order.tableNumber || ''} ${order.customerName || ''} ${order.orderType} ${itemsText}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, filter, query]);

  const filterTabs = [
    { id: 'all', label: 'All Orders', count: orders.length },
    { id: 'unpaid', label: 'Unpaid', count: unpaidCount, highlight: unpaidCount > 0 },
    { id: 'new', label: 'New', count: orders.filter(o => o.status === 'new').length },
    { id: 'preparing', label: 'Preparing', count: orders.filter(o => o.status === 'preparing').length },
    { id: 'ready', label: 'Ready', count: orders.filter(o => o.status === 'ready').length },
    { id: 'completed', label: 'Completed', count: orders.filter(o => o.status === 'completed').length }
  ];

  return (
    <div className="orders-view-container">
      {/* Header toolbar */}
      <div className="orders-toolbar">
        <div className="search-input orders-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search order #, table, customer, food…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="search-clear-btn" onClick={() => setQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="orders-filter-pills">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`chip ${filter === tab.id ? 'chip-selected' : ''} ${tab.highlight ? 'chip-badge-warn' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="chip-counter">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders List Grid */}
      {filteredOrders.length > 0 ? (
        <div className="orders-cards-grid">
          {filteredOrders.map(order => {
            const itemCount = (order.items || []).reduce((s, i) => s + i.quantity, 0);

            return (
              <article key={order.id} className={`order-card status-border-${order.status}`}>
                {/* Order Top Bar */}
                <div className="order-card-header">
                  <div>
                    <div className="order-number-row">
                      <strong className="order-number">{order.number}</strong>
                      <span className="order-time">{fmtDate(order.createdAt)}</span>
                    </div>
                    <div className="order-type-tag">
                      <strong>{order.orderType}</strong>
                      {order.tableNumber && <span> · Table {order.tableNumber}</span>}
                      {order.customerName && <span> · {order.customerName}</span>}
                    </div>
                  </div>

                  <div className="order-status-tags">
                    <span className={`status-pill status-${order.status}`}>
                      {order.status}
                    </span>
                    <span className={`status-pill status-${order.paymentStatus === 'paid' ? 'paid' : 'unpaid'}`}>
                      {order.paymentStatus === 'paid' ? 'CASH PAID' : 'UNPAID'}
                    </span>
                  </div>
                </div>

                {/* Items preview list */}
                <div className="order-items-preview">
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} className="order-item-chip">
                      <span className="item-chip-qty">{item.quantity}×</span>
                      <span className="item-chip-name">{item.name}</span>
                      {item.variant && item.variant !== 'Regular' && (
                        <span className="item-chip-variant">({item.variant})</span>
                      )}
                    </div>
                  ))}
                </div>

                {order.note && (
                  <div className="order-note-callout">
                    <strong>Note:</strong> {order.note}
                  </div>
                )}

                {/* Order Bottom / Actions */}
                <div className="order-card-footer">
                  <div className="order-card-money">
                    <span className="order-items-count">{itemCount} items</span>
                    <strong className="order-total-amount">{rs(order.total)}</strong>
                  </div>

                  <div className="order-action-buttons">
                    <button
                      type="button"
                      className="btn-order-action"
                      onClick={() => onPrintOrder(order, 'kitchen')}
                      title="Print Kitchen Ticket"
                    >
                      <ChefHat size={15} />
                      <span>Kitchen</span>
                    </button>

                    <button
                      type="button"
                      className="btn-order-action"
                      onClick={() => onPrintOrder(order, 'customer')}
                      title="Print Customer Bill"
                    >
                      <Printer size={15} />
                      <span>Bill</span>
                    </button>

                    {order.paymentStatus === 'unpaid' && (
                      <button
                        type="button"
                        className="btn-order-action action-pay"
                        onClick={() => onCollectCash(order)}
                      >
                        <Banknote size={15} />
                        <span>Collect Cash</span>
                      </button>
                    )}

                    {/* Order Status Advancement */}
                    {order.status === 'new' && (
                      <button
                        type="button"
                        className="btn-order-action action-advance"
                        onClick={() => onUpdateOrderStatus(order, 'preparing')}
                      >
                        <span>Start Prep</span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button
                        type="button"
                        className="btn-order-action action-advance"
                        onClick={() => onUpdateOrderStatus(order, 'ready')}
                      >
                        <span>Mark Ready</span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <button
                        type="button"
                        className="btn-order-action action-complete"
                        onClick={() => onUpdateOrderStatus(order, 'completed')}
                      >
                        <Check size={15} />
                        <span>Done</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <ClipboardList size={30} />
          </div>
          <h3>No orders match your filter</h3>
          <p>Orders saved locally on this device will appear here.</p>
        </div>
      )}
    </div>
  );
}
