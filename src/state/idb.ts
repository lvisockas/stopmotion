/** Tiny promise wrapper over one IndexedDB object store: image id → Blob. */
const DB_NAME = 'stopmotion-carousel';
const STORE = 'images';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const putBlob = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id)).then(() => undefined);
export const getBlob = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id));
export const deleteBlob = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined);
export const allBlobIds = () => run<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((k) => k.map(String));
export const clearBlobs = () => run('readwrite', (s) => s.clear()).then(() => undefined);
