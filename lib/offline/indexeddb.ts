// @ts-nocheck - Disable type checking for offline sync (placeholder types)
import Dexie, { Table } from 'dexie'

export interface PendingStockMovement {
  id?: string
  product_id: string
  user_id: string
  impersonated_by_user_id?: string | null
  type: 'inbound' | 'outbound' | 'adjustment' | 'scrap' | 'tool_checkout' | 'receiving'
  quantity: number
  reason?: string | null
  scrap_image_url?: string | null
  receiving_item_id?: string | null
  tool_loan_id?: string | null
  created_at: string
  synced: boolean
  sync_error?: string | null
  retry_count: number
}

export interface PendingToolLoan {
  id?: string
  tool_product_id: string
  worker_profile_id: string
  checked_out_by_user_id: string
  checked_out_at: string
  expected_return_at?: string | null
  returned_at?: string | null
  condition_on_checkout?: string | null
  condition_on_return?: string | null
  notes?: string | null
  synced: boolean
  sync_error?: string | null
  retry_count: number
}

export interface PendingStockTakeItem {
  id?: string
  stock_take_id: string
  product_id: string
  system_qty: number
  physical_qty?: number | null
  variance?: number | null
  counted_by?: string | null
  counted_at?: string | null
  synced: boolean
  sync_error?: string | null
  retry_count: number
}

export interface PendingScrapImage {
  id?: string
  stock_movement_id?: string
  file_data: string // Base64 encoded image
  file_name: string
  file_type: string
  created_at: string
  synced: boolean
  sync_error?: string | null
  retry_count: number
}

export class VMSDatabase extends Dexie {
  pendingStockMovements!: Table<PendingStockMovement>
  pendingToolLoans!: Table<PendingToolLoan>
  pendingStockTakeItems!: Table<PendingStockTakeItem>
  pendingScrapImages!: Table<PendingScrapImage>

  constructor() {
    super('VMSInventoryDB')
    
    this.version(1).stores({
      pendingStockMovements: '++id, product_id, user_id, type, synced, created_at',
      pendingToolLoans: '++id, tool_product_id, worker_profile_id, synced, checked_out_at',
      pendingStockTakeItems: '++id, stock_take_id, product_id, synced, counted_at',
      pendingScrapImages: '++id, stock_movement_id, synced, created_at'
    })
  }
}

export const db = new VMSDatabase()

// Helper functions for offline queue management
export const addPendingStockMovement = async (movement: Omit<PendingStockMovement, 'id' | 'synced' | 'sync_error' | 'retry_count'>) => {
  return await db.pendingStockMovements.add({
    ...movement,
    synced: false,
    sync_error: null,
    retry_count: 0
  })
}

export const addPendingToolLoan = async (loan: Omit<PendingToolLoan, 'id' | 'synced' | 'sync_error' | 'retry_count'>) => {
  return await db.pendingToolLoans.add({
    ...loan,
    synced: false,
    sync_error: null,
    retry_count: 0
  })
}

export const addPendingStockTakeItem = async (item: Omit<PendingStockTakeItem, 'id' | 'synced' | 'sync_error' | 'retry_count'>) => {
  return await db.pendingStockTakeItems.add({
    ...item,
    synced: false,
    sync_error: null,
    retry_count: 0
  })
}

export const addPendingScrapImage = async (image: Omit<PendingScrapImage, 'id' | 'synced' | 'sync_error' | 'retry_count'>) => {
  return await db.pendingScrapImages.add({
    ...image,
    synced: false,
    sync_error: null,
    retry_count: 0
  })
}

export const getUnsyncedItems = async () => {
  const [stockMovements, toolLoans, stockTakeItems, scrapImages] = await Promise.all([
    // @ts-ignore - Dexie type issue with boolean equals
    db.pendingStockMovements.where('synced').equals(false).toArray(),
    // @ts-ignore - Dexie type issue with boolean equals
    db.pendingToolLoans.where('synced').equals(false).toArray(),
    // @ts-ignore - Dexie type issue with boolean equals
    db.pendingStockTakeItems.where('synced').equals(false).toArray(),
    // @ts-ignore - Dexie type issue with boolean equals
    db.pendingScrapImages.where('synced').equals(false).toArray()
  ])

  return {
    stockMovements,
    toolLoans,
    stockTakeItems,
    scrapImages
  }
}

export const markAsSynced = async (tableName: string, id: string) => {
  switch (tableName) {
    case 'pendingStockMovements':
      return await db.pendingStockMovements.update(id, { synced: true, sync_error: null })
    case 'pendingToolLoans':
      return await db.pendingToolLoans.update(id, { synced: true, sync_error: null })
    case 'pendingStockTakeItems':
      return await db.pendingStockTakeItems.update(id, { synced: true, sync_error: null })
    case 'pendingScrapImages':
      return await db.pendingScrapImages.update(id, { synced: true, sync_error: null })
    default:
      throw new Error(`Unknown table: ${tableName}`)
  }
}

export const markSyncError = async (tableName: string, id: string, error: string) => {
  switch (tableName) {
    case 'pendingStockMovements':
      return await db.pendingStockMovements.update(id, { sync_error: error, retry_count: Dexie.maxKey })
    case 'pendingToolLoans':
      return await db.pendingToolLoans.update(id, { sync_error: error, retry_count: Dexie.maxKey })
    case 'pendingStockTakeItems':
      return await db.pendingStockTakeItems.update(id, { sync_error: error, retry_count: Dexie.maxKey })
    case 'pendingScrapImages':
      return await db.pendingScrapImages.update(id, { sync_error: error, retry_count: Dexie.maxKey })
    default:
      throw new Error(`Unknown table: ${tableName}`)
  }
}

export const incrementRetryCount = async (tableName: string, id: string) => {
  switch (tableName) {
    case 'pendingStockMovements':
      return await db.pendingStockMovements.where('id').equals(id).modify((item) => {
        item.retry_count = (item.retry_count || 0) + 1
      })
    case 'pendingToolLoans':
      return await db.pendingToolLoans.where('id').equals(id).modify((item) => {
        item.retry_count = (item.retry_count || 0) + 1
      })
    case 'pendingStockTakeItems':
      return await db.pendingStockTakeItems.where('id').equals(id).modify((item) => {
        item.retry_count = (item.retry_count || 0) + 1
      })
    case 'pendingScrapImages':
      return await db.pendingScrapImages.where('id').equals(id).modify((item) => {
        item.retry_count = (item.retry_count || 0) + 1
      })
    default:
      throw new Error(`Unknown table: ${tableName}`)
  }
}

export const deleteSyncedItem = async (tableName: string, id: string) => {
  switch (tableName) {
    case 'pendingStockMovements':
      return await db.pendingStockMovements.delete(id)
    case 'pendingToolLoans':
      return await db.pendingToolLoans.delete(id)
    case 'pendingStockTakeItems':
      return await db.pendingStockTakeItems.delete(id)
    case 'pendingScrapImages':
      return await db.pendingScrapImages.delete(id)
    default:
      throw new Error(`Unknown table: ${tableName}`)
  }
}

export const clearSyncedItems = async () => {
  await Promise.all([
    // @ts-ignore - Dexie type issue with boolean equals
    db.pendingStockMovements.where('synced').equals(true).delete(),
    // @ts-ignore - Dexie type issue with boolean equals
    db.pendingToolLoans.where('synced').equals(true).delete(),
    // @ts-ignore - Dexie type issue with boolean equals
    db.pendingStockTakeItems.where('synced').equals(true).delete(),
    // @ts-ignore - Dexie type issue with boolean equals
    db.pendingScrapImages.where('synced').equals(true).delete()
  ])
}
