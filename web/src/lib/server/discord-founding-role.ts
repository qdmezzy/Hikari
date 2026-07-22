import type { SupabaseClient } from "@supabase/supabase-js"

type FoundingRoleSyncResult = {
  status: "added" | "removed" | "unchanged" | "not_linked" | "not_configured" | "missing_member" | "permission_error" | "failed"
}

const discordApi = "https://discord.com/api/v10"

export const syncFoundingRoleForHikariUser = async (
  admin: SupabaseClient,
  hikariUserId: string,
): Promise<FoundingRoleSyncResult> => {
  const token = process.env.DISCORD_BOT_TOKEN || ""
  const guildId = process.env.DISCORD_GUILD_ID || ""
  const roleId = process.env.DISCORD_FOUNDING_ROLE_ID || ""
  if (!token || !guildId || !roleId) return { status: "not_configured" }

  const [membershipResult, linkResult] = await Promise.all([
    admin.from("founding_members").select("active").eq("user_id", hikariUserId).maybeSingle(),
    admin.from("discord_links").select("discord_user_id").eq("hikari_user_id", hikariUserId).maybeSingle(),
  ])
  if (membershipResult.error || linkResult.error) return { status: "failed" }
  const membership = membershipResult.data
  const link = linkResult.data
  if (!link?.discord_user_id) return { status: "not_linked" }

  const shouldHaveRole = membership?.active === true
  try {
    const response = await fetch(
      `${discordApi}/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(link.discord_user_id)}/roles/${encodeURIComponent(roleId)}`,
      {
        method: shouldHaveRole ? "PUT" : "DELETE",
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      },
    )
    if (response.ok) return { status: shouldHaveRole ? "added" : "removed" }
    if (response.status === 404) return { status: "missing_member" }
    if (response.status === 403) return { status: "permission_error" }
    return { status: "failed" }
  } catch {
    return { status: "failed" }
  }
}
