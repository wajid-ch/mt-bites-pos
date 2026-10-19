import Dexie from 'dexie';
import { seedProducts, getProductImage } from './menu.js';
import { hashPin } from './auth.js';
import { restaurantInventoryTemplates } from './inventory-templates.js';

export const db = new Dexie('mt-bites-pos-v1');

// Version 1: original schema
db.version(1).stores({
  products: 'id,category,name,active',
  orders: 'id,number,createdAt,paymentStatus,status,orderType',
  inventory: 'id,name,category',
  inventoryMovements: 'id,itemId,createdAt',
  expenses: 'id,createdAt,category',
  settings: 'key'
});

// Version 2: adds staff table for secure offline authentication and role authorization
db.version(2).stores({
  products: 'id,category,name,active',
  orders: 'id,number,createdAt,paymentStatus,status,orderType',
  inventory: 'id,name,category',
  inventoryMovements: 'id,itemId,createdAt',
  expenses: 'id,createdAt,category',
  settings: 'key',
  staff: 'id,username,role,active,name'
});

export async function initializeDatabase() {
  await db.transaction('rw', db.products, db.settings, db.staff, db.inventory, db.inventoryMovements, async () => {
    const seeded = await db.settings.get('initialSeedComplete');
    if (!seeded) {
      await db.products.bulkPut(seedProducts());
      await db.settings.put({ key: 'initialSeedComplete', value: true });
      await db.settings.put({ key: 'shopName', value: 'MT Bites' });
      await db.settings.put({ key: 'thermalWidth', value: '80mm' });
    } else {
      // Ensure products have image property populated
      const existing = await db.products.toArray();
      const needsImageUpdate = existing.some(p => !p.image);
      if (needsImageUpdate) {
        for (const p of existing) {
          if (!p.image) {
            await db.products.update(p.id, { image: getProductImage(p) });
          }
        }
      }
    }

    // Ensure dummy inventory stock is removed so admin can add real inventory items himself
    const dummyCleared = await db.settings.get('dummyInventoryClearedV2');
    if (!dummyCleared) {
      await db.inventory.clear();
      await db.inventoryMovements.clear();
      await db.settings.put({ key: 'dummyInventoryClearedV2', value: true });
    }

    // Seed staff accounts if none exist
    const staffCount = await db.staff.count();
    if (staffCount === 0) {
      const now = new Date().toISOString();
      await db.staff.bulkAdd([
        {
          id: 'staff-admin-1',
          username: 'admin',
          name: 'Owner (Admin)',
          role: 'admin',
          pinHash: hashPin('2026', 'admin_salt'),
          salt: 'admin_salt',
          active: true,
          createdAt: now,
          lastLogin: null
        },
        {
          id: 'staff-waiter-1',
          username: 'waiter1',
          name: 'Floor Waiter',
          role: 'waiter',
          pinHash: hashPin('1234', 'waiter_salt'),
          salt: 'waiter_salt',
          active: true,
          createdAt: now,
          lastLogin: null
        }
      ]);
    }
  });
}

export async function exportBackup() {
  const result = { format: 'mt-bites-backup', version: 2, createdAt: new Date().toISOString() };
  for (const table of db.tables) {
    result[table.name] = await table.toArray();
  }
  return JSON.stringify(result, null, 2);
}

export async function restoreBackup(data) {
  if (data?.format !== 'mt-bites-backup' || !Array.isArray(data.products) || !Array.isArray(data.orders)) {
    throw new Error('Not a valid MT Bites backup file.');
  }
  await db.transaction('rw', ...db.tables, async () => {
    for (const table of db.tables) {
      if (Array.isArray(data[table.name])) {
        await table.clear();
        await table.bulkAdd(data[table.name]);
      }
    }
  });
}
