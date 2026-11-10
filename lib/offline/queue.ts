'use client';

/**
 * lib/offline/queue — IndexedDB write-queue for offline scans (Phase 5 gap).
 * Zero deps (raw IDB — dexie was deliberately removed). Scanned ops queue
 * here when the network drops and replay through POST /api/v1/movements
 * on reconnect, so a warehouse aisle with dead wifi still records stock.
 *
 * Scope: receive + issue movements only. Tool checkout/return, stock-take
 * joins and product creation need live server state — they stay online.
 */

export interface QueuedMovement {
  id: string;
  product_id?: string;
  sku?: string;
  type: 'inbound' | 'outbound' | 'receiving';
  quantity: number;
  reason: string;
  queued_at: number;
}

const DB_NAME = 'vms-offline';
const STORE = 'movement_queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}

export async function enqueueMovement(m: Omit<QueuedMovement, 'id' | 'queued_at'>): Promise<QueuedMovement> {
  const item: QueuedMovement = { ...m, id: crypto.randomUUID(), queued_at: Date.now() };
  await tx('readwrite', (s) => s.put(item));
  return item;
}

export async function listQueuedMovements(): Promise<QueuedMovement[]> {
  const rows = await tx('readonly', (s) => s.getAll() as IDBRequest<QueuedMovement[]>);
  return rows.sort((a, b) => a.queued_at - b.queued_at);
}

export async function removeQueuedMovement(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function queuedCount(): Promise<number> {
  try {
    return await tx('readonly', (s) => s.count());
  } catch {
    return 0; // IDB unavailable (private mode) — treat as empty
  }
}

/** POST one queued movement through the REST route. Returns 'ok' |
 * 'permanent' (4xx — drop it) | 'network' (stop, still offline). */
export async function flushOne(m: QueuedMovement): Promise<'ok' | 'permanent' | 'network'> {
  try {
    const res = await fetch('/api/v1/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: m.product_id,
        sku: m.sku,
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
      }),
    });
    if (res.ok) return 'ok';
    return res.status < 500 ? 'permanent' : 'network';
  } catch {
    return 'network';
  }
}

export async function flushMovements(): Promise<{ synced: number; failed: number; pending: number }> {
  const rows = await listQueuedMovements();
  let synced = 0;
  let failed = 0;
  for (const m of rows) {
    const outcome = await flushOne(m);
    if (outcome === 'network') break;
    await removeQueuedMovement(m.id);
    if (outcome === 'ok') synced++;
    else failed++;
  }
  return { synced, failed, pending: await queuedCount() };
}
