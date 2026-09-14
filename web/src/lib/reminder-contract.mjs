// State is updated by the caller only after the server confirms the write.
export async function saveEpisodeReminder(client, userId, mediaId, enabled) {
  if (!userId || !Number.isSafeInteger(Number(mediaId)) || Number(mediaId) <= 0) throw new Error("Invalid reminder.")
  const query = client.from("episode_alerts")
  const { error } = enabled
    ? await query.upsert({ user_id: userId, media_id: Number(mediaId) }, { onConflict: "user_id,media_id", ignoreDuplicates: true })
    : await query.delete().eq("user_id", userId).eq("media_id", Number(mediaId))
  if (error) throw new Error("Reminder wasn't saved. Please try again.")
  return enabled
}
