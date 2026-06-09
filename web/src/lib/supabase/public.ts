import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cookie-free Supabase client for public, read-only data.
 *
 * Unlike the SSR client in `server.ts`, this never touches `cookies()`, so it is
 * safe to call inside `unstable_cache` (which forbids dynamic request APIs) and
 * carries no per-request cookie overhead. This app has no auth, so an anon client
 * sees all the data the page needs.
 *
 * A module-level singleton avoids re-instantiating the client on every query.
 */
let client: SupabaseClient | null = null

export function createPublicClient(): SupabaseClient {
  if (!client) {
    client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return client
}
