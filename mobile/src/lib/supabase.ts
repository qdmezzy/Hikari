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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Non-fatal: the app still works in "browse-only" mode (AniList catalog)
  // without auth. Tracking features will surface a sign-in prompt instead.
  console.warn(
    "[hikari] Supabase env not set (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY). " +
      "Running in browse-only mode.",
  )
}

export const supabase = createClient(SUPABASE_URL || "https://placeholder.supabase.co", SUPABASE_ANON_KEY || "placeholder", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
})

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
