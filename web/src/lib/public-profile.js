import client from "@/lib/client"

export const normalizeHandle = (value) =>
  String(value || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "")

const pickDisplayName = (user) =>
  user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "User"

const pickAvatar = (user) => user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || null

const pickBanner = (user) => user?.user_metadata?.banner_url || null

const pickBio = (user) => user?.user_metadata?.bio || null

const pickLocation = (user) => user?.user_metadata?.location || null

const pickWebsite = (user) => user?.user_metadata?.website || null

const pickJoinedAt = (user) => user?.created_at || null

const pickHandle = (user) =>
  normalizeHandle(
    user?.user_metadata?.username ||
      user?.user_metadata?.handle ||
      (user?.email ? user.email.split("@")[0] : "user"),
  )

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

  if (error && isMissingJoinedAtColumn(error)) {
    const { joined_at, ...legacyPayload } = payload
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
  const { data, error } = await client
    .from("public_profiles")
    .select("*")
    .eq("handle", normalized)
    .maybeSingle()
  if (error && isMissingPublicProfileSchema(error)) {
    return { data: null, error: new Error("Profile sharing is not set up yet."), skipped: true }
  }
  return { data, error }
}
