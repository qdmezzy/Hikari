// Two existing database writes: preserve and disclose a created empty collection
// if adding its first title fails. Never report the second write as successful.
export async function createCollectionWithTitle(db, userId, name, mediaId, mediaType = "ANIME") {
  if (!userId || !name?.trim() || !Number.isSafeInteger(mediaId) || mediaId <= 0) throw new Error("Invalid collection")
  const { data: list, error } = await db.from("custom_lists")
    .insert({ user_id: userId, name: name.trim().slice(0, 80), is_public: false })
    .select("id, name, is_public").single()
  if (error || !list) throw new Error("Couldn't create collection")
  try {
    const result = await db.from("custom_list_items").insert({ list_id: list.id, media_id: mediaId, media_type: mediaType || "ANIME" })
    return { list, added: !result.error }
  } catch {
    return { list, added: false }
  }
}
