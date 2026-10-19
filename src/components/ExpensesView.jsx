import React, { useState, useMemo } from 'react';
import { Wallet, Plus, X, Check, ReceiptText } from 'lucide-react';
import { db } from '../db.js';
import { generateId } from '../id.js';
import { rs, fmtDate, parseAmount } from '../money.js';

export default function ExpensesView({ expenses = [], onAttempt }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState('Electricity');
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const amount = parseAmount(amountStr);
    if (amount === null || amount <= 0) {
      alert('Please enter a valid positive whole-rupee amount.');
      return;
    }

    const expenseRecord = {
      id: `exp-${generateId()}`,
      createdAt: new Date().toISOString(),
      category,
      amount,
      note: note.trim(),
      paymentMethod: 'cash'
    };

    const ok = await onAttempt(() => db.expenses.add(expenseRecord), 'Expense recorded');
    if (ok) {
      setModalOpen(false);
      setAmountStr('');
      setNote('');
    }
  };

  const categories = [
    'Electricity', 'Gas', 'Rent', 'Staff Meals', 'Transport',
    'Maintenance', 'Cleaning', 'Packaging', 'Marketing', 'Salaries', 'Other'
  ];

  return (
    <div className="expenses-view-container">
      <div className="page-heading">
        <div>
          <h1>Cash Expenses</h1>
          <p>Record and monitor operational cash spent by the restaurant</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={17} />
          <span>Record Expense</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid kpi-grid-two">
        <div className="kpi-card">
          <span className="kpi-label">Total Recorded Expenses</span>
          <strong className="kpi-value">{rs(totalExpenses)}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Number of Expense Entries</span>
          <strong className="kpi-value">{expenses.length}</strong>
        </div>
      </div>

      {/* Expenses Table */}
      {expenses.length > 0 ? (
        <div className="table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>DATE & TIME</th>
                <th>CATEGORY</th>
                <th>DESCRIPTION / NOTES</th>
                <th>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {[...expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(item => (
                <tr key={item.id}>
                  <td>{fmtDate(item.createdAt)}</td>
                  <td><span className="expense-category-chip">{item.category}</span></td>
                  <td>{item.note || '—'}</td>
                  <td><strong className="expense-amount-val">{rs(item.amount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <ReceiptText size={28} />
          </div>
          <h3>No expenses recorded</h3>
          <p>Record your bills, groceries, fuel, maintenance, or petty cash outlays.</p>
        </div>
      )}

      {/* Add Expense Modal */}
      {modalOpen && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Record Cash Expense</h2>
              <button type="button" className="icon-button" onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="modal-content stack gap-3">
              <div className="field">
                <label>Expense Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Amount (PKR)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 1500"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Notes / Receipt Details (Optional)</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Electricity bill token, gas cylinder refill, cleaning detergent…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full">
                <Check size={18} />
                <span>Save Expense Record</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
