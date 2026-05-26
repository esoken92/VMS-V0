// @ts-nocheck - Disable type checking for offline sync (placeholder types)
import { db } from './indexeddb'
import { createClient } from '../supabase/client'

export interface ConflictResolution {
  localId: string
  tableName: string
  localData: any
  serverData: any
  resolution: 'local' | 'server' | 'manual'
  resolvedAt: string
}

// Detect conflicts between local offline data and server data
export const detectConflicts = async (tableName: string, recordId: string) => {
  const supabase = createClient()
  
  try {
    // Get local data from IndexedDB
    let localData
    switch (tableName) {
      case 'pendingStockMovements':
        localData = await db.pendingStockMovements.get(recordId)
        break
      case 'pendingToolLoans':
        localData = await db.pendingToolLoans.get(recordId)
        break
      case 'pendingStockTakeItems':
        localData = await db.pendingStockTakeItems.get(recordId)
        break
      default:
        throw new Error(`Unknown table: ${tableName}`)
    }

    if (!localData) {
      return { hasConflict: false, localData: null, serverData: null }
    }

    // Get server data
    let serverData
    if (tableName === 'pendingStockMovements') {
      const { data } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', localData.product_id)
        .eq('created_at', localData.created_at)
        .single()
      serverData = data
    } else if (tableName === 'pendingToolLoans') {
      const { data } = await supabase
        .from('tool_loans')
        .select('*')
        .eq('tool_product_id', localData.tool_product_id)
        .eq('checked_out_at', localData.checked_out_at)
        .single()
      serverData = data
    } else if (tableName === 'pendingStockTakeItems') {
      const { data } = await supabase
        .from('stock_take_items')
        .select('*')
        .eq('stock_take_id', localData.stock_take_id)
        .eq('product_id', localData.product_id)
        .single()
      serverData = data
    }

    // If server data exists, we have a potential conflict
    if (serverData) {
      return { hasConflict: true, localData, serverData }
    }

    return { hasConflict: false, localData, serverData: null }
  } catch (error) {
    console.error('Error detecting conflicts:', error)
    return { hasConflict: false, localData: null, serverData: null, error }
  }
}

// Resolve conflict by choosing server data (default for most cases)
export const resolveConflictServerWins = async (tableName: string, recordId: string) => {
  try {
    // Delete local record since server wins
    switch (tableName) {
      case 'pendingStockMovements':
        await db.pendingStockMovements.delete(recordId)
        break
      case 'pendingToolLoans':
        await db.pendingToolLoans.delete(recordId)
        break
      case 'pendingStockTakeItems':
        await db.pendingStockTakeItems.delete(recordId)
        break
      default:
        throw new Error(`Unknown table: ${tableName}`)
    }

    return { success: true, resolution: 'server' }
  } catch (error) {
    console.error('Error resolving conflict (server wins):', error)
    return { success: false, error }
  }
}

// Resolve conflict by choosing local data (rare, use with caution)
export const resolveConflictLocalWins = async (tableName: string, recordId: string) => {
  const supabase = createClient()
  
  try {
    let localData
    switch (tableName) {
      case 'pendingStockMovements':
        localData = await db.pendingStockMovements.get(recordId)
        if (localData) {
          const { error } = await supabase
            .from('stock_movements')
            .insert({
              product_id: localData.product_id,
              user_id: localData.user_id,
              impersonated_by_user_id: localData.impersonated_by_user_id,
              type: localData.type,
              quantity: localData.quantity,
              reason: localData.reason,
              scrap_image_url: localData.scrap_image_url,
              receiving_item_id: localData.receiving_item_id,
              tool_loan_id: localData.tool_loan_id,
              created_at: localData.created_at
            })
          
          if (error) throw error
          await db.pendingStockMovements.delete(recordId)
        }
        break
      case 'pendingToolLoans':
        localData = await db.pendingToolLoans.get(recordId)
        if (localData) {
          const { error } = await supabase
            .from('tool_loans')
            .insert({
              tool_product_id: localData.tool_product_id,
              worker_profile_id: localData.worker_profile_id,
              checked_out_by_user_id: localData.checked_out_by_user_id,
              checked_out_at: localData.checked_out_at,
              expected_return_at: localData.expected_return_at,
              returned_at: localData.returned_at,
              condition_on_checkout: localData.condition_on_checkout,
              condition_on_return: localData.condition_on_return,
              notes: localData.notes
            })
          
          if (error) throw error
          await db.pendingToolLoans.delete(recordId)
        }
        break
      case 'pendingStockTakeItems':
        localData = await db.pendingStockTakeItems.get(recordId)
        if (localData) {
          const { error } = await supabase
            .from('stock_take_items')
            .insert({
              stock_take_id: localData.stock_take_id,
              product_id: localData.product_id,
              system_qty: localData.system_qty,
              physical_qty: localData.physical_qty,
              variance: localData.variance,
              counted_by: localData.counted_by,
              counted_at: localData.counted_at
            })
          
          if (error) throw error
          await db.pendingStockTakeItems.delete(recordId)
        }
        break
      default:
        throw new Error(`Unknown table: ${tableName}`)
    }

    return { success: true, resolution: 'local' }
  } catch (error) {
    console.error('Error resolving conflict (local wins):', error)
    return { success: false, error }
  }
}

// Calculate variance percentage for automatic resolution
export const calculateVariancePercentage = (localValue: number, serverValue: number): number => {
  if (serverValue === 0) return localValue > 0 ? 100 : 0
  return Math.abs((localValue - serverValue) / serverValue) * 100
}

// Automatic conflict resolution based on variance threshold
export const autoResolveConflict = async (
  tableName: string,
  recordId: string,
  varianceThreshold: number = 5
) => {
  const { hasConflict, localData, serverData } = await detectConflicts(tableName, recordId)

  if (!hasConflict || !localData || !serverData) {
    return { hasConflict: false, resolution: null }
  }

  // For quantity-based conflicts, calculate variance
  if (localData.quantity !== undefined && serverData.quantity !== undefined) {
    const variancePercent = calculateVariancePercentage(localData.quantity, serverData.quantity)
    
    // If variance is within threshold, server wins
    if (variancePercent <= varianceThreshold) {
      return await resolveConflictServerWins(tableName, recordId)
    }
    
    // If variance exceeds threshold, requires manual review
    return { 
      hasConflict: true, 
      requiresManualReview: true, 
      variancePercent,
      localData, 
      serverData 
    }
  }

  // For non-quantity conflicts, default to server wins
  return await resolveConflictServerWins(tableName, recordId)
}

// Get all conflicts requiring manual review
export const getConflictsRequiringManualReview = async () => {
  const conflicts = []
  
  // Check all unsynced items for conflicts
  const [stockMovements, toolLoans, stockTakeItems] = await Promise.all([
    db.pendingStockMovements.where('synced').equals(false).toArray(),
    db.pendingToolLoans.where('synced').equals(false).toArray(),
    db.pendingStockTakeItems.where('synced').equals(false).toArray()
  ])

  for (const movement of stockMovements) {
    const { hasConflict, requiresManualReview, variancePercent, localData, serverData } = 
      await autoResolveConflict('pendingStockMovements', movement.id!)
    
    if (hasConflict && requiresManualReview) {
      conflicts.push({
        tableName: 'pendingStockMovements',
        recordId: movement.id,
        localData,
        serverData,
        variancePercent
      })
    }
  }

  for (const loan of toolLoans) {
    const { hasConflict, localData, serverData } = 
      await detectConflicts('pendingToolLoans', loan.id!)
    
    if (hasConflict) {
      conflicts.push({
        tableName: 'pendingToolLoans',
        recordId: loan.id,
        localData,
        serverData
      })
    }
  }

  for (const item of stockTakeItems) {
    const { hasConflict, requiresManualReview, variancePercent, localData, serverData } = 
      await autoResolveConflict('pendingStockTakeItems', item.id!)
    
    if (hasConflict && requiresManualReview) {
      conflicts.push({
        tableName: 'pendingStockTakeItems',
        recordId: item.id,
        localData,
        serverData,
        variancePercent
      })
    }
  }

  return conflicts
}
