import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const readFirstEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim()
    if (value) return value
  }
  return ""
}

export async function POST(req: Request) {
  try {
    const url = readFirstEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    const anonKey = readFirstEnv("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY")
    const serviceKey = readFirstEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY")
    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: "Push not configured" }, { status: 500 })
    }

    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: userData, error: userError } = await anon.auth.getUser(token)
    const userId = userData?.user?.id
    if (userError || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const sub = body?.subscription
    const endpoint = String(sub?.endpoint || "")
    const p256dh = String(sub?.keys?.p256dh || "")
    const authKey = String(sub?.keys?.auth || "")
    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await admin
      .from("push_subscriptions")
      .upsert(
        { user_id: userId, endpoint, p256dh, auth: authKey },
        { onConflict: "endpoint" },
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
