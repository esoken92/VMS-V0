'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

export default function SyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Check online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Simulate pending changes from IndexedDB
  useEffect(() => {
    const checkPendingChanges = async () => {
      // In a real app, this would check Dexie for pending changes
      const pending = Math.floor(Math.random() * 5);
      setPendingChanges(pending);
    };

    checkPendingChanges();
    const interval = setInterval(checkPendingChanges, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Simulate sync process
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setPendingChanges(0);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline && pendingChanges === 0) {
    return null; // Don't show indicator when online and synced
  }

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-center gap-3 ${
      !isOnline ? 'bg-red-600 text-white' : 'bg-yellow-500 text-white'
    }`}>
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">You are offline</span>
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">{pendingChanges} pending changes</span>
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              'Sync Now'
            )}
          </button>
        </>
      )}
    </div>
  );
}
