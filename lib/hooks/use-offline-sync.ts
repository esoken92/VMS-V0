import { useState, useEffect } from 'react'
import { triggerSync, registerBackgroundSync } from '../offline/sync-queue'

interface UseOfflineSyncReturn {
  isOnline: boolean
  isSyncing: boolean
  syncStatus: 'idle' | 'syncing' | 'success' | 'error'
  lastSyncTime: Date | null
  pendingItems: number
  triggerManualSync: () => Promise<void>
}

export const useOfflineSync = (): UseOfflineSyncReturn => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [pendingItems, setPendingItems] = useState(0)

  useEffect(() => {
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true)
      triggerManualSync()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      
      // Register background sync
      registerBackgroundSync()
      
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  const triggerManualSync = async () => {
    if (!isOnline || isSyncing) return

    setIsSyncing(true)
    setSyncStatus('syncing')

    try {
      const result = await triggerSync()
      setLastSyncTime(new Date())
      setSyncStatus(result.successCount > 0 ? 'success' : 'idle')
      setPendingItems(0)
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncStatus('error')
    } finally {
      setIsSyncing(false)
    }
  }

  return {
    isOnline,
    isSyncing,
    syncStatus,
    lastSyncTime,
    pendingItems,
    triggerManualSync
  }
}
