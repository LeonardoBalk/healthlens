import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'

const supabaseUrl = __SUPABASE_URL__
const supabaseAnonKey = __SUPABASE_ANON_KEY__

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null

export const getSupabaseAccessToken = async (): Promise<string | null> => {
  if (!supabase) return null

  const { data, error } = await supabase.auth.getSession()
  if (error) return null

  const session: Session | null = data.session ?? null
  return session?.access_token ?? null
}
