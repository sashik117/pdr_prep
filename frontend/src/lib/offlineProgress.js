const DB_NAME = 'pdrprep-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-test-results';
const FALLBACK_KEY = 'driveprep-pending-test-results';

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

function readFallbackQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallbackQueue(items) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(items));
  } catch {
    // IndexedDB remains the primary queue; this fallback is best-effort.
  }
}

/** @param {any} payload */
export async function queuePendingTestResult(payload) {
  /** @returns {Promise<number>} */
  try {
    return await withStore('readwrite', (store, resolve) => {
      const request = store.add({
        payload,
        createdAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve(request.result);
    });
  } catch {
    const id = `ls:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    writeFallbackQueue([
      ...readFallbackQueue(),
      {
        id,
        payload,
        createdAt: new Date().toISOString(),
      },
    ]);
    return id;
  }
}

export async function getPendingTestResults() {
  /** @returns {Promise<PendingTestResult[]>} */
  const fallback = readFallbackQueue();
  try {
    const indexed = await withStore('readonly', (store, resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
    });
    return [...indexed, ...fallback];
  } catch {
    return fallback;
  }
}

/** @param {number} id */
export async function removePendingTestResult(id) {
  if (String(id).startsWith('ls:')) {
    writeFallbackQueue(readFallbackQueue().filter((item) => item.id !== id));
    return;
  }
  try {
    await withStore('readwrite', (store) => {
      store.delete(id);
    });
  } catch {
    writeFallbackQueue(readFallbackQueue().filter((item) => item.id !== id));
  }
}

export async function hasPendingTestResults() {
  const items = await getPendingTestResults();
  return items.length > 0;
}
