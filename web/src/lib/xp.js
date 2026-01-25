import client from "@/lib/client"

const XP_PER_LEVEL = 100

export const XP_ACTIONS = {
  list_add: 20,
  progress_update: 5,
  review_create: 25,
  social_post: 10,
  social_comment: 4,
  fandom_clip: 15,
}

export const getLevelInfo = (xp) => {
  const safeXp = Number.isFinite(xp) ? xp : 0
  const level = Math.floor(safeXp / XP_PER_LEVEL) + 1
  const xpToNext = level * XP_PER_LEVEL
  const progress = xpToNext > 0 ? Math.min((safeXp / xpToNext) * 100, 100) : 0
  return { xp: safeXp, level, xpToNext, progress }
}

export const awardXp = async (user, amount, reason) => {
  if (!user || !Number.isFinite(amount) || amount <= 0) return null
  const currentXp = Number(user.user_metadata?.xp || 0)
  const nextXp = currentXp + amount
  const { level, xpToNext } = getLevelInfo(nextXp)

  const { error } = await client.auth.updateUser({
    data: {
      xp: nextXp,
      level,
      xp_to_next: xpToNext,
      last_xp_reason: reason || null,
      last_xp_amount: amount,
      last_xp_at: new Date().toISOString(),
    },
  })

  if (error) {
    console.warn("Failed to award XP:", error.message || error)
    return null
  }

  return { xp: nextXp, level, xpToNext }
}
