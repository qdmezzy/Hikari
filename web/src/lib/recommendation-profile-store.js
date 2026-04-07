export const defaultUserTasteProfile = () => ({
  genreWeights: {},
  tagWeights: {},
  vibeWeights: {},
  formatWeights: {},
  updatedAt: Date.now(),
})

const coerceObject = (value) => (value && typeof value === "object" ? value : {})

export const fetchUserTasteProfile = async (supabase, userId) => {
  if (!supabase || !userId) {
    return { profile: defaultUserTasteProfile(), found: false }
  }

  const { data, error } = await supabase
    .from("user_taste_profiles")
    .select("genre_weights, tag_weights, vibe_weights, format_weights, updated_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    // If RLS blocks or table missing, caller should handle separately; fall back.
    return { profile: defaultUserTasteProfile(), found: false }
  }

  if (!data) return { profile: defaultUserTasteProfile(), found: false }

  return {
    found: true,
    profile: {
      ...defaultUserTasteProfile(),
      genreWeights: coerceObject(data.genre_weights),
      tagWeights: coerceObject(data.tag_weights),
      vibeWeights: coerceObject(data.vibe_weights),
      formatWeights: coerceObject(data.format_weights),
      updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
    },
  }
}

export const upsertUserTasteProfile = async (supabase, userId, profile) => {
  if (!supabase || !userId || !profile) return null

  const payload = {
    user_id: userId,
    genre_weights: coerceObject(profile.genreWeights),
    tag_weights: coerceObject(profile.tagWeights),
    vibe_weights: coerceObject(profile.vibeWeights),
    format_weights: coerceObject(profile.formatWeights),
  }

  const { data, error } = await supabase
    .from("user_taste_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id")
    .maybeSingle()

  if (error) return null
  return data || null
}

export const fetchUserNotInterestedMedia = async (supabase, userId) => {
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from("user_not_interested_media")
    .select("media_id")
    .eq("user_id", userId)

  if (error) return []
  return (data || []).map((row) => row.media_id).filter((id) => Number.isFinite(Number(id)))
}

export const addUserNotInterestedMedia = async (supabase, userId, mediaId) => {
  if (!supabase || !userId || !Number.isFinite(Number(mediaId))) return null
  const { data, error } = await supabase
    .from("user_not_interested_media")
    .upsert({ user_id: userId, media_id: Number(mediaId) }, { onConflict: "user_id,media_id" })
    .select("media_id")
    .maybeSingle()

  if (error) return null
  return data || null
}
