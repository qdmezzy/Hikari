import client from "@/lib/client"

// Announcements + forum threads are moderator-authored content. Writes are
// enforced mod-only by RLS (see db/create-community-content.sql); these helpers
// degrade gracefully if the tables have not been migrated yet.

const isMissingTable = (error) => {
  const code = String(error?.code || "")
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase()
  return code === "42P01" || (text.includes("does not exist") && text.includes("relation"))
}

const authorName = (user) =>
  user?.user_metadata?.display_name ||
  user?.user_metadata?.full_name ||
  user?.user_metadata?.username ||
  user?.email ||
  "Moderator"

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
export const fetchAnnouncements = async (limit = 5) => {
  const { data, error } = await client
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTable(error)) return []
    throw new Error(error.message || "Failed to load announcements.")
  }
  return data || []
}

export const createAnnouncement = async ({ user, title, body, isPublished = true }) => {
  const { data, error } = await client
    .from("announcements")
    .insert({
      title: title.trim(),
      body: (body || "").trim(),
      is_published: isPublished,
      created_by: user?.id || null,
      author_name: authorName(user),
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message || "Failed to create announcement.")
  return data
}

export const updateAnnouncement = async (id, { title, body, isPublished }) => {
  const patch = {}
  if (title !== undefined) patch.title = title.trim()
  if (body !== undefined) patch.body = (body || "").trim()
  if (isPublished !== undefined) patch.is_published = isPublished

  const { data, error } = await client
    .from("announcements")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()

  if (error) throw new Error(error.message || "Failed to update announcement.")
  return data
}

export const deleteAnnouncement = async (id) => {
  const { error } = await client.from("announcements").delete().eq("id", id)
  if (error) throw new Error(error.message || "Failed to delete announcement.")
}

// ---------------------------------------------------------------------------
// Forum threads
// ---------------------------------------------------------------------------
export const fetchForumThreads = async (limit = 8) => {
  const { data, error } = await client
    .from("forum_threads")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTable(error)) return []
    throw new Error(error.message || "Failed to load forum threads.")
  }
  return data || []
}

export const createForumThread = async ({ user, title, body, category = "general", isPinned = false }) => {
  const { data, error } = await client
    .from("forum_threads")
    .insert({
      title: title.trim(),
      body: (body || "").trim(),
      category: (category || "general").trim().toLowerCase(),
      is_pinned: isPinned,
      created_by: user?.id || null,
      author_name: authorName(user),
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message || "Failed to create thread.")
  return data
}

export const updateForumThread = async (id, { title, body, category, isPinned }) => {
  const patch = {}
  if (title !== undefined) patch.title = title.trim()
  if (body !== undefined) patch.body = (body || "").trim()
  if (category !== undefined) patch.category = (category || "general").trim().toLowerCase()
  if (isPinned !== undefined) patch.is_pinned = isPinned

  const { data, error } = await client
    .from("forum_threads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()

  if (error) throw new Error(error.message || "Failed to update thread.")
  return data
}

export const deleteForumThread = async (id) => {
  const { error } = await client.from("forum_threads").delete().eq("id", id)
  if (error) throw new Error(error.message || "Failed to delete thread.")
}
