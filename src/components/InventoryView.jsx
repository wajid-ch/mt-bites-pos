import React, { useState, useMemo } from 'react';
import {
  Package, Plus, AlertTriangle, ArrowUpDown, X, Check, Trash2, CupSoda, History, RefreshCw, Printer
} from 'lucide-react';
import { db } from '../db.js';
import { generateId } from '../id.js';
import { fmtDate } from '../money.js';
import {
  INVENTORY_CATEGORIES,
  COLD_DRINK_BRANDS,
  BOTTLE_SIZES
} from '../inventory-templates.js';
import {
  pushInventoryToCloud,
  deleteInventoryFromCloud,
  clearInventoryFromCloud,
  applyInventoryDeltaCloud,
  pushInventoryMovementToCloud
} from '../supabase.js';

export default function InventoryView({ items = [], movements = [], onAttempt, onSyncNow, onPrintInventory }) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [syncingNow, setSyncingNow] = useState(false);

  // Form states
  const [category, setCategory] = useState('Beverages & Cold Drinks');
  const [brand, setBrand] = useState('Pepsi');
  const [bottleSize, setBottleSize] = useState('500ml');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('bottles');
  const [initialQty, setInitialQty] = useState('24');
  const [minThreshold, setMinThreshold] = useState('6');

  // Adjust states
  const [adjustDelta, setAdjustDelta] = useState('0');
  const [adjustReason, setAdjustReason] = useState('Stock purchased / Delivery');

  const isDrinkCategory = category === 'Beverages & Cold Drinks';

  const openAddModal = (presetCategory = 'Beverages & Cold Drinks') => {
    setCategory(presetCategory);
    if (presetCategory === 'Beverages & Cold Drinks') {
      setBrand('Pepsi');
      setBottleSize('500ml');
      setUnit('bottles');
      setInitialQty('24');
      setMinThreshold('6');
      setName('');
    } else {
      setUnit('kg');
      setInitialQty('0');
      setMinThreshold('5');
      setName('');
    }
    setAddModalOpen(true);
  };

  const lowStockCount = items.filter(i => i.quantity <= i.minimum).length;
  const drinkCount = items.filter(i => i.category === 'Beverages & Cold Drinks').length;

  const filteredItems = useMemo(() => {
    const list = selectedCategory === 'All'
      ? items
      : items.filter(i => (i.category || 'Supplies') === selectedCategory);
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [items, selectedCategory]);

  const recentMovements = useMemo(() => {
    const byId = new Map(items.map(i => [i.id, i]));
    return [...movements]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 25)
      .map(m => ({ ...m, item: byId.get(m.itemId) }));
  }, [movements, items]);

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Delete "${item.name}" from inventory?`)) return;
    await onAttempt(async () => {
      await db.transaction('rw', db.inventory, db.inventoryMovements, async () => {
        await db.inventory.delete(item.id);
        await db.inventoryMovements.where('itemId').equals(item.id).delete();
      });
      await deleteInventoryFromCloud(item.id);
    }, `"${item.name}" deleted from inventory`);
  };

  const handleClearAllInventory = async () => {
    if (!window.confirm('Delete ALL stock items from inventory on all synced devices? Admin can start fresh.')) return;
    await onAttempt(async () => {
      await db.inventory.clear();
      await db.inventoryMovements.clear();
      await clearInventoryFromCloud();
    }, 'All inventory items cleared');
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    let finalName = name.trim();
    if (isDrinkCategory && brand !== 'Custom') {
      const sizePart = bottleSize === 'Custom' ? finalName : bottleSize;
      finalName = brand === 'Custom'
        ? finalName
        : `${brand}${sizePart ? ` (${sizePart})` : ''}`.trim();
    }

    if (!finalName) return alert('Enter an item / bottle name.');
    const qty = Number(initialQty);
    const min = Number(minThreshold);
    if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(min) || min < 0) {
      return alert('Enter valid non-negative quantities.');
    }

    // If an item with the exact same name & category already exists, top up its stock instead of duplicating
    const existingSame = items.find(
      i => i.name.trim().toLowerCase() === finalName.toLowerCase() && (i.category || '') === category
    );

    if (existingSame) {
      const nextQty = Number(existingSame.quantity || 0) + qty;
      const updated = { ...existingSame, quantity: nextQty, minimum: min, unit };
      const mov = {
        id: `mov-${generateId()}`,
        itemId: existingSame.id,
        delta: qty,
        reason: 'Restock added',
        createdAt: new Date().toISOString()
      };
      const ok = await onAttempt(async () => {
        await db.transaction('rw', db.inventory, db.inventoryMovements, async () => {
          await db.inventory.put(updated);
          if (qty > 0) await db.inventoryMovements.add(mov);
        });
        await applyInventoryDeltaCloud(existingSame.id, qty, updated);
        if (qty > 0) await pushInventoryMovementToCloud(mov);
      }, `Added +${qty} ${unit} to ${finalName}`);
      if (ok) {
        setAddModalOpen(false);
        setName('');
      }
      return;
    }

    const itemId = `inv-${generateId()}`;
    const newItem = {
      id: itemId,
      name: finalName,
      unit,
      quantity: qty,
      minimum: min,
      category
    };
    const initialMov = qty > 0
      ? {
          id: `mov-${generateId()}`,
          itemId,
          delta: qty,
          reason: 'Initial opening stock',
          createdAt: new Date().toISOString()
        }
      : null;

    let cloudNotice = '';
    const ok = await onAttempt(async () => {
      await db.transaction('rw', db.inventory, db.inventoryMovements, async () => {
        await db.inventory.add(newItem);
        if (initialMov) await db.inventoryMovements.add(initialMov);
      });
      const cloudRes = await pushInventoryToCloud(newItem);
      if (!cloudRes?.ok) {
        cloudNotice = ` (Cloud sync pending: ${cloudRes?.error || cloudRes?.reason || 'offline'})`;
      } else if (initialMov) {
        await pushInventoryMovementToCloud(initialMov);
      }
    }, null);

    if (ok) {
      alert(`"${finalName}" saved!${cloudNotice || ' Synced to cloud.'}`);
      setAddModalOpen(false);
      setName('');
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

    let updatedItem = null;
    const mov = {
      id: `mov-${generateId()}`,
      itemId: adjustTarget.id,
      delta,
      reason: adjustReason,
      createdAt: new Date().toISOString()
    };

    const ok = await onAttempt(async () => {
      await db.transaction('rw', db.inventory, db.inventoryMovements, async () => {
        const fresh = await db.inventory.get(adjustTarget.id);
        if (!fresh || fresh.quantity + delta < 0) {
          throw new Error('Stock balance would become negative.');
        }
        updatedItem = { ...fresh, quantity: fresh.quantity + delta };
        await db.inventory.put(updatedItem);
        await db.inventoryMovements.add(mov);
      });
      await applyInventoryDeltaCloud(adjustTarget.id, delta, updatedItem);
      await pushInventoryMovementToCloud(mov);
    }, 'Stock movement recorded & synced');

    if (ok) {
      setAdjustTarget(null);
    }
  };

  const existingCategories = ['All', ...INVENTORY_CATEGORIES];

  return (
    <div className="inventory-view-container">
      <div className="page-heading">
        <div>
          <h1>Inventory & Cold Drink Stock</h1>
          <p>Real-time synced stock across all devices, cold drink bottles, and automatic order deductions</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onPrintInventory && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onPrintInventory(filteredItems, movements, selectedCategory)}
            >
              <Printer size={16} />
              <span>Print Stock &amp; Logs</span>
            </button>
          )}
          {onSyncNow && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={syncingNow}
              onClick={async () => {
                setSyncingNow(true);
                try { await onSyncNow(); } finally { setSyncingNow(false); }
              }}
            >
              <RefreshCw size={16} className={syncingNow ? 'spinner' : ''} />
              <span>{syncingNow ? 'Syncing…' : 'Sync Cloud'}</span>
            </button>
          )}
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
            className="btn btn-outline"
            onClick={() => openAddModal('Beverages & Cold Drinks')}
          >
            <CupSoda size={17} />
            <span>Add Cold Drink Bottles</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openAddModal('Raw Meat')}
          >
            <Plus size={17} />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid kpi-grid-three">
        <div className="kpi-card">
          <span className="kpi-label">Tracked Items ({drinkCount} Drinks)</span>
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

      {/* Category Filter Pills */}
      <div className="orders-filter-pills" style={{ marginBottom: '12px' }}>
        {existingCategories.map(cat => {
          const count = cat === 'All'
            ? items.length
            : items.filter(i => (i.category || 'Supplies') === cat).length;
          if (cat !== 'All' && cat !== 'Beverages & Cold Drinks' && count === 0) return null;
          return (
            <button
              key={cat}
              type="button"
              className={`chip ${selectedCategory === cat ? 'chip-selected' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              <span>{cat}</span>
              <span className="chip-counter">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Items Table */}
      {filteredItems.length > 0 ? (
        <div className="table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>ITEM NAME</th>
                <th>CATEGORY</th>
                <th>CURRENT STOCK</th>
                <th>MIN LEVEL</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const isLow = item.quantity <= item.minimum;
                return (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td><span className="expense-category-chip">{item.category || 'Supplies'}</span></td>
                    <td><strong>{item.quantity}</strong> {item.unit}</td>
                    <td>{item.minimum} {item.unit}</td>
                    <td>
                      <span className={`status-pill status-${isLow ? 'unpaid' : 'paid'}`}>
                        {item.quantity <= 0 ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
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
          <h3>No inventory items in this category</h3>
          <p>Tap "Add Cold Drink Bottles" to add Pepsi, Coke, 7Up, Sprite, Dew, or add kitchen ingredients manually.</p>
        </div>
      )}

      {/* Recent Stock Movements Log */}
      {recentMovements.length > 0 && (
        <div className="table-panel" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px 8px' }}>
            <History size={18} color="#fb923c" />
            <h3 style={{ margin: 0, fontSize: '15px' }}>Recent Stock Movements (Auto-Deductions & Restocks)</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>DATE & TIME</th>
                <th>ITEM</th>
                <th>CHANGE</th>
                <th>REASON</th>
              </tr>
            </thead>
            <tbody>
              {recentMovements.map(m => (
                <tr key={m.id}>
                  <td>{fmtDate(m.createdAt)}</td>
                  <td><strong>{m.item?.name || 'Removed Item'}</strong></td>
                  <td>
                    <strong style={{ color: m.delta > 0 ? '#34d399' : '#f87171' }}>
                      {m.delta > 0 ? `+${m.delta}` : m.delta} {m.item?.unit || ''}
                    </strong>
                  </td>
                  <td>{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Stock Item Modal */}
      {addModalOpen && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setAddModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>{isDrinkCategory ? 'Add Cold Drink Bottles' : 'Add Stock Item'}</h2>
              <button type="button" className="icon-button" onClick={() => setAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateItem} className="modal-content stack gap-3">
              <div className="field">
                <label>Category</label>
                <select
                  value={category}
                  onChange={e => {
                    const nextCat = e.target.value;
                    setCategory(nextCat);
                    if (nextCat === 'Beverages & Cold Drinks') setUnit('bottles');
                    else if (unit === 'bottles') setUnit('kg');
                  }}
                >
                  {INVENTORY_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {isDrinkCategory && (
                <div className="field-grid">
                  <div className="field">
                    <label>Cold Drink Brand</label>
                    <select value={brand} onChange={e => setBrand(e.target.value)}>
                      {COLD_DRINK_BRANDS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Bottle Size</label>
                    <select
                      value={bottleSize}
                      onChange={e => {
                        const s = e.target.value;
                        setBottleSize(s);
                        if (s.startsWith('Can')) setUnit('cans');
                        else setUnit('bottles');
                      }}
                    >
                      {BOTTLE_SIZES.map(sz => (
                        <option key={sz} value={sz}>{sz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {(!isDrinkCategory || brand === 'Custom' || bottleSize === 'Custom') && (
                <div className="field">
                  <label>
                    {isDrinkCategory && brand !== 'Custom'
                      ? `Custom Size for ${brand}`
                      : 'Item / Drink Name (Manual)'}
                  </label>
                  <input
                    required
                    placeholder={isDrinkCategory ? 'e.g. Pakola 500ml or Red Bull 250ml' : 'e.g. Boneless Chicken, Mozzarella, Burger Buns'}
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="field-grid">
                <div className="field">
                  <label>Unit of Measure</label>
                  <select value={unit} onChange={e => setUnit(e.target.value)}>
                    {['bottles', 'cans', 'pcs', 'kg', 'g', 'L', 'ml', 'boxes', 'packets', 'rolls'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Quantity in Stock</label>
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
                <span>Save & Sync Stock Item</span>
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
                <label>Quantity Change (e.g. +24 for delivery, -2 for waste)</label>
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
                <span>Record & Sync Movement</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
