import { db } from './db.js';
import { generateId } from './id.js';
import {
  pushStaffToCloud,
  deleteStaffFromCloud,
  fetchStaffFromCloud,
  signInWithEmailCloud,
  requestPasswordResetCloud,
  signOutCloud
} from './supabase.js';

// Simple deterministic hash function for PIN verification that works everywhere (insecure HTTP and Node)
function simpleHash(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ('0000000' + (hash >>> 0).toString(16)).slice(-8);
}

export function hashPin(pin, salt = 'mtbites') {
  // Triple-pass salted hash
  const p1 = simpleHash(`${salt}::${pin}`);
  const p2 = simpleHash(`${pin}::${p1}`);
  return simpleHash(`${p2}::${salt}`);
}

const SESSION_KEY = 'mt_bites_auth_session';
const ATTEMPTS_KEY = 'mt_bites_login_attempts';
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_SECONDS = 60;

// Known restaurant admin emails with full superuser privileges
export const KNOWN_ADMIN_EMAILS = [
  'rajasaad9264@gmail.com',
  'wajidqayyum286@gmail.com'
];

// ==========================================
// BRUTE-FORCE LOCKOUT PROTECTION
// ==========================================

let memoryAttemptsStore = {};

function getAttemptsStore() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      const raw = localStorage.getItem(ATTEMPTS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return memoryAttemptsStore;
}

function saveAttemptsStore(store) {
  memoryAttemptsStore = store;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(store));
    }
  } catch {
    // ignore
  }
}

export function getLockoutRemaining(identifier) {
  if (!identifier) return 0;
  const key = identifier.trim().toLowerCase();
  const store = getAttemptsStore();
  const record = store[key];
  if (!record || !record.lockedUntil) return 0;

  const remainingMs = record.lockedUntil - Date.now();
  if (remainingMs <= 0) {
    // Lockout expired, clear lockedUntil
    delete record.lockedUntil;
    record.count = 0;
    saveAttemptsStore(store);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

export function recordFailedAttempt(identifier) {
  if (!identifier) return { attempts: 1, lockedFor: 0 };
  const key = identifier.trim().toLowerCase();
  const store = getAttemptsStore();
  const now = Date.now();

  const record = store[key] || { count: 0, firstAttempt: now };
  record.count = (record.count || 0) + 1;
  record.lastAttempt = now;

  let lockedFor = 0;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + (LOCKOUT_DURATION_SECONDS * 1000);
    lockedFor = LOCKOUT_DURATION_SECONDS;
  }
  store[key] = record;
  saveAttemptsStore(store);

  return {
    attempts: record.count,
    lockedFor,
    remainingSeconds: lockedFor
  };
}

export function clearFailedAttempts(identifier) {
  if (!identifier) return;
  const key = identifier.trim().toLowerCase();
  const store = getAttemptsStore();
  if (store[key]) {
    delete store[key];
    saveAttemptsStore(store);
  }
}

// ==========================================
// SESSION MANAGEMENT (PERMANENT DEVICE PERSISTENCE)
// ==========================================

const PERMANENT_DEVICE_KEY = 'mt_bites_device_session_v1';

export function getCachedSession() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem(PERMANENT_DEVICE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.role) return parsed;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

export function setCachedSession(user) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (user) {
        const payload = JSON.stringify({ ...user, persistent: true });
        localStorage.setItem(SESSION_KEY, payload);
        localStorage.setItem(PERMANENT_DEVICE_KEY, payload);
      } else {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(PERMANENT_DEVICE_KEY);
      }
    }
  } catch (e) {
    console.error('Failed to update session in storage', e);
  }
}

// ==========================================
// AUTHENTICATION FLOWS
// ==========================================

export async function loginWithPin(username, pin) {
  const cleanUser = username.trim().toLowerCase();

  // Check brute force lockout
  const remaining = getLockoutRemaining(cleanUser);
  if (remaining > 0) {
    throw new Error(`Too many failed attempts. Locked for ${remaining}s.`);
  }

  let staff = await db.staff.where('username').equalsIgnoreCase(cleanUser).first();

  // If not found in local IndexedDB, check Supabase cloud for newly provisioned accounts
  if (!staff) {
    try {
      const cloudStaff = await fetchStaffFromCloud();
      if (cloudStaff && cloudStaff.length > 0) {
        await db.staff.bulkPut(cloudStaff);
        staff = await db.staff.where('username').equalsIgnoreCase(cleanUser).first();
      }
    } catch {
      // Offline fallback: continue with local check
    }
  }

  if (!staff) {
    throw new Error('User not found. Check your username or ask an admin.');
  }
  if (!staff.active) {
    throw new Error('This account is disabled. Contact the restaurant owner.');
  }
  const inputHash = hashPin(pin.trim(), staff.salt);
  if (inputHash !== staff.pinHash) {
    const { attempts, lockedFor } = recordFailedAttempt(cleanUser);
    if (lockedFor > 0) {
      throw new Error(`Too many failed attempts. Account locked for ${lockedFor}s.`);
    }
    const left = Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
    throw new Error(`Incorrect PIN. ${left} attempt(s) remaining.`);
  }

  // Clear failed attempts on success
  clearFailedAttempts(cleanUser);

  // Update last login locally and in cloud
  const now = new Date().toISOString();
  await db.staff.update(staff.id, { lastLogin: now });
  pushStaffToCloud({ ...staff, lastLogin: now });

  const session = {
    id: staff.id,
    username: staff.username,
    name: staff.name,
    role: staff.role
  };
  setCachedSession(session);
  return session;
}

export async function loginWithEmail(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter your email address.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  // Check brute force lockout
  const remaining = getLockoutRemaining(cleanEmail);
  if (remaining > 0) {
    throw new Error(`Too many failed attempts. Account locked for ${remaining}s.`);
  }

  try {
    const data = await signInWithEmailCloud(cleanEmail, password);
    clearFailedAttempts(cleanEmail);

    const user = data?.user;
    const isOwner = cleanEmail === 'rajasaad9264@gmail.com';
    const isTechAdmin = cleanEmail === 'wajidqayyum286@gmail.com';
    const name = isOwner
      ? 'Raja Saad (Owner)'
      : isTechAdmin
      ? 'Wajid (Tech Admin)'
      : (user?.user_metadata?.full_name || 'Administrator');

    const session = {
      id: user?.id || `admin-${cleanEmail}`,
      username: cleanEmail,
      name,
      role: 'admin',
      email: cleanEmail
    };

    // Upsert local staff record for permissions and offline caching
    try {
      const existing = await db.staff.where('username').equalsIgnoreCase(cleanEmail).first();
      const now = new Date().toISOString();
      if (!existing) {
        await db.staff.add({
          id: `staff-${generateId()}`,
          username: cleanEmail,
          name,
          role: 'admin',
          pinHash: '',
          salt: '',
          active: true,
          createdAt: now,
          lastLogin: now
        });
      } else {
        await db.staff.update(existing.id, { lastLogin: now, active: true });
      }
    } catch (e) {
      console.warn('Local staff cache error:', e);
    }

    setCachedSession(session);
    return session;
  } catch (err) {
    const { attempts, lockedFor } = recordFailedAttempt(cleanEmail);
    if (lockedFor > 0) {
      throw new Error(`Too many failed attempts. Account locked for ${lockedFor}s.`);
    }
    const left = Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
    const msg = err.message || 'Invalid email or password.';
    throw new Error(`${msg} (${left} attempt(s) remaining)`);
  }
}

export async function requestPasswordReset(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter your email address to reset password.');
  }
  return await requestPasswordResetCloud(cleanEmail);
}

export function logout() {
  setCachedSession(null);
  signOutCloud();
}

export async function createStaffMember(currentUser, { username, name, role, pin }) {
  if (currentUser?.role !== 'admin') {
    throw new Error('Only owners and managers can create staff accounts.');
  }
  if (!username?.trim() || !name?.trim() || !pin?.trim()) {
    throw new Error('Username, full name, and PIN are required.');
  }
  const cleanUser = username.trim().toLowerCase();
  const existing = await db.staff.where('username').equalsIgnoreCase(cleanUser).first();
  if (existing) {
    throw new Error(`Username "${cleanUser}" already exists.`);
  }

  const salt = generateId().slice(0, 8);
  const staff = {
    id: `staff-${generateId()}`,
    username: cleanUser,
    name: name.trim(),
    role: role === 'admin' ? 'admin' : 'waiter',
    pinHash: hashPin(pin.trim(), salt),
    salt,
    active: true,
    createdAt: new Date().toISOString(),
    lastLogin: null
  };

  await db.staff.add(staff);
  // Synchronize to cloud database
  await pushStaffToCloud(staff);
  return staff;
}

export async function updateStaffMember(currentUser, staffId, updates) {
  if (currentUser?.role !== 'admin') {
    throw new Error('Only owners and managers can update staff accounts.');
  }
  const target = await db.staff.get(staffId);
  if (!target) throw new Error('Staff member not found');

  const patch = {};
  if (updates.name) patch.name = updates.name.trim();
  if (updates.role) patch.role = updates.role === 'admin' ? 'admin' : 'waiter';
  if (typeof updates.active === 'boolean') patch.active = updates.active;
  if (updates.pin) {
    patch.pinHash = hashPin(updates.pin.trim(), target.salt);
  }

  await db.staff.update(staffId, patch);
  const updated = await db.staff.get(staffId);
  if (updated) {
    await pushStaffToCloud(updated);
  }
  return updated;
}

export async function deleteStaffMember(currentUser, staffId) {
  if (currentUser?.role !== 'admin') {
    throw new Error('Only owners and managers can remove staff.');
  }
  const target = await db.staff.get(staffId);
  if (!target) return;
  if (target.username === 'admin') {
    throw new Error('The primary admin account cannot be deleted.');
  }
  await db.staff.delete(staffId);
  await deleteStaffFromCloud(staffId);
}

export function hasPermission(role, action) {
  if (role === 'admin') return true;
  if (role === 'waiter') {
    const waiterActions = [
      'create_order',
      'view_orders',
      'update_order_status',
      'collect_cash',
      'print_receipt'
    ];
    return waiterActions.includes(action);
  }
  return false;
}
