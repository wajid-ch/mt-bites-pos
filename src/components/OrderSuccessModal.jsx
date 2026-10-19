import React from 'react';
import { CheckCircle2, ChefHat, Printer, Banknote, ClipboardList, Plus, X } from 'lucide-react';
import { rs } from '../money.js';

export default function OrderSuccessModal({
  order,
  onClose,
  onPrintOrder,
  onCollectCash,
  onViewOrders,
  onNewOrder
}) {
  if (!order) return null;

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-success" role="dialog" aria-modal="true" aria-label="Order Saved Successfully">
        <div className="modal-header">
          <div>
            <span className="order-pill-badge">ORDER #{order.number}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="success-banner">
            <div className="success-icon-wrap">
              <CheckCircle2 size={48} />
            </div>
            <h2>Order Saved!</h2>
            <p className="success-sub">
              Saved locally to IndexedDB as <strong>UNPAID</strong>
            </p>
            <div className="success-details-card">
              <div className="detail-row">
                <span>Total Amount:</span>
                <strong className="detail-total">{rs(order.total)}</strong>
              </div>
              <div className="detail-row">
                <span>Order Type:</span>
                <strong>{order.orderType}{order.tableNumber ? ` · Table ${order.tableNumber}` : ''}</strong>
              </div>
              <div className="detail-row">
                <span>Items:</span>
                <strong>{order.items.reduce((s, i) => s + i.quantity, 0)} items</strong>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="success-actions-stack">
            <button
              type="button"
              className="btn btn-primary btn-full success-btn"
              onClick={() => onPrintOrder(order, 'kitchen')}
            >
              <ChefHat size={18} />
              <span>Print Kitchen Ticket</span>
            </button>

            <button
              type="button"
              className="btn btn-outline btn-full success-btn"
              onClick={() => onPrintOrder(order, 'customer')}
            >
              <Printer size={18} />
              <span>Print Customer Bill</span>
            </button>

            <button
              type="button"
              className="btn btn-outline btn-full success-btn btn-cash"
              onClick={() => onCollectCash(order)}
            >
              <Banknote size={18} />
              <span>Collect Cash Now</span>
            </button>

            <div className="success-footer-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onNewOrder}
              >
                <Plus size={16} />
                <span>Take Next Order</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onViewOrders}
              >
                <ClipboardList size={16} />
                <span>All Orders</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
