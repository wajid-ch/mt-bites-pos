import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronRight, Menu as MenuIcon
} from 'lucide-react';
import { db, initializeDatabase } from './db.js';
import { getCachedSession, setCachedSession, hasPermission, logout } from './auth.js';
import { generateId, generateOrderNumber } from './id.js';
import { rs, parseAmount, cartSubtotal, cartTotal } from './money.js';
import { printReceipt, printInventoryReport } from './receipt.js';
import {
  isSupabaseConfigured,
  pushOrderToCloud,
  fetchOrdersFromCloud,
  fetchStaffFromCloud,
  fetchInventoryFromCloud,
  fetchInventoryMovementsFromCloud,
  fetchExpensesFromCloud,
  pushInventoryToCloud,
  applyInventoryDeltaCloud,
  pushInventoryMovementToCloud,
  flushPendingSync,
  getPendingSyncCount,
  getLastLocalInventoryWrite,
  subscribeToRealtimeOrders,
  subscribeToRealtimeInventory,
  subscribeToRealtimeMovements
} from './supabase.js';
import { generateId as genUniqueId } from './id.js';

// Subcomponents
import { Sidebar, Topbar, BottomNav, Logo } from './components/Navigation.jsx';
import PosCatalog from './components/PosCatalog.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import VariantModal from './components/VariantModal.jsx';
import OrderSuccessModal from './components/OrderSuccessModal.jsx';
import PayModal from './components/PayModal.jsx';
import OrdersView from './components/OrdersView.jsx';
import DashboardView from './components/DashboardView.jsx';
import ReportsView from './components/ReportsView.jsx';
import MenuAdmin from './components/MenuAdmin.jsx';
import InventoryView from './components/InventoryView.jsx';
import ExpensesView from './components/ExpensesView.jsx';
import StaffView from './components/StaffView.jsx';
import SettingsView from './components/SettingsView.jsx';
import AuthModal from './components/AuthModal.jsx';
import PublicMenuView from './components/PublicMenuView.jsx';

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState('');

  // Database Data States
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [shopName, setShopName] = useState('MT Bites');
  const [thermalWidth, setThermalWidth] = useState('80mm');
  const [printMode, setPrintMode] = useState('image');

  // Session & Authentication
  const [currentStaff, setCurrentStaff] = useState(() => getCachedSession());
  const [showAuthModal, setShowAuthModal] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname || '';
      const hash = window.location.hash || '';
      const params = new URLSearchParams(window.location.search);
      if (
        path === '/login' ||
        params.has('login') ||
        hash.includes('access_token=') ||
        hash.includes('type=invite') ||
        hash.includes('type=recovery')
      ) {
        return true;
      }
    }
    return false;
  });

  // Active View & UI State (persists current tab across page refreshes)
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname || '';
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash || '';
      if (path === '/login' || params.has('login') || hash.includes('access_token=')) {
        return getCachedSession() ? 'pos' : 'customer-menu';
      }
      if (params.has('menu') || params.has('table')) return 'customer-menu';
      const session = getCachedSession();
      if (session) {
        const savedView = window.sessionStorage?.getItem('mt_bites_active_view');
        if (savedView) return savedView;
        return 'pos';
      }
    }
    return 'customer-menu';
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cart & Ordering States
  const [cart, setCart] = useState([]);
  const [extraBottles, setExtraBottles] = useState([]);
  const [orderType, setOrderType] = useState('Dine-in');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [discountInput, setDiscountInput] = useState('0');
  const [cartOpen, setCartOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null);
  const [lastSavedOrder, setLastSavedOrder] = useState(null);
  const [payOrder, setPayOrder] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const saveInProgress = useRef(false);
  const manualSyncRef = useRef(null);
  const discount = parseAmount(discountInput) ?? 0;

  // Toast notification helper
  const notify = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 4500);
  };

  // Reload all data from local IndexedDB
  const reload = useCallback(async () => {
    try {
      const [p, o, i, m, e, s, nameSetting, widthSetting, printModeSetting] = await Promise.all([
        db.products.toArray(),
        db.orders.toArray(),
        db.inventory.toArray(),
        db.inventoryMovements.toArray(),
        db.expenses.toArray(),
        db.staff.toArray(),
        db.settings.get('shopName'),
        db.settings.get('thermalWidth'),
        db.settings.get('printMode')
      ]);

      setProducts(p);
      setOrders(o.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setInventory(i);
      setMovements(m);
      setExpenses(e);
      setStaff(s);
      setShopName(nameSetting?.value || 'MT Bites');
      setThermalWidth(widthSetting?.value || '80mm');
      setPrintMode(printModeSetting?.value || 'image');
    } catch (err) {
      console.error('Failed to reload IndexedDB:', err);
      notify(`Storage error: ${err.message}`);
    }
  }, []);

  // Safe operation wrapper
  const attempt = async (fn, successMessage) => {
    try {
      await fn();
      await reload();
      if (successMessage) notify(successMessage);
      return true;
    } catch (err) {
      console.error('Operation error:', err);
      notify(`Error: ${err.message}`);
      return false;
    }
  };

  // Initialize DB on mount
  useEffect(() => {
    initializeDatabase()
      .then(reload)
      .then(() => {
        setReady(true);
      })
      .catch(err => {
        console.error('Database initialization failed:', err);
        setLoadingError(err.message || 'Unknown database error');
      });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [reload]);

  // Check session on load or when staff list changes
  useEffect(() => {
    if (!currentStaff && ready && staff.length > 0) {
      const cached = getCachedSession();
      if (cached && staff.some(s => s.id === cached.id && s.active)) {
        setCurrentStaff(cached);
      }
    }
  }, [ready, staff, currentStaff]);

  // Supabase Cloud Synchronization & Realtime Live Orders + Inventory
  useEffect(() => {
    if (!isSupabaseConfigured || !ready) return;

    let isMounted = true;
    let syncing = false;

    const syncWithCloud = async (isManual = false) => {
      if (syncing || !navigator.onLine) return null;
      syncing = true;
      const syncStartedAt = Date.now();
      try {
        // 1. Flush any offline-queued orders, inventory edits, or expenses first
        const flushRes = await flushPendingSync();

        // 2. Pull latest cloud state for orders, staff, inventory, movements, and expenses
        const [cloudOrders, cloudStaff, cloudInventory, cloudMovements, cloudExpenses] = await Promise.all([
          fetchOrdersFromCloud(),
          fetchStaffFromCloud(),
          fetchInventoryFromCloud(),
          fetchInventoryMovementsFromCloud(),
          fetchExpensesFromCloud()
        ]);

        if (!isMounted) return null;

        if (cloudOrders && cloudOrders.length > 0) {
          await db.orders.bulkPut(cloudOrders);
        }
        if (cloudStaff && cloudStaff.length > 0) {
          await db.staff.bulkPut(cloudStaff);
        }
        if (Array.isArray(cloudInventory)) {
          const cloudIds = new Set(cloudInventory.map(i => i.id));
          const localAll = await db.inventory.toArray();
          const localOnly = localAll.filter(l => !cloudIds.has(l.id));

          // On manual sync, push any local-only items up to cloud if not in pending queue
          if (isManual && localOnly.length > 0) {
            for (const item of localOnly) {
              const upRes = await pushInventoryToCloud(item, { queueOnFail: false });
              if (!upRes.ok && upRes.error) {
                flushRes.lastError = upRes.error;
                flushRes.remaining = (flushRes.remaining || 0) + 1;
              }
            }
          }

          await db.transaction('rw', db.inventory, async () => {
            if (cloudInventory.length > 0) await db.inventory.bulkPut(cloudInventory);
          });
        }
        if (Array.isArray(cloudMovements) && cloudMovements.length > 0) {
          await db.inventoryMovements.bulkPut(cloudMovements);
        }
        if (Array.isArray(cloudExpenses) && cloudExpenses.length > 0) {
          await db.expenses.bulkPut(cloudExpenses);
        }

        await reload();
        return flushRes;
      } catch (err) {
        console.warn('Cloud sync notice:', err.message);
        return { flushed: 0, remaining: getPendingSyncCount(), lastError: err.message };
      } finally {
        syncing = false;
      }
    };

    if (navigator.onLine) {
      syncWithCloud();
    }
    manualSyncRef.current = syncWithCloud;

    // Subscribe to live orders across all phones
    const unsubOrders = subscribeToRealtimeOrders(
      async (newOrder) => {
        if (!isMounted) return;
        await db.orders.put(newOrder);
        await reload();
        notify(`Live Order: ${newOrder.number} (${newOrder.orderType})`);
      },
      async (updatedOrder) => {
        if (!isMounted) return;
        await db.orders.put(updatedOrder);
        await reload();
      }
    );

    // Subscribe to live inventory & stock movements across all phones
    const unsubInv = subscribeToRealtimeInventory(
      async (item) => {
        if (!isMounted) return;
        await db.inventory.put(item);
        await reload();
      },
      async (deletedId) => {
        if (!isMounted) return;
        await db.inventory.delete(deletedId);
        await reload();
      }
    );

    const unsubMov = subscribeToRealtimeMovements(async (mov) => {
      if (!isMounted) return;
      await db.inventoryMovements.put(mov);
      await reload();
    });

    // Re-sync automatically when phone wakes up, regains internet, or tab refocuses
    const handleWakeOrReconnect = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncWithCloud();
      }
    };
    window.addEventListener('online', syncWithCloud);
    window.addEventListener('focus', handleWakeOrReconnect);
    document.addEventListener('visibilitychange', handleWakeOrReconnect);

    // Lightweight 20s fallback sync while screen is active (catches missed WebSocket events on iOS Safari)
    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncWithCloud();
      }
    }, 20000);

    return () => {
      isMounted = false;
      if (unsubOrders) unsubOrders();
      if (unsubInv) unsubInv();
      if (unsubMov) unsubMov();
      window.removeEventListener('online', syncWithCloud);
      window.removeEventListener('focus', handleWakeOrReconnect);
      document.removeEventListener('visibilitychange', handleWakeOrReconnect);
      window.clearInterval(pollTimer);
    };
  }, [ready, reload, currentStaff?.id]);

  // Navigation with permission checking
  const navigateTo = (targetView) => {
    const isAdmin = currentStaff?.role === 'admin';
    const adminViews = ['dashboard', 'reports', 'menu', 'inventory', 'expenses', 'staff', 'settings'];

    if (adminViews.includes(targetView) && !isAdmin) {
      notify('Access restricted to Owner/Admin accounts');
      setView('pos');
      return;
    }

    setView(targetView);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem('mt_bites_active_view', targetView);
    }
    setDrawerOpen(false);
    setCartOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cart operations
  const handleAddToCart = (product, variant, linkedBeverage = null) => {
    const bevKey = linkedBeverage ? `/${linkedBeverage.inventoryId}` : '';
    const key = `${product.id}/${variant.id}${bevKey}`;
    setCart(prev => {
      const exists = prev.some(item => item.key === key);
      if (exists) {
        return prev.map(item =>
          item.key === key ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          name: product.name,
          variant: variant.label,
          unitPrice: variant.price,
          quantity: 1,
          linkedBeverage
        }
      ];
    });
    setVariantProduct(null);
    const bevNote = linkedBeverage ? ` + 🥤 ${linkedBeverage.name}` : '';
    notify(`${product.name} (${variant.label}${bevNote}) added to cart`);
  };

  const handleAdjustExtraBottle = (drink, delta) => {
    setExtraBottles(prev => {
      const existing = prev.find(b => b.inventoryId === drink.id);
      if (!existing && delta > 0) {
        return [...prev, { inventoryId: drink.id, name: drink.name, unit: drink.unit || 'bottles', quantity: delta }];
      }
      return prev
        .map(b => (b.inventoryId === drink.id ? { ...b, quantity: b.quantity + delta } : b))
        .filter(b => b.quantity > 0);
    });
  };

  const handleAdjustCart = (key, delta) => {
    setCart(prev =>
      prev
        .map(item => (item.key === key ? { ...item, quantity: item.quantity + delta } : item))
        .filter(item => item.quantity > 0)
    );
  };

  const clearOrderForm = () => {
    setCart([]);
    setExtraBottles([]);
    setOrderType('Dine-in');
    setTableNumber('');
    setCustomerName('');
    setNote('');
    setDiscountInput('0');
    setCartOpen(false);
  };

  // Priority 1 — Safe Order Placement + Atomic Inventory Deduction
  const placeOrder = async () => {
    if (saveInProgress.current) return;
    if (!cart.length) {
      notify('Cart is empty. Add items from the menu first.');
      return;
    }
    if (parseAmount(discountInput) === null) {
      notify('Enter a valid whole-rupee discount amount');
      return;
    }
    if (discount > cartSubtotal(cart)) {
      notify('Discount cannot exceed order subtotal');
      return;
    }

    saveInProgress.current = true;
    setIsSaving(true);

    try {
      // Secure-context independent ID generation
      const orderId = generateId();
      const orderNum = generateOrderNumber();
      const nowIso = new Date().toISOString();

      // Aggregate all cold drink bottle deductions (item-linked + extra cart bottles)
      const deductionMap = new Map();
      for (const item of cart) {
        if (item.linkedBeverage?.inventoryId) {
          const id = item.linkedBeverage.inventoryId;
          const prev = deductionMap.get(id) || {
            inventoryId: id,
            name: item.linkedBeverage.name,
            qty: 0,
            sources: []
          };
          const deductCount = item.quantity * (item.linkedBeverage.quantityPerItem || 1);
          prev.qty += deductCount;
          prev.sources.push(`${item.quantity}x ${item.name}`);
          deductionMap.set(id, prev);
        }
      }
      for (const eb of extraBottles) {
        const prev = deductionMap.get(eb.inventoryId) || {
          inventoryId: eb.inventoryId,
          name: eb.name,
          qty: 0,
          sources: []
        };
        prev.qty += eb.quantity;
        prev.sources.push(`${eb.quantity}x Extra Bottle`);
        deductionMap.set(eb.inventoryId, prev);
      }

      const newOrder = {
        id: orderId,
        number: orderNum,
        createdAt: nowIso,
        orderType,
        tableNumber: orderType === 'Dine-in' ? tableNumber.trim() : '',
        customerName: customerName.trim(),
        serverName: currentStaff?.name || 'Floor Staff',
        serverId: currentStaff?.id || '',
        note: note.trim(),
        items: cart.map(({ productId, name, variant, unitPrice, quantity, linkedBeverage }) => ({
          productId,
          name,
          variant: linkedBeverage ? `${variant} · ${linkedBeverage.name}` : variant,
          unitPrice,
          quantity
        })),
        subtotal: cartSubtotal(cart),
        discount,
        total: cartTotal(cart, discount),
        status: 'new',
        paymentStatus: 'unpaid',
        paymentMethod: null,
        cashReceived: null,
        change: null
      };

      const stockCloudSyncJobs = [];

      await db.transaction('rw', db.orders, db.inventory, db.inventoryMovements, async () => {
        await db.orders.add(newOrder);

        for (const ded of deductionMap.values()) {
          if (ded.qty <= 0) continue;
          const invItem = await db.inventory.get(ded.inventoryId);
          if (!invItem) continue;
          const nextQty = Math.max(0, Number(invItem.quantity || 0) - ded.qty);
          const updatedInv = { ...invItem, quantity: nextQty };
          await db.inventory.put(updatedInv);

          const mov = {
            id: `mov-${genUniqueId()}`,
            itemId: ded.inventoryId,
            delta: -ded.qty,
            reason: `Order ${orderNum} (${ded.sources.join(', ')})`,
            createdAt: nowIso
          };
          await db.inventoryMovements.add(mov);
          stockCloudSyncJobs.push({ itemId: ded.inventoryId, delta: -ded.qty, updatedInv, mov });
        }
      });

      // Push order & inventory deductions to cloud (queues automatically if offline)
      await pushOrderToCloud(newOrder);
      for (const job of stockCloudSyncJobs) {
        await applyInventoryDeltaCloud(job.itemId, job.delta, job.updatedInv);
        await pushInventoryMovementToCloud(job.mov);
      }

      await reload();
      clearOrderForm();
      setLastSavedOrder(newOrder);
      const deductedMsg = stockCloudSyncJobs.length > 0 ? ' & stock updated' : '';
      notify(`Order ${orderNum} saved${deductedMsg} (UNPAID)`);
    } catch (err) {
      console.error('Save order failure:', err);
      notify(`Save failed: ${err.message}`);
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
  };

  // Cash payment collection
  const collectCashPayment = async (order, receivedStr) => {
    const cash = parseAmount(receivedStr);
    if (cash === null || cash < order.total) {
      notify('Cash received must be at least the total amount');
      return;
    }

    const success = await attempt(async () => {
      await db.transaction('rw', db.orders, async () => {
        const fresh = await db.orders.get(order.id);
        if (!fresh) throw new Error('Order not found');
        if (fresh.paymentStatus === 'paid') throw new Error('Order is already marked as paid');

        const updatedFields = {
          paymentStatus: 'paid',
          paymentMethod: 'cash',
          cashReceived: cash,
          change: cash - order.total,
          paidAt: new Date().toISOString(),
          cashierName: currentStaff?.name || 'Staff'
        };
        await db.orders.update(order.id, updatedFields);
        pushOrderToCloud({ ...fresh, ...updatedFields });
      });
    }, `Cash payment recorded for ${order.number}`);

    if (success) {
      setPayOrder(null);
    }
  };

  // Update order status (new -> preparing -> ready -> completed)
  const updateOrderStatus = async (order, newStatus) => {
    await attempt(async () => {
      await db.orders.update(order.id, { status: newStatus });
      const fresh = await db.orders.get(order.id);
      if (fresh) pushOrderToCloud(fresh);
    }, `Order marked ${newStatus}`);
  };

  // Receipt printing
  const handlePrintReceipt = (order, type) => {
    printReceipt(order, type, shopName, thermalWidth, printMode).catch(err => {
      console.error('Print failed:', err);
      notify(`Print error: ${err.message}`);
    });
  };

  // Authentication Handlers
  const handleLoginSuccess = (session) => {
    setCurrentStaff(session);
    setCachedSession(session);
    setShowAuthModal(false);
    setView('pos');
    notify(`Welcome back, ${session.name}!`);
  };

  const handleLockScreen = () => {
    setShowAuthModal(true);
  };

  const handleLogout = () => {
    if (!window.confirm('Sign out of your staff account?')) return;
    logout();
    setCurrentStaff(null);
    setView('customer-menu');
    notify('Signed out to Public Menu');
  };

  // Fatal Error state
  if (loadingError) {
    return (
      <div className="fatal">
        <AlertTriangle size={48} color="#f87171" />
        <h2>Unable to open local database</h2>
        <p>{loadingError}</p>
        <p>Please check your browser storage permissions and reload.</p>
      </div>
    );
  }

  // Loading Splash Screen
  if (!ready) {
    return (
      <div className="splash">
        <Logo />
        <span className="loading-bar" />
        <p>Opening offline restaurant workspace…</p>
      </div>
    );
  }

  // Public Visitor Customer Menu View
  if (view === 'customer-menu') {
    return (
      <>
        <PublicMenuView
          products={products}
          shopName={shopName}
          currentStaff={currentStaff}
          onGoToPos={() => setView('pos')}
          onLogout={handleLogout}
          onStaffLoginClick={() => {
            if (currentStaff) {
              setView('pos');
            } else {
              setShowAuthModal(true);
            }
          }}
        />

        {/* Staff Authentication Modal */}
        {showAuthModal && (
          <AuthModal
            staffList={staff}
            currentStaff={currentStaff}
            onLoginSuccess={handleLoginSuccess}
            canCancel={true}
            onCancel={() => setShowAuthModal(false)}
          />
        )}

        {/* Toast notification */}
        {toast && (
          <div role="status" className="toast">
            <CheckCircle2 size={18} color="#10b981" />
            <span>{toast}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="shell">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={view}
        onNavigate={navigateTo}
        currentStaff={currentStaff}
        onLock={handleLockScreen}
        onLogout={handleLogout}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Main Content Area */}
      <main className="main-area">
        <Topbar
          currentView={view}
          onOpenDrawer={() => setDrawerOpen(true)}
          isOnline={online}
          currentStaff={currentStaff}
          onLock={handleLockScreen}
          isCloudConnected={isSupabaseConfigured}
          onNavigate={navigateTo}
        />

        <div className="content">
          {view === 'pos' && (
            <div className="pos-layout">
              <PosCatalog
                products={products}
                drinkInventory={inventory.filter(i => i.category === 'Beverages & Cold Drinks')}
                cart={cart}
                onAddToCart={handleAddToCart}
                onOpenVariantPicker={setVariantProduct}
                orderType={orderType}
                setOrderType={setOrderType}
                tableNumber={tableNumber}
                setTableNumber={setTableNumber}
                onOpenCart={() => setCartOpen(true)}
              />

              <CartDrawer
                isOpen={cartOpen}
                onClose={() => setCartOpen(false)}
                cart={cart}
                drinkInventory={inventory.filter(i => i.category === 'Beverages & Cold Drinks')}
                extraBottles={extraBottles}
                onAdjustExtraBottle={handleAdjustExtraBottle}
                onAdjustCart={handleAdjustCart}
                onClearCart={clearOrderForm}
                orderType={orderType}
                setOrderType={setOrderType}
                tableNumber={tableNumber}
                setTableNumber={setTableNumber}
                customerName={customerName}
                setCustomerName={setCustomerName}
                note={note}
                setNote={setNote}
                discountInput={discountInput}
                setDiscountInput={setDiscountInput}
                onSaveOrder={placeOrder}
                isSaving={isSaving}
              />
            </div>
          )}

          {view === 'orders' && (
            <OrdersView
              orders={orders}
              onPrintOrder={handlePrintReceipt}
              onCollectCash={setPayOrder}
              onUpdateOrderStatus={updateOrderStatus}
            />
          )}

          {view === 'dashboard' && currentStaff?.role === 'admin' && (
            <DashboardView
              orders={orders}
              expenses={expenses}
              inventory={inventory}
              onNavigate={navigateTo}
            />
          )}

          {view === 'reports' && currentStaff?.role === 'admin' && (
            <ReportsView
              orders={orders}
              expenses={expenses}
              inventory={inventory}
              movements={movements}
              onNavigate={navigateTo}
            />
          )}

          {view === 'menu' && currentStaff?.role === 'admin' && (
            <MenuAdmin
              products={products}
              onSaveProduct={p => attempt(() => db.products.put(p), 'Menu product saved')}
              onToggleActive={p => attempt(() => db.products.update(p.id, { active: !p.active }), 'Product availability updated')}
              onDeleteProduct={id => attempt(() => db.products.delete(id), 'Product deleted from menu')}
            />
          )}

          {view === 'inventory' && currentStaff?.role === 'admin' && (
            <InventoryView
              items={inventory}
              movements={movements}
              onAttempt={attempt}
              onPrintInventory={(filteredItems, allMovements, categoryFilter) => {
                printInventoryReport(filteredItems, allMovements, shopName, thermalWidth, printMode, { categoryFilter })
                  .catch(err => notify(`Print error: ${err.message}`));
              }}
              onSyncNow={async () => {
                if (manualSyncRef.current) {
                  const res = await manualSyncRef.current(true);
                  if (res?.lastError) {
                    alert(`Cloud sync error: ${res.lastError}`);
                  } else {
                    notify('Cloud sync completed');
                  }
                }
              }}
            />
          )}

          {view === 'expenses' && currentStaff?.role === 'admin' && (
            <ExpensesView
              expenses={expenses}
              onAttempt={attempt}
            />
          )}

          {view === 'staff' && currentStaff?.role === 'admin' && (
            <StaffView
              staff={staff}
              currentStaff={currentStaff}
              onReloadStaff={reload}
              onNotify={notify}
            />
          )}

          {view === 'settings' && currentStaff?.role === 'admin' && (
            <SettingsView
              orders={orders}
              shopName={shopName}
              thermalWidth={thermalWidth}
              printMode={printMode}
              onAttempt={attempt}
              onReload={reload}
            />
          )}
        </div>
      </main>

      {/* Floating Bottom Nav for Mobile */}
      <BottomNav
        currentView={view}
        onNavigate={navigateTo}
        currentStaff={currentStaff}
      />

      {/* Mobile Floating Cart Button (when items in cart) */}
      {view === 'pos' && cart.length > 0 && !cartOpen && (
        <button
          type="button"
          className="mobile-cart-button"
          onClick={() => setCartOpen(true)}
        >
          <span>View Order ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
          <strong>{rs(cartTotal(cart, discount))}</strong>
          <ChevronRight size={18} />
        </button>
      )}

      {/* Size / Variant Picker Modal */}
      {variantProduct && (
        <VariantModal
          product={variantProduct}
          drinkInventory={inventory.filter(i => i.category === 'Beverages & Cold Drinks')}
          onClose={() => setVariantProduct(null)}
          onSelectVariant={handleAddToCart}
        />
      )}

      {/* Post-Save Confirmation Modal */}
      {lastSavedOrder && (
        <OrderSuccessModal
          order={lastSavedOrder}
          onClose={() => setLastSavedOrder(null)}
          onPrintOrder={handlePrintReceipt}
          onCollectCash={(order) => {
            setLastSavedOrder(null);
            setPayOrder(order);
          }}
          onViewOrders={() => {
            setLastSavedOrder(null);
            navigateTo('orders');
          }}
          onNewOrder={() => {
            setLastSavedOrder(null);
            clearOrderForm();
            navigateTo('pos');
          }}
        />
      )}

      {/* Cash Collection Modal */}
      {payOrder && (
        <PayModal
          order={orders.find(o => o.id === payOrder.id) || payOrder}
          onClose={() => setPayOrder(null)}
          onConfirmPayment={collectCashPayment}
        />
      )}

      {/* Staff Authentication / Lock Screen Modal */}
      {showAuthModal && (
        <AuthModal
          staffList={staff}
          currentStaff={currentStaff}
          onLoginSuccess={handleLoginSuccess}
          canCancel={!!currentStaff}
          onCancel={() => setShowAuthModal(false)}
        />
      )}

      {/* Notification Toast */}
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} color="#10b981" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
