import React from 'react';
import {
  ShoppingBag, ClipboardList, LayoutDashboard, BookOpen,
  Package, ReceiptText, Users, Settings as SettingsIcon,
  Flame, Menu as MenuIcon, Wifi, WifiOff, LogOut, Lock,
  ChevronRight, User
} from 'lucide-react';

export const navItems = [
  { id: 'pos', label: 'New Order', icon: ShoppingBag, adminOnly: false },
  { id: 'orders', label: 'Orders', icon: ClipboardList, adminOnly: false },
  { id: 'customer-menu', label: 'Customer Menu', icon: BookOpen, adminOnly: false },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
  { id: 'menu', label: 'Menu & Prices', icon: BookOpen, adminOnly: true },
  { id: 'inventory', label: 'Inventory', icon: Package, adminOnly: true },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText, adminOnly: true },
  { id: 'staff', label: 'Staff & Security', icon: Users, adminOnly: true },
  { id: 'settings', label: 'Settings & Backup', icon: SettingsIcon, adminOnly: true }
];

export function Logo({ small = false }) {
  return (
    <div className={`brand ${small ? 'brand-small' : ''}`}>
      <span className="brand-mark">
        <Flame size={small ? 18 : 22} strokeWidth={2.5} />
      </span>
      <span>
        <strong>MT<span>Bites</span></strong>
        {!small && <small>FAST FOOD POS</small>}
      </span>
    </div>
  );
}

export function Sidebar({ currentView, onNavigate, currentStaff, onLock, onLogout, isOpen, onClose }) {
  const isAdmin = currentStaff?.role === 'admin';
  const visibleNav = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <>
      {isOpen && <div className="drawer-scrim" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <Logo />
          <span className="version-label">v0.2</span>
        </div>

        {/* Current Staff Profile Card */}
        <div className="sidebar-user-card">
          <div className="user-avatar-wrap">
            <User size={18} />
          </div>
          <div className="user-details-text">
            <strong>{currentStaff?.name || 'Staff Member'}</strong>
            <span className={`role-text-badge role-${currentStaff?.role}`}>
              {currentStaff?.role === 'admin' ? 'Owner / Admin' : 'Floor Waiter'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className="lock-session-btn"
              title="Lock POS / Switch Staff"
              onClick={onLock}
            >
              <Lock size={15} />
            </button>
            <button
              type="button"
              className="lock-session-btn"
              title="Sign Out to Customer Menu"
              onClick={onLogout}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        <div className="sidebar-menu-label">RESTAURANT WORKSPACE</div>

        <button
          type="button"
          className="nav-link public-menu-side-link"
          onClick={() => { onNavigate('customer-menu'); onClose(); }}
          style={{ background: '#2c1e13', borderColor: '#7c441c', color: '#fb923c', marginBottom: '8px' }}
        >
          <BookOpen size={18} />
          <strong>📖 View Customer Menu</strong>
        </button>

        <nav className="side-nav">
          {visibleNav.map(item => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { onNavigate(item.id); onClose(); }}
                className={`nav-link ${active ? 'nav-active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {active && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="local-badge">
            <span className="local-dot" />
            <div>
              <strong>Local IndexedDB</strong>
              <small>Offline data safe</small>
            </div>
          </div>
          <p className="sidebar-foot">
            Orders are saved securely in this device's local database.
          </p>
        </div>
      </aside>
    </>
  );
}

export function Topbar({ currentView, onOpenDrawer, isOnline, currentStaff, onLock, isCloudConnected, onNavigate }) {
  const activeItem = navItems.find(n => n.id === currentView);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-button topbar-drawer-btn"
          onClick={onOpenDrawer}
          title="Open Navigation"
        >
          <MenuIcon size={20} />
        </button>
        <div className="topbar-location">
          <span>MT Bites</span>
          <ChevronRight size={14} />
          <strong>{activeItem?.label || 'POS'}</strong>
        </div>
      </div>

      <div className="topbar-right">
        {/* Quick Jump to Customer Digital Menu */}
        {onNavigate && (
          <button
            type="button"
            className="btn btn-outline btn-small topbar-menu-switch-btn"
            onClick={() => onNavigate('customer-menu')}
            title="Open customer-facing menu view"
            style={{ borderColor: '#7c441c', color: '#fb923c' }}
          >
            <BookOpen size={14} />
            <span>Customer Menu</span>
          </button>
        )}

        {/* Cloud Sync Status */}
        {isCloudConnected && isOnline && (
          <span className="cloud-pill" title="Connected to Supabase live database">
            <span className="cloud-pulse-dot" />
            <span>Cloud Live</span>
          </span>
        )}

        {/* Network Pill */}
        <span className={`network-pill ${isOnline ? 'is-online' : 'is-offline'}`}>
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
        </span>

        {/* Staff Switcher / Lock */}
        <button
          type="button"
          className="staff-topbar-pill"
          onClick={onLock}
          title="Switch Staff / Lock Screen"
        >
          <span className={`staff-dot role-${currentStaff?.role}`} />
          <span className="staff-pill-name">{currentStaff?.name?.split(' ')[0] || 'Staff'}</span>
          <span className="staff-pill-role">({currentStaff?.role})</span>
          <Lock size={12} className="staff-lock-icon" />
        </button>
      </div>
    </header>
  );
}

export function BottomNav({ currentView, onNavigate, currentStaff }) {
  const isAdmin = currentStaff?.role === 'admin';
  const visibleNav = navItems.filter(item => !item.adminOnly || isAdmin).slice(0, isAdmin ? 5 : 3);

  return (
    <nav className="bottom-nav">
      {visibleNav.map(item => {
        const Icon = item.icon;
        const active = currentView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`bottom-nav-item ${active ? 'selected' : ''}`}
          >
            <Icon size={20} />
            <span>{item.label.split(' ')[0]}</span>
          </button>
        );
      })}
    </nav>
  );
}
