export const decideDiscordLinkWrite = ({ discordLink, hikariLink, hikariUserId, discordUserId }) => {
  if (discordLink && String(discordLink.hikari_user_id) !== String(hikariUserId)) {
    return { ok: false, status: 409, reason: "discord_claimed" }
  }
  if (hikariLink && String(hikariLink.discord_user_id) !== String(discordUserId)) {
    return { ok: false, status: 409, reason: "hikari_already_linked" }
  }
  return { ok: true, mode: discordLink || hikariLink ? "update" : "insert" }
}
