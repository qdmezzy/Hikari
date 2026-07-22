import { createHash, randomBytes } from "node:crypto"
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { isFoundingModerator, normalizeFoundingHandle, normalizeFoundingInviteCode } from "@/lib/founding-domain.mjs"

const getConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ""
  return { url, anonKey, serviceRoleKey }
}

export const getFoundingAdmin = (): SupabaseClient => {
  const { url, serviceRoleKey } = getConfig()
  if (!url || !serviceRoleKey) throw new Error("Founding services are not configured.")
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

const readBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization") || ""
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : ""
}

export const authenticateFoundingRequest = async (request: Request) => {
  const accessToken = readBearerToken(request)
  const { url, anonKey } = getConfig()
  if (!accessToken || !url || !anonKey) return { user: null, accessToken: "", client: null }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const { data, error } = await client.auth.getUser(accessToken)
  return { user: error ? null : data.user, accessToken, client }
}

export const requireFoundingModerator = async (request: Request) => {
  const auth = await authenticateFoundingRequest(request)
  return { ...auth, isModerator: Boolean(auth.user && isFoundingModerator(auth.user)) }
}

export const createFoundingInviteCode = () => randomBytes(32).toString("base64url")

export const hashFoundingInviteCode = (value: unknown) => {
  const code = normalizeFoundingInviteCode(value)
  return code ? createHash("sha256").update(code, "utf8").digest("hex") : ""
}

export const getFoundingJoinUrl = (request: Request, code: string) => {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
  const origin = configured || new URL(request.url).origin
  return `${origin}/founding/join#code=${encodeURIComponent(code)}`
}

export const sanitizeFoundingHandle = (value: unknown) => normalizeFoundingHandle(value)

export const safeFounderProfile = (profile: Record<string, any> | null | undefined) => {
  if (!profile) return null

  const handle = profile.handle || ""
  const publicProfile = profile.public_profile !== false
  return {
    displayName: publicProfile ? profile.display_name || handle || "Hikari Founder" : handle || "Hikari member",
    handle,
    avatarUrl: publicProfile ? profile.avatar_url || null : null,
    publicProfile,
  }
}

export const userIsModerator = (user: User | null | undefined) => isFoundingModerator(user)

export const isMissingFoundingSchema = (error: any) => {
  const code = String(error?.code || "")
  const text = `${error?.message || ""} ${error?.details || ""}`.toLowerCase()
  return ["42P01", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(code) || text.includes("founding_")
}
