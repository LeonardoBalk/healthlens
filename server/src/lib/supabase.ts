import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
