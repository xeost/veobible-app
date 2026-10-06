import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    return createClient(supabaseUrl, supabaseAnonKey)
  }
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return _client
}
