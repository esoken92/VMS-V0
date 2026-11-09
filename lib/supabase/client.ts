import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from './types'

// Placeholder values keep `next build` prerendering working when env vars
// are not configured yet — real values always win at runtime.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

export const createClient = () => {
  return createClientComponentClient<Database>({ supabaseUrl, supabaseKey })
}

// Singleton instance for client-side use
let supabaseClient: ReturnType<typeof createClientComponentClient<Database>> | null = null

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClientComponentClient<Database>({ supabaseUrl, supabaseKey })
  }
  return supabaseClient
}
