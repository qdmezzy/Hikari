import client from "@/lib/client"

export const reportContent = async ({
  reporterId,
  targetType,
  targetId,
  postId = null,
  reason = null,
  targetLabel,
  targetUrl = null,
  targetUserId,
  targetUserHandle,
  targetUserDisplayName,
  targetUserAvatarUrl,
}) => {
  if (!reporterId) {
    throw new Error("You must be signed in to report.")
  }

  const { error } = await client.from("social_reports").insert({
    post_id: postId || null,
    reporter_id: reporterId,
    reason: reason || "user_report",
    target_type: targetType || "social_post",
    target_id: targetId ? String(targetId) : null,
    target_label: targetLabel || null,
    target_url: targetUrl || null,
    target_user_id: targetUserId || null,
    target_user_handle: targetUserHandle || null,
    target_user_display_name: targetUserDisplayName || null,
    target_user_avatar_url: targetUserAvatarUrl || null,
  })

  if (error) {
    throw new Error(error.message || "Failed to send report.")
  }

  return true
}
