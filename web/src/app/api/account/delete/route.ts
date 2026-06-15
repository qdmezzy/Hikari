import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const readFirstEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim()
    if (value) return value
  }
  return ""
}

// Tables to clean up explicitly (in case a FK isn't ON DELETE CASCADE).
const USER_TABLES: Array<[string, string]> = [
  ["list_entries", "user_id"],
  ["reviews", "user_id"],
  ["social_posts", "user_id"],
  ["social_reactions", "user_id"],
  ["social_comments", "user_id"],
  ["social_follows", "follower_id"],
  ["social_follows", "following_id"],
  ["social_poll_votes", "user_id"],
  ["custom_list_items", "user_id"],
  ["custom_lists", "user_id"],
  ["public_profiles", "user_id"],
  ["discord_links", "hikari_user_id"],
  ["fandom_clips", "user_id"],
]

export async function POST(req: Request) {
  const url = readFirstEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
  const anonKey = readFirstEnv("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const serviceRoleKey = readFirstEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY")
  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Server not configured for account deletion." }, { status: 500 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const accessToken = String(body?.access_token || "").trim()
    if (!accessToken) return NextResponse.json({ error: "Missing access token." }, { status: 401 })

    // Verify the requester owns the account they're deleting.
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken)
    if (authError || !authData?.user?.id) {
      return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 })
    }
    const userId = authData.user.id

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

    // Best-effort row cleanup (ignore missing tables / already-cascaded rows).
    for (const [table, column] of USER_TABLES) {
      try {
        await admin.from(table).delete().eq(column, userId)
      } catch {
        /* ignore */
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message || "Failed to delete account." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: String(error || "Failed to delete account.") }, { status: 500 })
  }
}
