'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushMovements, queuedCount } from './queue';

/**
 * useOfflineQueue — tracks connectivity + the IDB queue depth, and flushes
 * when the browser comes back online (and once on mount). `isOffline()`
 * uses navigator.onLine — a hint, not a guarantee; flushOne still treats a
 * thrown fetch as 'network' and leaves the row queued.
 */
export function useOfflineQueue() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const flushingRef = useRef(false);
  const [lastFlush, setLastFlush] = useState<{ synced: number; failed: number } | null>(null);

  const refreshPending = useCallback(async () => {
    setPending(await queuedCount());
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const r = await flushMovements();
      if (r.synced || r.failed) setLastFlush(r);
      setPending(r.pending);
    } finally {
      flushingRef.current = false;
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshPending();
    void flush(); // replay anything queued in a previous session
    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flush, refreshPending]);

  return { online, pending, flush, refreshPending, lastFlush, isOffline: () => !navigator.onLine };
}
