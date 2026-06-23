import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import type { Database } from './database.types'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL ?? ''

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
