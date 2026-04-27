const DB_NAME = 'pdrprep-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-test-results';

/** @typedef {{ id?: number, payload: any, createdAt: string }} PendingTestResult */

function openDb() {
  /** @returns {Promise<IDBDatabase>} */
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

/**
 * @template T
 * @param {'readonly' | 'readwrite'} mode
 * @param {(store: IDBObjectStore, resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => T | void} executor
 * @returns {Promise<T>}
 */
async function withStore(mode, executor) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = executor(store, resolve, reject);
    transaction.oncomplete = () => {
      if (result !== undefined) resolve(/** @type {T} */ (result));
      db.close();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('IndexedDB transaction failed'));
    };
  });
}

/** @param {any} payload */
export async function queuePendingTestResult(payload) {
  /** @returns {Promise<number>} */
  return withStore('readwrite', (store, resolve) => {
    const request = store.add({
      payload,
      createdAt: new Date().toISOString(),
    });
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getPendingTestResults() {
  /** @returns {Promise<PendingTestResult[]>} */
  return withStore('readonly', (store, resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
}

/** @param {number} id */
export async function removePendingTestResult(id) {
  return withStore('readwrite', (store) => {
    store.delete(id);
  });
}

export async function hasPendingTestResults() {
  const items = await getPendingTestResults();
  return items.length > 0;
}
