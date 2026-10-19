import React from 'react';
import { X, Minus, Plus, ShoppingBag, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { rs, cartSubtotal, cartTotal, parseAmount } from '../money.js';

export default function CartDrawer({
  isOpen,
  onClose,
  cart = [],
  onAdjustCart,
  onClearCart,
  orderType,
  setOrderType,
  tableNumber,
  setTableNumber,
  customerName,
  setCustomerName,
  note,
  setNote,
  discountInput,
  setDiscountInput,
  onSaveOrder,
  isSaving
}) {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartSubtotal(cart);
  const parsedDiscount = parseAmount(discountInput) ?? 0;
  const isDiscountValid = parseAmount(discountInput) !== null;
  const isDiscountExcessive = parsedDiscount > subtotal;
  const total = cartTotal(cart, parsedDiscount);

  const canSave = cart.length > 0 && !isSaving && isDiscountValid && !isDiscountExcessive;

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`cart-backdrop ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />

      {/* Cart Container (Sheet on mobile, sidebar on desktop) */}
      <aside className={`cart-panel ${isOpen ? 'cart-open' : ''}`}>
        {/* Cart Header */}
        <div className="cart-header">
          <div>
            <h2>
              Current Order <span className="cart-badge">{count}</span>
            </h2>
            <p className="cart-header-sub">
              {orderType} {tableNumber ? `· Table ${tableNumber}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="cart-close-btn"
            onClick={onClose}
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cart Scrollable Content */}
        <div className="cart-body">
          {/* Order Details Accordion / Fields */}
          <div className="cart-meta-fields">
            <div className="field-grid">
              {orderType === 'Dine-in' && (
                <div className="field">
                  <label htmlFor="cart-table-input">Table Number</label>
                  <input
                    id="cart-table-input"
                    placeholder="e.g. 04"
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="cart-cust-input">Customer (Optional)</label>
                <input
                  id="cart-cust-input"
                  placeholder="Customer name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="cart-section-title">
            <span>Items Selected</span>
            {cart.length > 0 && (
              <button
                type="button"
                className="clear-cart-btn"
                onClick={onClearCart}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Cart Items List */}
          {cart.length > 0 ? (
            <div className="cart-items-list">
              {cart.map(item => (
                <div key={item.key} className="cart-item-row">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.name}</span>
                    <span className="cart-item-meta">
                      {item.variant !== 'Regular' ? `${item.variant} · ` : ''}{rs(item.unitPrice)} each
                    </span>
                    <span className="cart-item-total">
                      {rs(item.unitPrice * item.quantity)}
                    </span>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="qty-stepper">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name}`}
                      onClick={() => onAdjustCart(item.key, -1)}
                      className="stepper-btn"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="stepper-val">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.name}`}
                      onClick={() => onAdjustCart(item.key, 1)}
                      className="stepper-btn"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-cart-state">
              <div className="empty-cart-icon">
                <ShoppingBag size={32} />
              </div>
              <h4>Your cart is empty</h4>
              <p>Tap delicious items from the menu to build your order.</p>
            </div>
          )}

          {/* Kitchen Notes */}
          <div className="field cart-note-field">
            <label htmlFor="kitchen-instructions">Kitchen Instructions (Optional)</label>
            <textarea
              id="kitchen-instructions"
              rows="2"
              placeholder="e.g. Less spicy, extra sauce, well done…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Cart Footer */}
        <div className="cart-footer">
          <div className="summary-row">
            <span>Subtotal</span>
            <strong>{rs(subtotal)}</strong>
          </div>

          <div className="summary-row discount-row">
            <label htmlFor="order-discount">Discount (Rs.)</label>
            <input
              id="order-discount"
              type="number"
              min="0"
              step="1"
              className={`discount-input-field ${!isDiscountValid || isDiscountExcessive ? 'input-error' : ''}`}
              value={discountInput}
              onChange={e => setDiscountInput(e.target.value)}
            />
          </div>

          {isDiscountExcessive && (
            <div className="cart-validation-error">
              <AlertCircle size={14} />
              <span>Discount cannot exceed subtotal</span>
            </div>
          )}

          <div className="grand-total-row">
            <span>TOTAL</span>
            <strong>{rs(total)}</strong>
          </div>

          {/* Main Save Order Button */}
          <button
            type="button"
            disabled={!canSave}
            className={`btn btn-primary btn-full btn-large save-order-cta ${isSaving ? 'btn-loading' : ''}`}
            onClick={onSaveOrder}
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="spinner" />
                <span>Saving Order to Local DB…</span>
              </>
            ) : (
              <>
                <span>Save Order ({rs(total)})</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {!cart.length && (
            <p className="cart-disabled-hint">Add at least one item to save the order</p>
          )}
          <p className="cart-payment-tip">
            Saved as <strong>UNPAID</strong> · Kitchen ticket ready immediately
          </p>
        </div>
      </aside>
    </>
  );
}
