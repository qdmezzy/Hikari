import { createClient } from "@supabase/supabase-js"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"

/**
 * Supabase client for the mobile app.
 *
 * Mirrors the web's `web/src/lib/client.js` — same project, same anon key,
 * same `list_entries` / `profiles` / etc. tables. Auth state is persisted to
 * AsyncStorage (web uses localStorage via the supabase-js default).
 *
 * Configure via app.config extra or a .env file (expo-constants reads these).
 */

// Hardcoded fallbacks (same pattern as the browser extension): the anon key is
// public by design — RLS protects the data — and baking it in means a missing
// .env can never silently put the app in a broken browse-only state again.
const FALLBACK_URL = "https://xznthkyqqvnlwbvkjebo.supabase.co"
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6bnRoa3lxcXZubHdidmtqZWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDU0MzUsImV4cCI6MjA4MzcyMTQzNX0.ggPi9x-X6h4im7T7wDPDpFZikE18rDWg3I-vucE3IU4"

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || FALLBACK_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
})

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
