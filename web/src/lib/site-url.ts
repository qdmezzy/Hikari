const legacySiteUrl = "https://hikari.raycodes.net"
const currentSiteUrl = "https://hikari.raycodes.me"

const configuredSiteUrl = (process.env.NEXT_PUBLIC_APP_URL || currentSiteUrl).trim().replace(/\/$/, "")

export const siteUrl = configuredSiteUrl === legacySiteUrl ? currentSiteUrl : configuredSiteUrl
