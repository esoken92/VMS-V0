/**
 * Normalize `db.execute()` results across drivers.
 * postgres.js returns row arrays; the PGlite socket path returns `{ rows }`.
 */
export function executeRows<T>(res: unknown): T[] {
  return Array.isArray(res)
    ? (res as T[])
    : ((res as { rows?: T[] })?.rows ?? []);
}
