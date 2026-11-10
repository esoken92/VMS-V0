/**
 * lib/scan/rate-limit — in-memory sliding-window limiter for manual
 * (typed-in) scan entries. Manual entry is the easy abuse channel (no
 * hardware involved), so it gets a hard cap: MANUAL_LIMIT per
 * MANUAL_WINDOW_MS per user. Camera/HID/RFID scans are not capped here —
 * physical throughput is already bounded by the device.
 *
 * Caveat: the window lives in process memory, so the limit is per
 * Next.js server instance and resets on deploy — acceptable for v0
 * (single-process). For multi-instance deployments swap this for a
 * Postgres advisory lock or a scan_events count query.
 */

const MANUAL_LIMIT = 30;
const MANUAL_WINDOW_MS = 60_000;

interface Window {
  /** Timestamps (ms) of recent accepted manual scans. */
  hits: number[];
}

const windows = new Map<string, Window>();
// Prevent unbounded growth across long uptimes.
const MAX_KEYS = 5000;

/** True when the user may perform another manual scan right now. */
export function allowManualScan(userId: string, now = Date.now()): boolean {
  if (windows.size >= MAX_KEYS && !windows.has(userId)) {
    windows.clear(); // crude reset beats an unbounded map
  }
  const w = windows.get(userId) ?? { hits: [] };
  w.hits = w.hits.filter((t) => now - t < MANUAL_WINDOW_MS);
  if (w.hits.length >= MANUAL_LIMIT) {
    windows.set(userId, w);
    return false;
  }
  w.hits.push(now);
  windows.set(userId, w);
  return true;
}

/** Remaining manual scans in the current window (for UI hints). */
export function manualScansRemaining(userId: string, now = Date.now()): number {
  const w = windows.get(userId);
  if (!w) return MANUAL_LIMIT;
  const fresh = w.hits.filter((t) => now - t < MANUAL_WINDOW_MS).length;
  return Math.max(0, MANUAL_LIMIT - fresh);
}
