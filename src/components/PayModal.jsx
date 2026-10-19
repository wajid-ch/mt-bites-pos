import React, { useState } from 'react';
import { Check, X, Banknote, AlertCircle } from 'lucide-react';
import { rs, parseAmount } from '../money.js';

export default function PayModal({ order, onClose, onConfirmPayment }) {
  if (!order) return null;

  const [receivedStr, setReceivedStr] = useState(String(order.total));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amount = parseAmount(receivedStr);
  const isValid = amount !== null && amount >= order.total;
  const change = isValid ? amount - order.total : 0;

  // Generate sensible quick cash suggestions
  const suggestions = [
    order.total,
    Math.ceil(order.total / 100) * 100,
    Math.ceil(order.total / 500) * 500,
    Math.ceil(order.total / 1000) * 1000,
    5000
  ].filter((val, idx, arr) => val >= order.total && arr.indexOf(val) === idx).slice(0, 5);

  const handleConfirm = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirmPayment(order, receivedStr);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-pay" role="dialog" aria-modal="true" aria-label={`Collect cash for order ${order.number}`}>
        <div className="modal-header">
          <div>
            <h2>Collect Cash Payment</h2>
            <p>{order.number} · {order.orderType}{order.tableNumber ? ` · Table ${order.tableNumber}` : ''}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="pay-amount-box">
            <span className="pay-amount-label">AMOUNT DUE</span>
            <strong className="pay-amount-val">{rs(order.total)}</strong>
          </div>

          <div className="field">
            <label htmlFor="cash-received-input">Cash Received from Customer (Rs.)</label>
            <input
              id="cash-received-input"
              type="number"
              min={order.total}
              step="1"
              autoFocus
              className="cash-input-large"
              value={receivedStr}
              onChange={e => setReceivedStr(e.target.value)}
            />
          </div>

          {/* Quick Cash Buttons */}
          <div className="quick-cash-row">
            {suggestions.map(sug => (
              <button
                key={sug}
                type="button"
                className={`quick-cash-chip ${amount === sug ? 'chip-active' : ''}`}
                onClick={() => setReceivedStr(String(sug))}
              >
                {rs(sug)}
              </button>
            ))}
          </div>

          {/* Change Due Display */}
          <div className="change-due-card">
            <span>Change to Return:</span>
            <strong className={`change-val ${change > 0 ? 'has-change' : ''}`}>
              {isValid ? rs(change) : '—'}
            </strong>
          </div>

          {amount !== null && amount < order.total && (
            <div className="pay-warning-banner">
              <AlertCircle size={15} />
              <span>Remaining balance needed: {rs(order.total - amount)}</span>
            </div>
          )}

          <button
            type="button"
            disabled={!isValid || isSubmitting}
            className="btn btn-primary btn-full btn-large confirm-pay-btn"
            onClick={handleConfirm}
          >
            <Check size={20} />
            <span>{isSubmitting ? 'Recording Cash…' : `Confirm Cash Paid (${rs(order.total)})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
