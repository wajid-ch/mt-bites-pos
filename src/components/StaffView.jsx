import React, { useState } from 'react';
import { Users, UserPlus, KeyRound, Shield, ShieldCheck, ShieldAlert, Edit, Trash2, X, Check, Lock } from 'lucide-react';
import { createStaffMember, updateStaffMember, deleteStaffMember } from '../auth.js';
import { fmtDate } from '../money.js';

export default function StaffView({ staff = [], currentStaff, onReloadStaff, onNotify }) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [resetPinTarget, setResetPinTarget] = useState(null);

  // Form states
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState('waiter');
  const [newPin, setNewPin] = useState('');

  // Reset PIN state
  const [resetPinVal, setResetPinVal] = useState('');

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newPin || newPin.length < 4) {
      alert('PIN must be at least 4 digits.');
      return;
    }
    try {
      await createStaffMember(currentStaff, {
        name: newName,
        username: newUsername,
        role: newRole,
        pin: newPin
      });
      onNotify(`Staff account "@${newUsername.toLowerCase()}" created`);
      setAddModalOpen(false);
      setNewName('');
      setNewUsername('');
      setNewRole('waiter');
      setNewPin('');
      await onReloadStaff();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (member) => {
    if (member.username === 'admin') {
      alert('The primary admin account cannot be deactivated.');
      return;
    }
    try {
      await updateStaffMember(currentStaff, member.id, {
        active: !member.active
      });
      onNotify(`Account @${member.username} marked ${!member.active ? 'active' : 'disabled'}`);
      await onReloadStaff();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetPinSubmit = async (e) => {
    e.preventDefault();
    if (!resetPinVal || resetPinVal.length < 4) {
      alert('New PIN must be at least 4 digits.');
      return;
    }
    try {
      await updateStaffMember(currentStaff, resetPinTarget.id, {
        pin: resetPinVal
      });
      onNotify(`PIN updated for @${resetPinTarget.username}`);
      setResetPinTarget(null);
      setResetPinVal('');
      await onReloadStaff();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteStaff = async (member) => {
    if (!window.confirm(`Permanently remove employee @${member.username} (${member.name})?`)) return;
    try {
      await deleteStaffMember(currentStaff, member.id);
      onNotify(`Staff member removed`);
      await onReloadStaff();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="staff-view-container">
      <div className="page-heading">
        <div>
          <h1>Staff & Access Security</h1>
          <p>Manage restaurant employee accounts, assigned roles, and PIN access</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setAddModalOpen(true)}
        >
          <UserPlus size={17} />
          <span>Add Employee</span>
        </button>
      </div>

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>EMPLOYEE</th>
              <th>USERNAME</th>
              <th>ROLE & ACCESS</th>
              <th>STATUS</th>
              <th>LAST SIGN IN</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(member => (
              <tr key={member.id}>
                <td>
                  <strong>{member.name}</strong>
                  {member.id === currentStaff?.id && (
                    <span className="current-user-tag">You</span>
                  )}
                </td>
                <td>@{member.username}</td>
                <td>
                  <span className={`role-badge role-${member.role}`}>
                    {member.role === 'admin' ? <ShieldCheck size={13} /> : <Shield size={13} />}
                    <span>{member.role.toUpperCase()}</span>
                  </span>
                </td>
                <td>
                  <span className={`status-pill status-${member.active ? 'paid' : 'unpaid'}`}>
                    {member.active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>
                  {member.lastLogin ? fmtDate(member.lastLogin) : 'Never logged in'}
                </td>
                <td>
                  <div className="inline-action-btns">
                    <button
                      type="button"
                      className="btn-icon-subtle"
                      title="Reset PIN"
                      onClick={() => {
                        setResetPinTarget(member);
                        setResetPinVal('');
                      }}
                    >
                      <KeyRound size={16} />
                    </button>
                    {member.username !== 'admin' && (
                      <button
                        type="button"
                        className="btn-icon-subtle"
                        title={member.active ? 'Deactivate account' : 'Reactivate account'}
                        onClick={() => handleToggleActive(member)}
                      >
                        {member.active ? <Lock size={16} /> : <Check size={16} />}
                      </button>
                    )}
                    {member.username !== 'admin' && (
                      <button
                        type="button"
                        className="btn-icon-danger"
                        title="Delete staff"
                        onClick={() => handleDeleteStaff(member)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Staff Modal */}
      {addModalOpen && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setAddModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Add Restaurant Employee</h2>
              <button type="button" className="icon-button" onClick={() => setAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateStaff} className="modal-content stack gap-3">
              <div className="field">
                <label>Full Name</label>
                <input
                  required
                  placeholder="e.g. Ali Raza"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Username (Lower-case login ID)</label>
                <input
                  required
                  placeholder="e.g. ali"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="waiter">Waiter (POS & Orders only)</option>
                  <option value="admin">Admin / Manager (Full Access)</option>
                </select>
              </div>

              <div className="field">
                <label>Access PIN (4-6 Digits)</label>
                <input
                  required
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="e.g. 5566"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full">
                <Check size={18} />
                <span>Create Staff Account</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reset PIN Modal */}
      {resetPinTarget && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setResetPinTarget(null); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>Reset Access PIN</h2>
                <p>Employee: <strong>{resetPinTarget.name}</strong> (@{resetPinTarget.username})</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setResetPinTarget(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleResetPinSubmit} className="modal-content stack gap-3">
              <div className="field">
                <label>New Access PIN (4-6 digits)</label>
                <input
                  required
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  placeholder="Enter new PIN"
                  value={resetPinVal}
                  onChange={e => setResetPinVal(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full">
                <Check size={18} />
                <span>Save New PIN</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
