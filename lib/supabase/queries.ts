import { Database } from './types'

type Tables = Database['public']['Tables']

// Product queries
export const getProducts = async (supabase: any, filters?: {
  item_type?: Tables['products']['Row']['item_type']
  supplier_id?: string
  low_stock?: boolean
}) => {
  let query = supabase
    .from('products')
    .select(`
      *,
      supplier:suppliers(name),
      bin_location:bin_locations(zone, bin_location)
    `)

  if (filters?.item_type) {
    query = query.eq('item_type', filters.item_type)
  }

  if (filters?.supplier_id) {
    query = query.eq('supplier_id', filters.supplier_id)
  }

  if (filters?.low_stock) {
    query = query.lte('current_stock', supabase.raw('min_threshold'))
  }

  const { data, error } = await query
  return { data, error }
}

export const getProductBySKU = async (supabase: any, sku: string) => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      supplier:suppliers(name),
      bin_location:bin_locations(zone, bin_location)
    `)
    .eq('sku', sku)
    .single()

  return { data, error }
}

// Stock movement queries
export const createStockMovement = async (
  supabase: any,
  movement: Omit<Tables['stock_movements']['Insert'], 'id' | 'created_at'>
) => {
  const { data, error } = await supabase
    .from('stock_movements')
    .insert(movement)
    .select()
    .single()

  return { data, error }
}

export const getStockMovements = async (
  supabase: any,
  filters?: {
    product_id?: string
    type?: Tables['stock_movements']['Row']['type']
    user_id?: string
    limit?: number
  }
) => {
  let query = supabase
    .from('stock_movements')
    .select(`
      *,
      product:products(sku, name),
      user:profiles(full_name)
    `)
    .order('created_at', { ascending: false })

  if (filters?.product_id) {
    query = query.eq('product_id', filters.product_id)
  }

  if (filters?.type) {
    query = query.eq('type', filters.type)
  }

  if (filters?.user_id) {
    query = query.eq('user_id', filters.user_id)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  return { data, error }
}

// Tool loan queries
export const createToolLoan = async (
  supabase: any,
  loan: Omit<Tables['tool_loans']['Insert'], 'id' | 'checked_out_at'>
) => {
  const { data, error } = await supabase
    .from('tool_loans')
    .insert(loan)
    .select()
    .single()

  return { data, error }
}

export const returnToolLoan = async (
  supabase: any,
  loanId: string,
  conditionOnReturn: string
) => {
  const { data, error } = await supabase
    .from('tool_loans')
    .update({
      returned_at: new Date().toISOString(),
      condition_on_return: conditionOnReturn
    })
    .eq('id', loanId)
    .select()
    .single()

  return { data, error }
}

export const getActiveToolLoans = async (supabase: any) => {
  const { data, error } = await supabase
    .from('tool_loans')
    .select(`
      *,
      tool:products(sku, name),
      worker:profiles(full_name),
      checked_out_by:profiles(full_name)
    `)
    .is('returned_at', null)
    .order('checked_out_at', { ascending: false })

  return { data, error }
}

export const getOverdueToolLoans = async (supabase: any) => {
  const { data, error } = await supabase
    .from('tool_loans')
    .select(`
      *,
      tool:products(sku, name),
      worker:profiles(full_name)
    `)
    .is('returned_at', null)
    .lt('expected_return_at', new Date().toISOString())
    .order('expected_return_at', { ascending: true })

  return { data, error }
}

// Stock take queries
export const createStockTake = async (
  supabase: any,
  stockTake: Omit<Tables['stock_takes']['Insert'], 'id' | 'started_at'>
) => {
  const { data, error } = await supabase
    .from('stock_takes')
    .insert(stockTake)
    .select()
    .single()

  return { data, error }
}

export const completeStockTake = async (supabase: any, stockTakeId: string) => {
  const { data, error } = await supabase
    .from('stock_takes')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', stockTakeId)
    .select()
    .single()

  return { data, error }
}

export const getStockTakeItems = async (supabase: any, stockTakeId: string) => {
  const { data, error } = await supabase
    .from('stock_take_items')
    .select(`
      *,
      product:products(sku, name, current_stock)
    `)
    .eq('stock_take_id', stockTakeId)

  return { data, error }
}

// Receiving document queries
export const createReceivingDocument = async (
  supabase: any,
  document: Omit<Tables['receiving_documents']['Insert'], 'id' | 'created_at'>
) => {
  const { data, error } = await supabase
    .from('receiving_documents')
    .insert(document)
    .select()
    .single()

  return { data, error }
}

export const getReceivingDocuments = async (supabase: any, status?: Tables['receiving_documents']['Row']['status']) => {
  let query = supabase
    .from('receiving_documents')
    .select(`
      *,
      supplier:suppliers(name),
      received_by:profiles(full_name)
    `)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  return { data, error }
}

// Activity log queries
export const getActivityLogs = async (
  supabase: any,
  filters?: {
    user_id?: string
    table_name?: string
    limit?: number
  }
) => {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.user_id) {
    query = query.eq('user_id', filters.user_id)
  }

  if (filters?.table_name) {
    query = query.eq('table_name', filters.table_name)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  return { data, error }
}

// Impersonation helpers
export const setImpersonationContext = async (supabase: any, impersonatedByUserId: string) => {
  const { data, error } = await supabase.rpc('set_impersonation_context', {
    p_impersonated_by: impersonatedByUserId
  })
  return { data, error }
}

export const clearImpersonationContext = async (supabase: any) => {
  const { data, error } = await supabase.rpc('clear_impersonation_context')
  return { data, error }
}
