import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project-id')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

// ==========================================
// SUPABASE AUTH (EMAIL & PASSWORD)
// ==========================================

export async function signInWithEmailCloud(email, password) {
  if (!supabase) throw new Error('Cloud database is not configured');
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password
  });
  if (error) throw error;
  return data;
}

export async function requestPasswordResetCloud(email) {
  if (!supabase) throw new Error('Cloud database is not configured');
  const cleanEmail = email.trim().toLowerCase();
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const { data, error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo
  });
  if (error) throw error;
  return data;
}

export async function updateUserPasswordCloud(newPassword) {
  if (!supabase) throw new Error('Cloud database is not configured');
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
  return data;
}

export async function signOutCloud() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[Supabase] Sign out error:', err.message);
  }
}

// ==========================================
// STAFF SYNCHRONIZATION
// ==========================================

export async function fetchStaffFromCloud() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('staff').select('*');
    if (error) throw error;
    return (data || []).map(s => ({
      id: s.id,
      username: s.username,
      name: s.name,
      role: s.role,
      pinHash: s.pin_hash,
      salt: s.salt,
      active: s.active,
      createdAt: s.created_at,
      lastLogin: s.last_login
    }));
  } catch (err) {
    console.warn('[Supabase] Failed to fetch staff from cloud:', err.message);
    return [];
  }
}

export async function pushStaffToCloud(staffMember) {
  if (!supabase) return;
  try {
    const payload = {
      id: staffMember.id,
      username: staffMember.username,
      name: staffMember.name,
      role: staffMember.role,
      pin_hash: staffMember.pinHash,
      salt: staffMember.salt,
      active: staffMember.active,
      created_at: staffMember.createdAt,
      last_login: staffMember.lastLogin
    };
    const { error } = await supabase.from('staff').upsert(payload);
    if (error) throw error;
  } catch (err) {
    console.warn('[Supabase] Staff sync to cloud failed:', err.message);
  }
}

export async function deleteStaffFromCloud(staffId) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('staff').delete().eq('id', staffId);
    if (error) throw error;
  } catch (err) {
    console.warn('[Supabase] Staff delete from cloud failed:', err.message);
  }
}

// ==========================================
// OFFLINE-SAFE PENDING CLOUD SYNC OUTBOX
// ==========================================

const PENDING_SYNC_KEY = 'mt_bites_pending_sync_v1';
let lastLocalInventoryWriteAt = 0;

export function markLocalInventoryWrite() {
  lastLocalInventoryWriteAt = Date.now();
}

export function getLastLocalInventoryWrite() {
  return lastLocalInventoryWriteAt;
}

function readPendingSync() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PENDING_SYNC_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function writePendingSync(queue) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
    }
  } catch {
    // ignore
  }
}

export function enqueuePendingSync(type, payload) {
  const queue = readPendingSync();
  // Deduplicate upserts by (type + id) so the latest version wins
  const filtered = payload?.id
    ? queue.filter(q => !(q.type === type && q.payload?.id === payload.id))
    : queue;
  filtered.push({ type, payload, queuedAt: new Date().toISOString() });
  writePendingSync(filtered);
}

export function getPendingSyncCount() {
  return readPendingSync().length;
}

// ==========================================
// ORDERS SYNCHRONIZATION & REALTIME
// ==========================================

function mapLocalOrderToCloud(order) {
  return {
    id: order.id,
    number: order.number,
    created_at: order.createdAt,
    order_type: order.orderType,
    table_number: order.tableNumber || null,
    customer_name: order.customerName || null,
    server_name: order.serverName || null,
    server_id: order.serverId || null,
    note: order.note || null,
    items: order.items,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    status: order.status,
    payment_status: order.paymentStatus,
    payment_method: order.paymentMethod || null,
    cash_received: order.cashReceived ?? null,
    change: order.change ?? null,
    paid_at: order.paidAt || null,
    cashier_name: order.cashierName || null
  };
}

export async function pushOrderToCloud(order, { queueOnFail = true } = {}) {
  if (!supabase) return { ok: false, reason: 'not-configured' };
  try {
    const payload = mapLocalOrderToCloud(order);
    const { error } = await supabase.from('orders').upsert(payload);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.warn('[Supabase] Order sync to cloud failed:', err.message);
    if (queueOnFail) enqueuePendingSync('order_upsert', order);
    return { ok: false, error: err.message };
  }
}

export async function fetchOrdersFromCloud() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return (data || []).map(o => ({
      id: o.id,
      number: o.number,
      createdAt: o.created_at,
      orderType: o.order_type,
      tableNumber: o.table_number || '',
      customerName: o.customer_name || '',
      serverName: o.server_name || '',
      serverId: o.server_id || '',
      note: o.note || '',
      items: o.items || [],
      subtotal: Number(o.subtotal || 0),
      discount: Number(o.discount || 0),
      total: Number(o.total || 0),
      status: o.status,
      paymentStatus: o.payment_status,
      paymentMethod: o.payment_method,
      cashReceived: o.cash_received !== null ? Number(o.cash_received) : null,
      change: o.change !== null ? Number(o.change) : null,
      paidAt: o.paid_at,
      cashierName: o.cashier_name
    }));
  } catch (err) {
    console.warn('[Supabase] Failed to fetch orders from cloud:', err.message);
    return [];
  }
}

export function subscribeToRealtimeOrders(onInsert, onUpdate) {
  if (!supabase) return null;
  const channel = supabase
    .channel('public:orders')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
      if (onInsert && payload.new) {
        onInsert(mapCloudOrderToLocal(payload.new));
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
      if (onUpdate && payload.new) {
        onUpdate(mapCloudOrderToLocal(payload.new));
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

function mapCloudOrderToLocal(o) {
  return {
    id: o.id,
    number: o.number,
    createdAt: o.created_at,
    orderType: o.order_type,
    tableNumber: o.table_number || '',
    customerName: o.customer_name || '',
    serverName: o.server_name || '',
    serverId: o.server_id || '',
    note: o.note || '',
    items: o.items || [],
    subtotal: Number(o.subtotal || 0),
    discount: Number(o.discount || 0),
    total: Number(o.total || 0),
    status: o.status,
    paymentStatus: o.payment_status,
    paymentMethod: o.payment_method,
    cashReceived: o.cash_received !== null ? Number(o.cash_received) : null,
    change: o.change !== null ? Number(o.change) : null,
    paidAt: o.paid_at,
    cashierName: o.cashier_name
  };
}

// ==========================================
// INVENTORY, MOVEMENTS & EXPENSES SYNC
// ==========================================

function mapLocalInventoryToCloud(item) {
  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    quantity: Number(item.quantity || 0),
    minimum: Number(item.minimum || 0),
    category: item.category || 'Supplies'
  };
}

function mapCloudInventoryToLocal(item) {
  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    quantity: Number(item.quantity || 0),
    minimum: Number(item.minimum || 0),
    category: item.category || 'Supplies'
  };
}

function mapLocalMovementToCloud(m) {
  return {
    id: m.id,
    item_id: m.itemId,
    delta: Number(m.delta || 0),
    reason: m.reason || '',
    created_at: m.createdAt
  };
}

function mapCloudMovementToLocal(m) {
  return {
    id: m.id,
    itemId: m.item_id,
    delta: Number(m.delta || 0),
    reason: m.reason || '',
    createdAt: m.created_at
  };
}

export async function pushInventoryToCloud(item, { queueOnFail = true } = {}) {
  markLocalInventoryWrite();
  if (!supabase) return { ok: false, reason: 'not-configured' };
  try {
    const payload = mapLocalInventoryToCloud(item);
    const { error } = await supabase.from('inventory').upsert(payload);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.warn('[Supabase] Inventory sync failed:', err.message);
    if (queueOnFail) enqueuePendingSync('inventory_upsert', item);
    return { ok: false, error: err.message };
  }
}

export async function deleteInventoryFromCloud(itemId, { queueOnFail = true } = {}) {
  if (!supabase) return { ok: false, reason: 'not-configured' };
  try {
    const { error: movErr } = await supabase.from('inventory_movements').delete().eq('item_id', itemId);
    if (movErr) console.warn('[Supabase] Delete movements notice:', movErr.message);
    const { error } = await supabase.from('inventory').delete().eq('id', itemId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.warn('[Supabase] Inventory delete failed:', err.message);
    if (queueOnFail) enqueuePendingSync('inventory_delete', { id: itemId });
    return { ok: false, error: err.message };
  }
}

export async function clearInventoryFromCloud() {
  if (!supabase) return { ok: false };
  try {
    await supabase.from('inventory_movements').delete().neq('id', 'keep-all');
    const { error } = await supabase.from('inventory').delete().neq('id', 'keep-all');
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.warn('[Supabase] Clear inventory cloud failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Applies a relative stock delta (+restock or -order deduction) against the latest
 * cloud balance so two waiters on two phones don't overwrite each other's deductions.
 */
export async function applyInventoryDeltaCloud(itemId, delta, fallbackItem = null, { queueOnFail = true } = {}) {
  markLocalInventoryWrite();
  if (!supabase) return { ok: false, reason: 'not-configured' };
  try {
    const { data: current, error: fetchErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', itemId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    const baseQty = current ? Number(current.quantity || 0) : Number(fallbackItem?.quantity ?? 0);
    const nextQty = current ? Math.max(0, baseQty + Number(delta || 0)) : Math.max(0, baseQty);
    const payload = current
      ? { ...current, quantity: nextQty }
      : mapLocalInventoryToCloud({ ...(fallbackItem || { id: itemId }), quantity: nextQty });

    const { error: upsertErr } = await supabase.from('inventory').upsert(payload);
    if (upsertErr) throw upsertErr;
    return { ok: true, quantity: nextQty };
  } catch (err) {
    console.warn('[Supabase] Atomic delta sync failed:', err.message);
    if (queueOnFail) enqueuePendingSync('inventory_delta', { id: itemId, delta, fallbackItem });
    return { ok: false, error: err.message };
  }
}

export async function fetchInventoryFromCloud() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('inventory').select('*');
    if (error) throw error;
    return (data || []).map(mapCloudInventoryToLocal);
  } catch (err) {
    console.warn('[Supabase] Fetch inventory failed:', err.message);
    return null;
  }
}

export async function pushInventoryMovementToCloud(movement, { queueOnFail = true } = {}) {
  if (!supabase) return { ok: false, reason: 'not-configured' };
  try {
    const payload = mapLocalMovementToCloud(movement);
    const { error } = await supabase.from('inventory_movements').upsert(payload);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.warn('[Supabase] Movement sync failed:', err.message);
    if (queueOnFail) enqueuePendingSync('movement_upsert', movement);
    return { ok: false, error: err.message };
  }
}

export async function fetchInventoryMovementsFromCloud() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw error;
    return (data || []).map(mapCloudMovementToLocal);
  } catch (err) {
    console.warn('[Supabase] Fetch movements failed:', err.message);
    return null;
  }
}

export function subscribeToRealtimeInventory(onUpsert, onDelete) {
  if (!supabase) return null;
  const channel = supabase
    .channel('public:inventory')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory' }, payload => {
      if (onUpsert && payload.new) onUpsert(mapCloudInventoryToLocal(payload.new));
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory' }, payload => {
      if (onUpsert && payload.new) onUpsert(mapCloudInventoryToLocal(payload.new));
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'inventory' }, payload => {
      if (onDelete && payload.old?.id) onDelete(payload.old.id);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToRealtimeMovements(onInsert) {
  if (!supabase) return null;
  const channel = supabase
    .channel('public:inventory_movements')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory_movements' }, payload => {
      if (onInsert && payload.new) onInsert(mapCloudMovementToLocal(payload.new));
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function clearTestOrdersCloud() {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('orders').delete().neq('id', 'keep-all');
    if (error) console.warn('[Supabase] Clear cloud orders notice:', error.message);
  } catch (err) {
    console.warn('[Supabase] Clear cloud orders failed:', err.message);
  }
}

export async function clearTestExpensesCloud() {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('expenses').delete().neq('id', 'keep-all');
    if (error) console.warn('[Supabase] Clear cloud expenses notice:', error.message);
  } catch (err) {
    console.warn('[Supabase] Clear cloud expenses failed:', err.message);
  }
}

export async function pushExpenseToCloud(expense, { queueOnFail = true } = {}) {
  if (!supabase) return { ok: false, reason: 'not-configured' };
  try {
    const payload = {
      id: expense.id,
      created_at: expense.createdAt,
      category: expense.category,
      amount: expense.amount,
      note: expense.note || null,
      payment_method: expense.paymentMethod || 'cash'
    };
    const { error } = await supabase.from('expenses').upsert(payload);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.warn('[Supabase] Expense sync failed:', err.message);
    if (queueOnFail) enqueuePendingSync('expense_upsert', expense);
    return { ok: false, error: err.message };
  }
}

export async function fetchExpensesFromCloud() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(e => ({
      id: e.id,
      createdAt: e.created_at,
      category: e.category,
      amount: Number(e.amount || 0),
      note: e.note || '',
      paymentMethod: e.payment_method || 'cash'
    }));
  } catch (err) {
    console.warn('[Supabase] Fetch expenses failed:', err.message);
    return null;
  }
}

/**
 * Flushes any queued offline writes to Supabase in FIFO order.
 */
export async function flushPendingSync() {
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { flushed: 0, remaining: getPendingSyncCount() };
  }
  const queue = readPendingSync();
  if (!queue.length) return { flushed: 0, remaining: 0 };

  const remaining = [];
  let flushed = 0;
  let lastError = '';

  for (const job of queue) {
    let res = { ok: false };
    if (job.type === 'order_upsert') {
      res = await pushOrderToCloud(job.payload, { queueOnFail: false });
    } else if (job.type === 'inventory_upsert') {
      res = await pushInventoryToCloud(job.payload, { queueOnFail: false });
    } else if (job.type === 'inventory_delete') {
      res = await deleteInventoryFromCloud(job.payload.id, { queueOnFail: false });
    } else if (job.type === 'inventory_delta') {
      res = await applyInventoryDeltaCloud(job.payload.id, job.payload.delta, job.payload.fallbackItem, { queueOnFail: false });
    } else if (job.type === 'movement_upsert') {
      res = await pushInventoryMovementToCloud(job.payload, { queueOnFail: false });
    } else if (job.type === 'expense_upsert') {
      res = await pushExpenseToCloud(job.payload, { queueOnFail: false });
    }
    if (res.ok) {
      flushed++;
    } else {
      if (res.error) lastError = res.error;
      remaining.push(job);
    }
  }

  writePendingSync(remaining);
  return { flushed, remaining: remaining.length, lastError };
}
