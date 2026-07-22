import { createHmac } from "node:crypto";

const TOKEN_ISSUER = "hikari-discord-bot";
const TOKEN_AUDIENCE = "hikari-web";
export const MAX_DISCORD_LINK_TTL_SECONDS = 10 * 60;

export const createDiscordLinkToken = (
  { discordUserId, discordName = "" },
  secret,
  { now = Date.now(), ttlSeconds = MAX_DISCORD_LINK_TTL_SECONDS } = {},
) => {
  const normalizedId = String(discordUserId || "").trim();
  if (!/^\d{5,30}$/.test(normalizedId)) throw new Error("Invalid Discord user id.");
  if (Buffer.byteLength(String(secret || "")) < 32) {
    throw new Error("Discord link signing secret must be at least 32 bytes.");
  }

  const issuedAt = Math.floor(now / 1000);
  const ttl = Math.max(30, Math.min(Number(ttlSeconds) || 0, MAX_DISCORD_LINK_TTL_SECONDS));
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE,
      sub: normalizedId,
      name: String(discordName || "").trim().slice(0, 100),
      iat: issuedAt,
      exp: issuedAt + ttl,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};
