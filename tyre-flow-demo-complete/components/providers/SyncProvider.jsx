/**
 * SyncProvider - Offline Data Sync Context
 * Manages background sync and offline queue
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

const SyncContext = createContext(null);

export default function SyncProvider({ children }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);

  useEffect(() => {
    // Initialize sync monitoring
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_START') {
          setIsSyncing(true);
        } else if (event.data.type === 'SYNC_COMPLETE') {
          setIsSyncing(false);
          setLastSyncTime(new Date());
          setPendingCount(0);
        } else if (event.data.type === 'SYNC_ERROR') {
          setSyncError(event.data.error);
        }
      });

      // Request Background Sync registration
      if ('SyncManager' in window) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.sync.register('sync-stock-movements').catch((err) => {
            console.log('Background Sync not available:', err);
          });
          registration.sync.register('sync-stock-take').catch((err) => {
            console.log('Background Sync not available:', err);
          });
        });
      }
    }

    // Check for pending items in IndexedDB
    const checkPending = async () => {
      if ('indexedDB' in window) {
        try {
          const request = indexedDB.open('warehouse-ims-db');
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(['pending_stock_movements'], 'readonly');
            const store = tx.objectStore('pending_stock_movements');
            const countRequest = store.count();
            countRequest.onsuccess = () => {
              setPendingCount(countRequest.result);
            };
          };
        } catch (error) {
          console.error('Error checking pending items:', error);
        }
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const triggerSync = async () => {
    try {
      setSyncError(null);
      setIsSyncing(true);

      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-stock-movements');
        await registration.sync.register('sync-stock-take');
      }
    } catch (error) {
      setSyncError(error.message);
      setIsSyncing(false);
    }
  };

  const value = {
    isSyncing,
    pendingCount,
    lastSyncTime,
    syncError,
    triggerSync,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
