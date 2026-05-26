// @ts-nocheck - Disable type checking for offline sync (placeholder types)
import { getUnsyncedItems, markAsSynced, markSyncError, incrementRetryCount, deleteSyncedItem } from './indexeddb'
import { createClient } from '../supabase/client'

const MAX_RETRY_COUNT = 3
const SYNC_BATCH_SIZE = 10

export const syncOfflineQueue = async () => {
  const supabase = createClient()
  const unsyncedItems = await getUnsyncedItems()

  let successCount = 0
  let errorCount = 0

  // Sync stock movements
  for (const movement of unsyncedItems.stockMovements.slice(0, SYNC_BATCH_SIZE)) {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        // @ts-ignore - Supabase types are placeholders
        .insert({
          product_id: movement.product_id,
          user_id: movement.user_id,
          impersonated_by_user_id: movement.impersonated_by_user_id,
          type: movement.type,
          quantity: movement.quantity,
          reason: movement.reason,
          scrap_image_url: movement.scrap_image_url,
          receiving_item_id: movement.receiving_item_id,
          tool_loan_id: movement.tool_loan_id,
          created_at: movement.created_at
        })

      if (error) throw error

      await markAsSynced('pendingStockMovements', movement.id!)
      await deleteSyncedItem('pendingStockMovements', movement.id!)
      successCount++
    } catch (error) {
      console.error('Failed to sync stock movement:', error)
      await incrementRetryCount('pendingStockMovements', movement.id!)
      
      if ((movement.retry_count || 0) >= MAX_RETRY_COUNT) {
        await markSyncError('pendingStockMovements', movement.id!, String(error))
      }
      errorCount++
    }
  }

  // Sync tool loans
  for (const loan of unsyncedItems.toolLoans.slice(0, SYNC_BATCH_SIZE)) {
    try {
      const { data, error } = await supabase
        .from('tool_loans')
        .insert({
          tool_product_id: loan.tool_product_id,
          worker_profile_id: loan.worker_profile_id,
          checked_out_by_user_id: loan.checked_out_by_user_id,
          checked_out_at: loan.checked_out_at,
          expected_return_at: loan.expected_return_at,
          returned_at: loan.returned_at,
          condition_on_checkout: loan.condition_on_checkout,
          condition_on_return: loan.condition_on_return,
          notes: loan.notes
        })

      if (error) throw error

      await markAsSynced('pendingToolLoans', loan.id!)
      await deleteSyncedItem('pendingToolLoans', loan.id!)
      successCount++
    } catch (error) {
      console.error('Failed to sync tool loan:', error)
      await incrementRetryCount('pendingToolLoans', loan.id!)
      
      if ((loan.retry_count || 0) >= MAX_RETRY_COUNT) {
        await markSyncError('pendingToolLoans', loan.id!, String(error))
      }
      errorCount++
    }
  }

  // Sync stock take items
  for (const item of unsyncedItems.stockTakeItems.slice(0, SYNC_BATCH_SIZE)) {
    try {
      const { data, error } = await supabase
        .from('stock_take_items')
        .insert({
          stock_take_id: item.stock_take_id,
          product_id: item.product_id,
          system_qty: item.system_qty,
          physical_qty: item.physical_qty,
          variance: item.variance,
          counted_by: item.counted_by,
          counted_at: item.counted_at
        })

      if (error) throw error

      await markAsSynced('pendingStockTakeItems', item.id!)
      await deleteSyncedItem('pendingStockTakeItems', item.id!)
      successCount++
    } catch (error) {
      console.error('Failed to sync stock take item:', error)
      await incrementRetryCount('pendingStockTakeItems', item.id!)
      
      if ((item.retry_count || 0) >= MAX_RETRY_COUNT) {
        await markSyncError('pendingStockTakeItems', item.id!, String(error))
      }
      errorCount++
    }
  }

  // Sync scrap images
  for (const image of unsyncedItems.scrapImages.slice(0, SYNC_BATCH_SIZE)) {
    try {
      // Upload image to Supabase Storage
      const fileName = `${image.stock_movement_id}/${image.file_name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('scrap-images')
        .upload(fileName, base64ToBlob(image.file_data, image.file_type), {
          upsert: true
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('scrap-images')
        .getPublicUrl(fileName)

      // Update stock movement with image URL if associated
      if (image.stock_movement_id) {
        await supabase
          .from('stock_movements')
          .update({ scrap_image_url: urlData.publicUrl })
          .eq('id', image.stock_movement_id)
      }

      await markAsSynced('pendingScrapImages', image.id!)
      await deleteSyncedItem('pendingScrapImages', image.id!)
      successCount++
    } catch (error) {
      console.error('Failed to sync scrap image:', error)
      await incrementRetryCount('pendingScrapImages', image.id!)
      
      if ((image.retry_count || 0) >= MAX_RETRY_COUNT) {
        await markSyncError('pendingScrapImages', image.id!, String(error))
      }
      errorCount++
    }
  }

  return { successCount, errorCount }
}

// Helper function to convert base64 to blob
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64)
  const byteArrays = []
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512)
    const byteNumbers = new Array(slice.length)
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }
    
    const byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
  }
  
  return new Blob(byteArrays, { type: mimeType })
}

// Register service worker for background sync
export const registerBackgroundSync = () => {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.sync.register('sync-offline-queue')
    })
  }
}

// Manual sync trigger (for when online)
export const triggerSync = async () => {
  if (navigator.onLine) {
    const result = await syncOfflineQueue()
    return result
  }
  return { successCount: 0, errorCount: 0 }
}

// Listen for online events to trigger sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    triggerSync()
  })
}
