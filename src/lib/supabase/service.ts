import { createClient } from '@supabase/supabase-js'

// Server-only: never import this file from a 'use client' component.
// Bypasses RLS — used for comercio-facing queries, which have no Supabase Auth
// session to carry (comercios authenticate via a plain cookie, not Supabase Auth).
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
