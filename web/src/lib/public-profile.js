import client from "@/lib/client"

export const normalizeHandle = (value) =>
  String(value || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "")

const pickDisplayName = (user) =>
  user?.user_metadata?.display_name ||
  user?.user_metadata?.full_name ||
  user?.user_metadata?.username ||
  user?.user_metadata?.handle ||
  "User"

const pickAvatar = (user) => user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || null

const pickBanner = (user) => user?.user_metadata?.banner_url || null

const pickBio = (user) => user?.user_metadata?.bio || null

const pickLocation = (user) => user?.user_metadata?.location || null

const pickWebsite = (user) => user?.user_metadata?.website || null

const pickJoinedAt = (user) =>
  user?.user_metadata?.joined_at ||
  user?.user_metadata?.joined_date ||
  user?.user_metadata?.member_since ||
  user?.created_at ||
  null

const pickHandle = (user) =>
  normalizeHandle(
      user?.user_metadata?.username ||
      user?.user_metadata?.handle ||
      (user?.id ? `user${String(user.id).replace(/-/g, "").slice(0, 8)}` : "user"),
  )

const pickFavoriteMediaIds = (user) => {
  const ids = user?.user_metadata?.favorite_media_ids
  if (!Array.isArray(ids)) return []
  return Array.from(new Set(ids.map((id) => Number(id)).filter(Number.isFinite)))
}

const getErrorText = (error) => {
  if (!error) return ""
  const message = typeof error?.message === "string" ? error.message : ""
  const details = typeof error?.details === "string" ? error.details : ""
  const hint = typeof error?.hint === "string" ? error.hint : ""
  return `${message} ${details} ${hint}`.toLowerCase()
}

const isMissingPublicProfileSchema = (error) => {
  const code = String(error?.code || "")
  const text = getErrorText(error)
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    (text.includes("public_profiles") && text.includes("does not exist")) ||
    text.includes("hide_from_profile")
  )
}

const isMissingJoinedAtColumn = (error) => {
  const code = String(error?.code || "")
  const text = getErrorText(error)
  return code === "42703" || code === "PGRST204" || text.includes("joined_at")
}

const isMissingFavoritesColumn = (error) => {
  const code = String(error?.code || "")
  const text = getErrorText(error)
  return (
    code === "42703" ||
    code === "PGRST204" ||
    text.includes("favorite_media_ids") ||
    text.includes("show_favorites")
  )
}

const isMissingPrivacyColumn = (error) => {
  const code = String(error?.code || "")
  const text = getErrorText(error)
  return code === "42703" || code === "PGRST204" || text.includes("public_profile") || text.includes("show_stats")
}

const isHandleUniqueViolation = (error) => {
  const code = String(error?.code || "")
  const text = getErrorText(error)
  return (
    code === "23505" ||
    (text.includes("duplicate") && text.includes("handle")) ||
    (text.includes("already exists") && text.includes("handle"))
  )
}

const createHandleTakenError = (handle) => {
  const error = new Error(`@${handle} is already taken.`)
  error.code = "HANDLE_TAKEN"
  return error
}

export const isHandleTakenError = (error) => {
  return String(error?.code || "") === "HANDLE_TAKEN" || isHandleUniqueViolation(error)
}

export const buildPublicProfilePayload = (user, overrides = {}) => {
  if (!user?.id) return null
  return {
    user_id: user.id,
    handle: normalizeHandle(overrides.handle ?? pickHandle(user)),
    display_name: overrides.display_name ?? pickDisplayName(user),
    avatar_url: overrides.avatar_url ?? pickAvatar(user),
    banner_url: overrides.banner_url ?? pickBanner(user),
    bio: overrides.bio ?? pickBio(user),
    location: overrides.location ?? pickLocation(user),
    website: overrides.website ?? pickWebsite(user),
    joined_at: overrides.joined_at ?? pickJoinedAt(user),
    show_online_status: overrides.show_online_status ?? (user?.user_metadata?.show_online_status ?? true),
    show_watch_activity: overrides.show_watch_activity ?? (user?.user_metadata?.show_watch_activity ?? true),
    public_profile: overrides.public_profile ?? (user?.user_metadata?.public_profile ?? true),
    show_stats: overrides.show_stats ?? (user?.user_metadata?.show_stats ?? true),
  }
}

/**
 * Best-effort sync of the user's favorites to their public profile row so they
 * appear on the shared /u/[handle] page. Never throws and never affects the
 * core profile upsert (so profile sharing / the View button can't break if the
 * favorite_media_ids / show_favorites columns aren't migrated yet).
 */
export const syncPublicFavorites = async (user) => {
  try {
    if (!user?.id) return
    const { error } = await client
      .from("public_profiles")
      .update({
        favorite_media_ids: pickFavoriteMediaIds(user),
        show_favorites: user?.user_metadata?.show_favorites ?? true,
      })
      .eq("user_id", user.id)
    // Missing columns / missing row are non-fatal — favorites just won't sync yet.
    if (error) return
  } catch {
    /* swallow */
  }
}

export const upsertPublicProfile = async (user, overrides = {}) => {
  const payload = buildPublicProfilePayload(user, overrides)
  if (!payload?.user_id || !payload.handle) {
    return { data: null, error: new Error("Missing profile identity.") }
  }

  let { data, error } = await client
    .from("public_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single()

  if (error && isMissingFavoritesColumn(error)) {
    const { favorite_media_ids, show_favorites, ...legacyPayload } = payload
    ;({ data, error } = await client
      .from("public_profiles")
      .upsert(legacyPayload, { onConflict: "user_id" })
      .select("*")
      .single())
  }

  if (error && isMissingJoinedAtColumn(error)) {
    const { joined_at, ...legacyPayload } = payload
    ;({ data, error } = await client
      .from("public_profiles")
      .upsert(legacyPayload, { onConflict: "user_id" })
      .select("*")
      .single())
  }

  if (error && isMissingPrivacyColumn(error)) {
    const { public_profile, show_stats, ...legacyPayload } = payload
    ;({ data, error } = await client
      .from("public_profiles")
      .upsert(legacyPayload, { onConflict: "user_id" })
      .select("*")
      .single())
  }

  if (error && isMissingPublicProfileSchema(error)) {
    return { data: null, error: null, skipped: true }
  }
  if (error && isHandleUniqueViolation(error)) {
    return { data: null, error: createHandleTakenError(payload.handle) }
  }
  return { data, error }
}

export const checkHandleAvailability = async (handle, excludeUserId = null) => {
  const normalized = normalizeHandle(handle)
  if (!normalized) {
    return { available: false, error: new Error("Invalid username.") }
  }

  const { data, error } = await client
    .from("public_profiles")
    .select("user_id")
    .eq("handle", normalized)
    .maybeSingle()

  if (error && isMissingPublicProfileSchema(error)) {
    return { available: true, error: null, skipped: true }
  }
  if (error) {
    return { available: false, error }
  }
  if (data?.user_id && String(data.user_id) !== String(excludeUserId || "")) {
    return { available: false, error: null }
  }
  return { available: true, error: null }
}

export const fetchPublicProfileByHandle = async (handle) => {
  const normalized = normalizeHandle(handle)
  if (!normalized) return { data: null, error: new Error("Invalid profile handle.") }
  try {
    const response = await fetch(`/api/profiles/${encodeURIComponent(normalized)}`, { cache: "no-store" })
    const body = await response.json().catch(() => ({}))
    if (response.status === 404) return { data: null, error: null, state: "missing" }
    if (response.status === 403) return { data: null, error: null, state: "private" }
    if (!response.ok) return { data: null, error: new Error(body?.error || "Profile sharing is unavailable."), state: "error" }
    return { data: body?.profile || null, error: null, state: "public" }
  } catch (error) {
    return { data: null, error, state: "error" }
  }
}

const processedHandleUserIds = new Set()

const deriveHandleBase = (user) => {
  const fromName = normalizeHandle(user?.user_metadata?.full_name || user?.user_metadata?.display_name || "")
  const anonymous = user?.id ? `user${String(user.id).replace(/-/g, "").slice(0, 8)}` : "user"
  let base = fromName || anonymous
  if (base.length < 3) base = `${base}fan`
  return base.slice(0, 20)
}

/**
 * Guarantees every signed-in user has a handle + public profile row. New users
 * are prompted to choose one at sign-up (the register form and OAuth
 * onboarding). This is the safety net for anyone who skips that step, so nobody
 * is ever left without a handle / public profile. Users can still change it
 * later in Settings. No-ops when the user already has a handle, and never
 * throws (failures simply retry on the next load).
 */
export const ensureUserHandle = async (user) => {
  if (!user?.id || processedHandleUserIds.has(user.id)) return
  const existing = normalizeHandle(user?.user_metadata?.username || user?.user_metadata?.handle || "")
  if (existing) {
    processedHandleUserIds.add(user.id)
    const result = await upsertPublicProfile(user, { handle: existing })
    if (result?.error || result?.skipped) processedHandleUserIds.delete(user.id)
    return
  }
  processedHandleUserIds.add(user.id)

  try {
    const base = deriveHandleBase(user)
    let assigned = null
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`
      const { available, skipped } = await checkHandleAvailability(candidate, user.id)
      if (skipped) return // profile schema not migrated yet — bail quietly
      if (!available) continue
      const { error } = await client.auth.updateUser({ data: { username: candidate, handle: candidate } })
      if (!error) {
        assigned = candidate
        break
      }
    }
    if (!assigned) {
      processedHandleUserIds.delete(user.id) // allow a retry on the next session load
      return
    }
    await upsertPublicProfile(
      { ...user, user_metadata: { ...(user.user_metadata || {}), username: assigned, handle: assigned } },
      { handle: assigned },
    )
  } catch {
    processedHandleUserIds.delete(user.id)
  }
}
