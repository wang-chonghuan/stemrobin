import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client. StemRobin shares HouseRobin's database but every
// query is confined to the dedicated `stemrobin` schema (no Clerk, no RLS-by-user
// this stage — lesson content is public, learner progress is keyed by a plain id).
//
// NOTE: the target schema must be listed in Supabase → Settings → API →
// "Exposed schemas" for the REST client to reach it.
export function createStemSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  const schema = process.env.SUPABASE_DB_SCHEMA ?? 'stemrobin'
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY')
  }
  return createClient(url, key, {
    db: { schema },
    auth: { persistSession: false },
  })
}
