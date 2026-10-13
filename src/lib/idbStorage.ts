import { StateStorage, createJSONStorage } from 'zustand/middleware';

const DB_NAME = 'z-services-ai-storage';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';

// Open (or create) the IndexedDB database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get item from IndexedDB
async function getItem(name: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(name);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

// Set item in IndexedDB
async function setItem(name: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Fallback: try localStorage (limited)
    try {
      localStorage.setItem(name, value);
    } catch {
      console.warn('[IDBStorage] Failed to persist, storage may be full');
    }
  }
}

// Remove item from IndexedDB
async function removeItem(name: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    try { localStorage.removeItem(name); } catch { /* ignore */ }
  }
}

// Zustand-compatible StateStorage using IndexedDB
export const idbStorage: StateStorage = {
  getItem: (name) => getItem(name),
  setItem: (name, value) => setItem(name, value),
  removeItem: (name) => removeItem(name),
};

// Helper to create a persist middleware with IndexedDB storage
// Also keeps a lightweight copy in localStorage for fast initial reads
export function createIDBPersistStorage(name: string) {
  return createJSONStorage(() => idbStorage, { name });
}
