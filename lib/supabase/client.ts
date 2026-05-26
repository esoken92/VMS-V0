import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from './types'

export const createClient = () => {
  return createClientComponentClient<Database>()
}

// Singleton instance for client-side use
let supabaseClient: ReturnType<typeof createClientComponentClient<Database>> | null = null

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClientComponentClient<Database>()
  }
  return supabaseClient
}
