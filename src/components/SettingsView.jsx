import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Download, Upload, FileSpreadsheet, Check,
  AlertTriangle, Printer, WifiOff, Trash2, RotateCcw
} from 'lucide-react';
import { db, exportBackup, restoreBackup } from '../db.js';
import { localDateKey } from '../money.js';
import { clearTestOrdersCloud, clearTestExpensesCloud } from '../supabase.js';

function downloadFile(name, contents, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function SettingsView({
  orders = [],
  shopName = 'MT Bites',
  thermalWidth = '80mm',
  onAttempt,
  onReload
}) {
  const [name, setName] = useState(shopName);
  const [paperWidth, setPaperWidth] = useState(thermalWidth);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => setName(shopName), [shopName]);
  useEffect(() => setPaperWidth(thermalWidth), [thermalWidth]);

  const handleSaveStoreSettings = async () => {
    if (!name.trim()) return alert('Restaurant name cannot be blank.');
    await onAttempt(async () => {
      await db.settings.put({ key: 'shopName', value: name.trim() });
      await db.settings.put({ key: 'thermalWidth', value: paperWidth });
    }, 'Store settings saved');
  };

  const handleBackupDownload = async () => {
    setIsBusy(true);
    try {
      const data = await exportBackup();
      downloadFile(`mt-bites-backup-${localDateKey()}.json`, data);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const confirmed = window.confirm(
      'WARNING: Restoring will overwrite current local database records with the backup file. ' +
      'Make sure you have downloaded a current backup first. Proceed?'
    );
    if (!confirmed) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await onAttempt(async () => {
        await restoreBackup(parsed);
      }, 'Backup restored successfully');
      if (onReload) await onReload();
    } catch (err) {
      alert(`Restore failed: ${err.message}`);
    }
  };

  const handleClearTestOrders = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear all TEST ORDERS?\n\n' +
      'This will reset all orders, bills, and cash totals back to zero. ' +
      'Your menu items, prices, and staff accounts will stay intact.'
    );
    if (!confirmed) return;

    await onAttempt(async () => {
      await db.orders.clear();
      await clearTestOrdersCloud();
      if (onReload) await onReload();
    }, 'All test orders and bills have been cleared');
  };

  const handleClearTestExpenses = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear all TEST EXPENSES?\n\n' +
      'This will wipe out all recorded test expenses and set expenses to Rs. 0.'
    );
    if (!confirmed) return;

    await onAttempt(async () => {
      await db.expenses.clear();
      await clearTestExpensesCloud();
      if (onReload) await onReload();
    }, 'All test expenses have been cleared');
  };

  const handleClearAllTestData = async () => {
    const confirmed = window.confirm(
      'RESET ALL TEST DATA (FRESH START)?\n\n' +
      'This will clear:\n' +
      '• All test orders & customer bills\n' +
      '• All test expenses\n' +
      '• All inventory stock logs & adjustments\n\n' +
      'Your 88+ menu products, prices, and staff accounts WILL BE PRESERVED.\n\n' +
      'Click OK to start clean for real restaurant operations.'
    );
    if (!confirmed) return;

    await onAttempt(async () => {
      await db.orders.clear();
      await db.expenses.clear();
      await db.inventoryMovements.clear();
      await clearTestOrdersCloud();
      await clearTestExpensesCloud();
      if (onReload) await onReload();
    }, 'Fresh start complete: All test orders, bills & expenses cleared');
  };

  const handleExportCSV = () => {
    const headers = [
      'Order Number', 'Date', 'Type', 'Table', 'Staff',
      'Items Detail', 'Subtotal (PKR)', 'Discount (PKR)',
      'Total (PKR)', 'Payment Status', 'Cash Received', 'Change Returned'
    ];

    const rows = orders.map(o => [
      o.number,
      o.createdAt,
      o.orderType,
      o.tableNumber || '',
      o.serverName || '',
      (o.items || []).map(i => `${i.quantity}x ${i.name} (${i.variant})`).join('; '),
      o.subtotal,
      o.discount,
      o.total,
      o.paymentStatus,
      o.cashReceived ?? '',
      o.change ?? ''
    ]);

    const csvContent = [
      headers,
      ...rows
    ].map(line => line.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');

    downloadFile(`mt-bites-sales-${localDateKey()}.csv`, csvContent, 'text/csv;charset=utf-8');
  };

  return (
    <div className="settings-view-container">
      <div className="page-heading">
        <div>
          <h1>Settings, Backup & Receipts</h1>
          <p>Configure receipt format, export historical records, and ensure data safety</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Restaurant Profile */}
        <section className="panel settings-section">
          <div className="panel-header">
            <div>
              <h2>Receipt & Restaurant Profile</h2>
              <p>Details printed on kitchen tickets and customer bills</p>
            </div>
            <SettingsIcon size={20} />
          </div>

          <div className="field">
            <label>Restaurant Display Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className="field">
            <label>Thermal Receipt Paper Format</label>
            <select
              value={paperWidth}
              onChange={e => setPaperWidth(e.target.value)}
            >
              <option value="80mm">80mm Thermal Receipt (Standard Counter)</option>
              <option value="58mm">58mm Thermal Receipt (Compact Mobile)</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-primary align-self-start"
            onClick={handleSaveStoreSettings}
          >
            <Check size={16} />
            <span>Save Receipt Settings</span>
          </button>
        </section>

        {/* Backup & CSV Export */}
        <section className="panel settings-section">
          <div className="panel-header">
            <div>
              <h2>Data Protection & Export</h2>
              <p>Download complete database copies or Excel-compatible CSVs</p>
            </div>
            <Download size={20} />
          </div>

          <div className="stack gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleBackupDownload}
              disabled={isBusy}
            >
              <Download size={17} />
              <span>{isBusy ? 'Preparing Backup…' : 'Download Full JSON Backup'}</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleExportCSV}
            >
              <FileSpreadsheet size={17} />
              <span>Export Sales to CSV (Excel)</span>
            </button>

            <label className="btn btn-outline file-label">
              <Upload size={17} />
              <span>Restore from Backup File</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreFile}
              />
            </label>
          </div>
        </section>

        {/* Clear Test Data / Reset for Production */}
        <section className="panel settings-section" style={{ borderColor: 'rgba(248, 113, 113, 0.4)' }}>
          <div className="panel-header">
            <div>
              <h2 style={{ color: '#fca5a5' }}>Reset Test Data (Fresh Start)</h2>
              <p>Clear test orders, dummy bills, and trial expenses before going live</p>
            </div>
            <Trash2 size={20} color="#f87171" />
          </div>

          <div className="stack gap-2">
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleClearAllTestData}
              style={{ background: '#7f1d1d', borderColor: '#b91c1c', color: '#fff', fontWeight: 800 }}
            >
              <RotateCcw size={17} />
              <span>Reset All Test Orders & Expenses (Fresh Start)</span>
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleClearTestOrders}
                style={{ flex: 1, borderColor: '#7f1d1d', color: '#fca5a5' }}
              >
                <Trash2 size={15} />
                <span>Clear Orders Only</span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleClearTestExpenses}
                style={{ flex: 1, borderColor: '#7f1d1d', color: '#fca5a5' }}
              >
                <Trash2 size={15} />
                <span>Clear Expenses Only</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Offline and Multi-Device Architecture Notes */}
      <div className="panel guidance-panel">
        <div className="guidance-header">
          <WifiOff size={20} />
          <h3>Offline Architecture & Multi-Device Deployment</h3>
        </div>
        <p>
          <strong>Offline Guarantee:</strong> All orders, menu items, prices, staff PINs, and inventory are stored locally in IndexedDB (Dexie). The app functions completely without internet on an already-loaded device in Kashmir.
        </p>
        <p>
          <strong>Multi-Device Note:</strong> Web browsers isolate IndexedDB per device. Two different phones will each store their own local orders unless connected to a synchronized cloud database (such as Supabase with Row Level Security) or a local Wi-Fi POS server.
        </p>
        <p>
          <strong>Hardware Printing:</strong> Thermal tickets currently use standard browser print preview dialogs with tailored CSS for 58mm and 80mm roll paper. Once physical Bluetooth or USB printers are deployed at the counter, native ESC/POS direct printing can be integrated.
        </p>
      </div>
    </div>
  );
}
