import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import type { Database } from './database.types'

// Load environment variables early so this module can be imported at top-level
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL ?? ''
// Prefer the Service Role key on the server for trusted operations.
// Accept legacy env name `SERVICE_ROLE_KEY` as fallback for local setups.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  ''

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'SUPABASE env not fully set; some runtime operations may fail (expected in lint/test environments)'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
