import { createHmac, timingSafeEqual } from "node:crypto"

const TOKEN_ISSUER = "hikari-discord-bot"
const TOKEN_AUDIENCE = "hikari-web"
export const MAX_DISCORD_LINK_TTL_SECONDS = 10 * 60

const encode = (value) => Buffer.from(value).toString("base64url")
const sign = (encodedPayload, secret) =>
  createHmac("sha256", secret).update(encodedPayload).digest("base64url")

export const createDiscordLinkToken = (
  { discordUserId, discordName = "" },
  secret,
  { now = Date.now(), ttlSeconds = MAX_DISCORD_LINK_TTL_SECONDS } = {},
) => {
  const normalizedId = String(discordUserId || "").trim()
  if (!/^\d{5,30}$/.test(normalizedId)) throw new Error("Invalid Discord user id.")
  if (Buffer.byteLength(String(secret)) < 32) throw new Error("Discord link signing secret must be at least 32 bytes.")

  const issuedAt = Math.floor(now / 1000)
  const ttl = Math.max(30, Math.min(Number(ttlSeconds) || 0, MAX_DISCORD_LINK_TTL_SECONDS))
  const payload = {
    v: 1,
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    sub: normalizedId,
    name: String(discordName || "").trim().slice(0, 100),
    iat: issuedAt,
    exp: issuedAt + ttl,
  }
  const encodedPayload = encode(JSON.stringify(payload))
  return `${encodedPayload}.${sign(encodedPayload, secret)}`
}

export const verifyDiscordLinkToken = (token, secret, { now = Date.now() } = {}) => {
  if (Buffer.byteLength(String(secret || "")) < 32) throw new Error("Discord linking is not configured securely.")
  const [encodedPayload, suppliedSignature, ...extra] = String(token || "").split(".")
  if (!encodedPayload || !suppliedSignature || extra.length) throw new Error("Invalid Discord link token.")

  const expectedSignature = sign(encodedPayload, secret)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Invalid Discord link token.")
  }

  let payload
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
  } catch {
    throw new Error("Invalid Discord link token.")
  }

  const currentTime = Math.floor(now / 1000)
  if (
    payload?.v !== 1 ||
    payload?.iss !== TOKEN_ISSUER ||
    payload?.aud !== TOKEN_AUDIENCE ||
    !/^\d{5,30}$/.test(String(payload?.sub || "")) ||
    !Number.isInteger(payload?.iat) ||
    !Number.isInteger(payload?.exp) ||
    payload.iat > currentTime + 60 ||
    payload.exp <= currentTime ||
    payload.exp - payload.iat > MAX_DISCORD_LINK_TTL_SECONDS
  ) {
    throw new Error(payload?.exp <= currentTime ? "Discord link token has expired." : "Invalid Discord link token.")
  }

  return {
    discordUserId: String(payload.sub),
    discordName: String(payload.name || "").slice(0, 100),
    expiresAt: payload.exp,
  }
}
