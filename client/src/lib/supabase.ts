import { createClient } from '@supabase/supabase-js'

const supabaseUrl = __SUPABASE_URL__
const supabaseAnonKey = __SUPABASE_ANON_KEY__

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null
