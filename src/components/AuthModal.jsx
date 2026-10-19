import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  KeyRound,
  ShieldAlert,
  Check,
  X,
  LogIn,
  Mail,
  Eye,
  EyeOff,
  Clock,
  Sparkles,
  HelpCircle,
  ArrowLeft
} from 'lucide-react';
import {
  loginWithPin,
  loginWithEmail,
  requestPasswordReset,
  getLockoutRemaining,
  KNOWN_ADMIN_EMAILS
} from '../auth.js';

export default function AuthModal({
  staffList = [],
  onLoginSuccess,
  currentStaff,
  onCancel,
  canCancel = false
}) {
  // Mode: 'waiter' (PIN) or 'admin' (Email + Password) or 'reset' (Forgot Password)
  const [authMode, setAuthMode] = useState('waiter');

  // Waiter State
  const waiterStaff = staffList.filter(s => s.active && s.role !== 'admin');
  const [selectedUser, setSelectedUser] = useState(
    waiterStaff[0]?.username || (staffList.find(s => s.role === 'waiter')?.username || 'waiter1')
  );
  const [pin, setPin] = useState('');

  // Admin Email State
  const [email, setEmail] = useState('rajasaad9264@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [offlineFallbackPin, setOfflineFallbackPin] = useState('');
  const [showOfflineAdminPin, setShowOfflineAdminPin] = useState(false);

  // Status & Feedback States
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Periodically check lockout status
  useEffect(() => {
    const activeTarget = authMode === 'waiter' ? selectedUser : email;
    const remaining = getLockoutRemaining(activeTarget);
    setLockoutRemaining(remaining);

    if (remaining > 0) {
      const interval = setInterval(() => {
        const next = getLockoutRemaining(activeTarget);
        setLockoutRemaining(next);
        if (next <= 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [authMode, selectedUser, email]);

  // Waiter Keypad Handlers
  const handleNumClick = (num) => {
    if (lockoutRemaining > 0) return;
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    if (lockoutRemaining > 0) return;
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  // Waiter PIN Submit
  const handlePinSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedUser) {
      setError('Select a waiter account');
      return;
    }
    if (!pin) {
      setError('Enter your 4-digit PIN');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const session = await loginWithPin(selectedUser, pin);
      onLoginSuccess(session);
    } catch (err) {
      setError(err.message || 'Login failed');
      setPin('');
      const rem = getLockoutRemaining(selectedUser);
      setLockoutRemaining(rem);
    } finally {
      setLoading(false);
    }
  };

  // Admin Email & Password Submit
  const handleEmailSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setError('Enter your admin email address');
      return;
    }
    if (!password) {
      setError('Enter your password');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const session = await loginWithEmail(email, password);
      onLoginSuccess(session);
    } catch (err) {
      setError(err.message || 'Sign in failed');
      const rem = getLockoutRemaining(email);
      setLockoutRemaining(rem);
      // If error indicates network / offline, offer emergency offline PIN
      if (err.message && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('not configured'))) {
        setShowOfflineAdminPin(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Emergency Offline Admin PIN (if internet is down)
  const handleOfflineAdminSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!offlineFallbackPin) {
      setError('Enter the emergency offline admin PIN');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // 'admin' username in local IndexedDB
      const session = await loginWithPin('admin', offlineFallbackPin);
      onLoginSuccess({
        ...session,
        name: email.includes('rajasaad') ? 'Raja Saad (Owner)' : 'Administrator'
      });
    } catch (err) {
      setError(err.message || 'Emergency PIN invalid');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Request
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please select or type your admin email above first.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await requestPasswordReset(email);
      setSuccessMsg(`Password reset instructions sent to ${email}. Check your inbox!`);
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Ensure cloud is online.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay auth-overlay">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-icon-badge">
            <Lock size={24} />
          </div>
          <h2>{authMode === 'waiter' ? 'Staff Sign In' : 'Owner / Admin Portal'}</h2>
          <p>
            {authMode === 'waiter'
              ? 'Select your account and enter your 4-digit PIN'
              : 'Secure login for MT Bites administration'}
          </p>
          {canCancel && onCancel && (
            <button className="auth-close-btn" onClick={onCancel} title="Close">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${authMode === 'waiter' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('waiter');
              setError('');
              setSuccessMsg('');
            }}
          >
            <User size={15} />
            <span>Waiter (PIN)</span>
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${authMode === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('admin');
              setError('');
              setSuccessMsg('');
            }}
          >
            <KeyRound size={15} />
            <span>Owner (Email)</span>
          </button>
        </div>

        {/* Lockout Countdown Alert */}
        {lockoutRemaining > 0 && (
          <div className="auth-lockout-banner">
            <Clock size={18} className="pulse-icon" />
            <div>
              <strong>Security Lockout Active</strong>
              <p>Too many failed attempts. Try again in <strong>{lockoutRemaining}s</strong>.</p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="auth-error-banner">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="auth-success-banner">
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* WAITER PIN MODE */}
        {/* ========================================================= */}
        {authMode === 'waiter' && (
          <div className="auth-waiter-section">
            {/* Staff Selector (Waiters only — Admin hidden) */}
            <div className="staff-selector-list">
              {waiterStaff.length > 0 ? (
                waiterStaff.map(staff => (
                  <button
                    key={staff.id}
                    type="button"
                    className={`staff-pill-btn ${selectedUser.toLowerCase() === staff.username.toLowerCase() ? 'staff-pill-selected' : ''}`}
                    onClick={() => {
                      setSelectedUser(staff.username);
                      setError('');
                      setSuccessMsg('');
                    }}
                  >
                    <span className="staff-role-indicator role-waiter" />
                    <div className="staff-pill-info">
                      <strong>{staff.name}</strong>
                      <small>@{staff.username} · WAITER</small>
                    </div>
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  className="staff-pill-btn staff-pill-selected"
                  onClick={() => setSelectedUser('waiter1')}
                >
                  <span className="staff-role-indicator role-waiter" />
                  <div className="staff-pill-info">
                    <strong>Floor Waiter 1</strong>
                    <small>@waiter1 · WAITER</small>
                  </div>
                </button>
              )}
            </div>

            {/* PIN Display */}
            <div className="pin-display">
              {[0, 1, 2, 3].map(idx => (
                <div key={idx} className={`pin-dot ${pin.length > idx ? 'filled' : ''}`} />
              ))}
            </div>

            {/* Numeric Keypad */}
            <div className="keypad-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  disabled={lockoutRemaining > 0}
                  className="keypad-key"
                  onClick={() => handleNumClick(String(num))}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="keypad-key keypad-fn"
                onClick={handleClear}
                disabled={lockoutRemaining > 0}
              >
                C
              </button>
              <button
                type="button"
                className="keypad-key"
                disabled={lockoutRemaining > 0}
                onClick={() => handleNumClick('0')}
              >
                0
              </button>
              <button
                type="button"
                className="keypad-key keypad-fn"
                onClick={handleBackspace}
                disabled={lockoutRemaining > 0}
              >
                ⌫
              </button>
            </div>

            <button
              type="button"
              disabled={loading || pin.length < 4 || lockoutRemaining > 0}
              className="btn btn-primary btn-full btn-large auth-submit-btn"
              onClick={handlePinSubmit}
            >
              <LogIn size={18} />
              {loading ? 'Verifying PIN…' : 'Unlock POS'}
            </button>

            <button
              type="button"
              className="auth-switch-link"
              onClick={() => {
                setAuthMode('admin');
                setError('');
                setSuccessMsg('');
              }}
            >
              Owner or Manager? Sign in with Email →
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* ADMIN EMAIL & PASSWORD MODE */}
        {/* ========================================================= */}
        {authMode === 'admin' && (
          <form className="auth-admin-section" onSubmit={handleEmailSubmit}>
            {/* Quick Admin Email Chips */}
            <div className="admin-email-chips">
              <span className="chips-label">Quick Select:</span>
              <div className="chips-row">
                <button
                  type="button"
                  className={`admin-chip ${email === 'rajasaad9264@gmail.com' ? 'active' : ''}`}
                  onClick={() => {
                    setEmail('rajasaad9264@gmail.com');
                    setError('');
                  }}
                >
                  👑 Raja Saad (Owner)
                </button>
                <button
                  type="button"
                  className={`admin-chip ${email === 'wajidqayyum286@gmail.com' ? 'active' : ''}`}
                  onClick={() => {
                    setEmail('wajidqayyum286@gmail.com');
                    setError('');
                  }}
                >
                  🛠️ Wajid (Tech Admin)
                </button>
              </div>
            </div>

            {/* Email Field */}
            <div className="auth-field">
              <label>Admin Email</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  type="email"
                  required
                  placeholder="admin@mtbites.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading || lockoutRemaining > 0}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="auth-field">
              <div className="auth-field-header">
                <label>Password</label>
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading || lockoutRemaining > 0}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password || lockoutRemaining > 0}
              className="btn btn-primary btn-full btn-large auth-submit-btn"
            >
              <LogIn size={18} />
              {loading ? 'Authenticating…' : 'Sign In as Admin'}
            </button>

            {/* Emergency Offline PIN fallback */}
            {showOfflineAdminPin ? (
              <div className="auth-offline-box">
                <p><strong>Internet Disconnected:</strong> Enter emergency admin offline PIN:</p>
                <div className="auth-offline-row">
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="PIN"
                    value={offlineFallbackPin}
                    onChange={e => setOfflineFallbackPin(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleOfflineAdminSubmit}
                  >
                    Unlock Offline
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="auth-offline-toggle"
                onClick={() => setShowOfflineAdminPin(true)}
              >
                Offline emergency access
              </button>
            )}

            <button
              type="button"
              className="auth-switch-link"
              onClick={() => {
                setAuthMode('waiter');
                setError('');
                setSuccessMsg('');
              }}
            >
              <ArrowLeft size={14} /> Back to Waiter Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
