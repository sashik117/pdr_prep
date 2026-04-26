const DB_NAME = 'pdrprep-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-test-results';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

async function withStore(mode, executor) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = executor(store, resolve, reject);
    transaction.oncomplete = () => {
      if (result !== undefined) resolve(result);
      db.close();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('IndexedDB transaction failed'));
    };
  });
}

export async function queuePendingTestResult(payload) {
  return withStore('readwrite', (store, resolve) => {
    const request = store.add({
      payload,
      createdAt: new Date().toISOString(),
    });
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getPendingTestResults() {
  return withStore('readonly', (store, resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function removePendingTestResult(id) {
  return withStore('readwrite', (store) => {
    store.delete(id);
  });
}

export async function hasPendingTestResults() {
  const items = await getPendingTestResults();
  return items.length > 0;
}
