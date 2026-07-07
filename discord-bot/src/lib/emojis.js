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

// Auto-upgrade to custom emojis on boot: upload emojis to the bot's app
// (Developer Portal -> Emojis) or any server the bot is in, named after the
// keys above ("star", "completed", ...) or prefixed ("hikari_star",
// "hikari_now_watching"). Matching keys get swapped in automatically -
// no code changes needed.
export const resolveCustomEmojis = async (client) => {
  try {
    const applied = [];
    const appEmojis = await client.application?.emojis?.fetch?.().catch(() => null);
    const pools = [...(appEmojis?.values?.() || []), ...client.emojis.cache.values()];
    const keyByNorm = Object.fromEntries(Object.keys(EMOJI).map((key) => [key.toLowerCase(), key]));
    for (const emoji of pools) {
      const norm = String(emoji.name || "")
        .toLowerCase()
        .replace(/^hikari_/, "")
        .replace(/_/g, "");
      const key = keyByNorm[norm];
      if (key) {
        EMOJI[key] = emoji.toString();
        applied.push(emoji.name);
      }
    }
    if (applied.length) {
      console.log(`[hikari-bot] Using ${applied.length} custom emoji(s): ${applied.join(", ")}`);
    }
  } catch (error) {
    console.warn("[hikari-bot] Custom emoji resolution failed:", error?.message || error);
  }
};
