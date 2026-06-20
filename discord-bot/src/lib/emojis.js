// Central emoji map for the bot.
//
// To use YOUR custom emojis:
//   1. Upload them to the bot in the Discord Developer Portal:
//      https://discord.com/developers → your app → "Emojis" (Application Emojis
//      work in every server, even ones that don't have the emoji).
//      Or use emojis from any server the bot is in.
//   2. Get the raw form: in Discord type a backslash before the emoji, e.g.
//      `\:completed:` → it reveals `<:completed:123456789012345678>`
//      (animated emojis look like `<a:name:id>`).
//   3. Paste that string in place of the unicode fallback below.
//
// Everything in the bot reads from here, so this one file restyles all embeds.

export const EMOJI = {
  // List statuses
  completed: "✅",
  watching: "▶️",
  planned: "🗓️",
  onHold: "⏸️",
  dropped: "🚫",
  rewatching: "🔁",

  // Stats / profile
  episodes: "🎞️",
  genres: "🎭",
  library: "📊",
  nowWatching: "🎬",
  time: "⏱️",
  star: "⭐",
  fire: "🔥",
  trophy: "🏆",

  // Anime card
  format: "📺",
  year: "📅",
  status: "📡",
  studio: "🎨",

  // UI / misc
  link: "🔗",
  check: "✅",
  cross: "🚫",
  warning: "⚠️",
  info: "ℹ️",
  sparkle: "✨",
  calendar: "📅",
  brand: "🌸",
}

// Small helper so callers can do emoji("completed") with a safe fallback.
export const emoji = (key) => EMOJI[key] || ""
