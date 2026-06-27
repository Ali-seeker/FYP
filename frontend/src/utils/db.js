import { openDB } from 'idb';

const DB_NAME = 'ai-assistant-offline-db';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Offline changes queue (sales, stock updates, etc.)
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { keyPath: 'tempId' });
      }
      
      // Cached data for offline viewing/validation (Products, Customers)
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: '_id' });
      }
    },
  });
};

export const addOfflineAction = async (action) => {
  const db = await initDB();
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const payload = { tempId, ...action, timestamp: Date.now(), status: 'pending' };
  await db.put('sync-queue', payload);
  return tempId;
};

export const getOfflineActions = async () => {
  const db = await initDB();
  return db.getAll('sync-queue');
};

export const removeOfflineAction = async (tempId) => {
  const db = await initDB();
  return db.delete('sync-queue', tempId);
};

export const clearSyncQueue = async () => {
    const db = await initDB();
    return db.clear('sync-queue');
};

// Cache utilities
export const cacheProducts = async (products) => {
  const db = await initDB();
  const tx = db.transaction('products', 'readwrite');
  products.forEach(product => tx.store.put(product));
  await tx.done;
};

export const getCachedProducts = async () => {
  const db = await initDB();
  return db.getAll('products');
};
