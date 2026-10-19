import React, { useState } from 'react';
import { Package, Plus, Edit3, AlertTriangle, ArrowUpDown, X, Check, Trash2 } from 'lucide-react';
import { db } from '../db.js';
import { generateId } from '../id.js';

export default function InventoryView({ items = [], movements = [], onAttempt }) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [initialQty, setInitialQty] = useState('0');
  const [minThreshold, setMinThreshold] = useState('5');

  // Adjust states
  const [adjustDelta, setAdjustDelta] = useState('0');
  const [adjustReason, setAdjustReason] = useState('Stock purchased');

  const lowStockCount = items.filter(i => i.quantity <= i.minimum).length;

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Delete "${item.name}" from inventory?`)) return;
    await onAttempt(async () => {
      await db.transaction('rw', db.inventory, db.inventoryMovements, async () => {
        await db.inventory.delete(item.id);
        await db.inventoryMovements.where('itemId').equals(item.id).delete();
      });
    }, `"${item.name}" deleted from inventory`);
  };

  const handleClearAllInventory = async () => {
    if (!window.confirm('Delete ALL stock items from inventory? Admin can start fresh.')) return;
    await onAttempt(async () => {
      await db.inventory.clear();
      await db.inventoryMovements.clear();
    }, 'All inventory items cleared');
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Enter an item name.');
    const qty = Number(initialQty);
    const min = Number(minThreshold);
    if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(min) || min < 0) {
      return alert('Enter valid non-negative quantities.');
    }

    const itemId = `inv-${generateId()}`;
    const ok = await onAttempt(() => db.transaction('rw', db.inventory, db.inventoryMovements, async () => {
      await db.inventory.add({
        id: itemId,
        name: name.trim(),
        unit,
        quantity: qty,
        minimum: min,
        category: 'Supplies'
      });
      if (qty > 0) {
        await db.inventoryMovements.add({
          id: `mov-${generateId()}`,
          itemId,
          delta: qty,
          reason: 'Initial opening stock',
          createdAt: new Date().toISOString()
        });
      }
    }), 'Inventory item created');

    if (ok) {
      setAddModalOpen(false);
      setName('');
      setInitialQty('0');
      setMinThreshold('5');
    }
  };

  const handleApplyAdjustment = async (e) => {
    e.preventDefault();
    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      return alert('Enter a non-zero adjustment amount (e.g. +10 or -2).');
    }
    if (adjustTarget.quantity + delta < 0) {
      return alert('Insufficient stock. Quantity cannot become negative.');
    }

    const ok = await onAttempt(() => db.transaction('rw', db.inventory, db.inventoryMovements, async () => {
      const fresh = await db.inventory.get(adjustTarget.id);
      if (!fresh || fresh.quantity + delta < 0) {
        throw new Error('Stock balance would become negative.');
      }
      await db.inventory.update(adjustTarget.id, {
        quantity: fresh.quantity + delta
      });
      await db.inventoryMovements.add({
        id: `mov-${generateId()}`,
        itemId: adjustTarget.id,
        delta,
        reason: adjustReason,
        createdAt: new Date().toISOString()
      });
    }), 'Stock movement recorded');

    if (ok) {
      setAdjustTarget(null);
    }
  };

  return (
    <div className="inventory-view-container">
      <div className="page-heading">
        <div>
          <h1>Inventory & Stock Records</h1>
          <p>Manual ingredient tracking, thresholds, and stock movement logs</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {items.length > 0 && (
            <button
              type="button"
              className="btn btn-outline"
              style={{ borderColor: '#7c2d12', color: '#f87171' }}
              onClick={handleClearAllInventory}
            >
              <Trash2 size={16} />
              <span>Clear All Stock</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus size={17} />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      <div className="inventory-notice">
        <AlertTriangle size={17} />
        <div>
          <strong>Operational Notice:</strong> In MT Bites v0.1, sales do not automatically decrement raw ingredients because menu recipes are not yet configured. Update inventory manually when receiving deliveries or conducting audits.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid kpi-grid-three">
        <div className="kpi-card">
          <span className="kpi-label">Tracked Items</span>
          <strong className="kpi-value">{items.length}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Low Stock Warnings</span>
          <strong className={`kpi-value ${lowStockCount > 0 ? 'text-danger' : ''}`}>
            {lowStockCount}
          </strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Recorded Movements</span>
          <strong className="kpi-value">{movements.length}</strong>
        </div>
      </div>

      {/* Items Table */}
      {items.length > 0 ? (
        <div className="table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>ITEM NAME</th>
                <th>CURRENT STOCK</th>
                <th>MINIMUM LEVEL</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const isLow = item.quantity <= item.minimum;
                return (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>{item.minimum} {item.unit}</td>
                    <td>
                      <span className={`status-pill status-${isLow ? 'unpaid' : 'paid'}`}>
                        {isLow ? 'Low Stock' : 'Sufficient'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-small"
                          onClick={() => {
                            setAdjustTarget(item);
                            setAdjustDelta('0');
                          }}
                        >
                          <ArrowUpDown size={14} />
                          <span>Adjust</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-small"
                          style={{ borderColor: '#7c2d12', color: '#f87171' }}
                          onClick={() => handleDeleteItem(item)}
                          title="Delete item permanently"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <Package size={28} />
          </div>
          <h3>Inventory is empty</h3>
          <p>Add ingredients like chicken, cheese, burger buns, sauces, and cooking oil.</p>
        </div>
      )}

      {/* Add Stock Item Modal */}
      {addModalOpen && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setAddModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Add Stock Item</h2>
              <button type="button" className="icon-button" onClick={() => setAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateItem} className="modal-content stack gap-3">
              <div className="field">
                <label>Item / Ingredient Name</label>
                <input
                  required
                  placeholder="e.g. Boneless Chicken, Mozzarella, Burger Buns"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="field-grid">
                <div className="field">
                  <label>Unit of Measure</label>
                  <select value={unit} onChange={e => setUnit(e.target.value)}>
                    {['kg', 'g', 'pcs', 'L', 'ml', 'boxes', 'packets', 'cans'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Opening Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={initialQty}
                    onChange={e => setInitialQty(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label>Low Stock Warning Threshold</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={minThreshold}
                  onChange={e => setMinThreshold(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full">
                <Check size={18} />
                <span>Save Stock Item</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setAdjustTarget(null); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>Adjust {adjustTarget.name}</h2>
                <p>Current balance: <strong>{adjustTarget.quantity} {adjustTarget.unit}</strong></p>
              </div>
              <button type="button" className="icon-button" onClick={() => setAdjustTarget(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleApplyAdjustment} className="modal-content stack gap-3">
              <div className="field">
                <label>Quantity Change (e.g. +10 for delivery, -2 for waste)</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustDelta}
                  onChange={e => setAdjustDelta(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>Reason for Movement</label>
                <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)}>
                  {[
                    'Stock purchased / Delivery',
                    'Stock adjustment / Audit',
                    'Waste / Damage / Spoilage',
                    'Kitchen consumption',
                    'Stock returned'
                  ].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="projected-stock-card">
                <span>New Projected Balance:</span>
                <strong>
                  {adjustTarget.quantity + (Number(adjustDelta) || 0)} {adjustTarget.unit}
                </strong>
              </div>

              <button type="submit" className="btn btn-primary btn-full">
                <Check size={18} />
                <span>Record Stock Movement</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
