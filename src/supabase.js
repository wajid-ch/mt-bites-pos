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
// ORDERS SYNCHRONIZATION & REALTIME
// ==========================================

export async function pushOrderToCloud(order) {
  if (!supabase) return;
  try {
    const payload = {
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
      cash_received: order.cashReceived || null,
      change: order.change || null,
      paid_at: order.paidAt || null,
      cashier_name: order.cashierName || null
    };
    const { error } = await supabase.from('orders').upsert(payload);
    if (error) throw error;
  } catch (err) {
    console.warn('[Supabase] Order sync to cloud failed:', err.message);
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
// INVENTORY & EXPENSES SYNC
// ==========================================

export async function pushInventoryToCloud(item) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('inventory').upsert(item);
    if (error) throw error;
  } catch (err) {
    console.warn('[Supabase] Inventory sync failed:', err.message);
  }
}

export async function fetchInventoryFromCloud() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('inventory').select('*');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Fetch inventory failed:', err.message);
    return [];
  }
}

export async function pushExpenseToCloud(expense) {
  if (!supabase) return;
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
  } catch (err) {
    console.warn('[Supabase] Expense sync failed:', err.message);
  }
}

export async function fetchExpensesFromCloud() {
  if (!supabase) return [];
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
    return [];
  }
}
