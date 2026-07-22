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
  target: "🎯",
  gold: "🥇",
  silver: "🥈",
  bronze: "🥉",

  // Anime card
  format: "📺",
  year: "📅",
  status: "📡",
  studio: "🎨",

  // UI / misc
  user: "👤",
  link: "🔗",
  check: "✅",
  cross: "🚫",
  warning: "⚠️",
  info: "ℹ️",
  sparkle: "✨",
  calendar: "📅",
  brand: "🌸",
  heart: "❤️",
  party: "🎉",
  dice: "🎲",
  megaphone: "📣",
  clipboard: "📋",
  plus: "➕",
  chat: "💬",
  back: "⬅️",
  globe: "🌐",

  // Help categories
  crystal: "🔮",
  share: "📤",
  chart: "📈",
  tools: "🛠️",
}

// Unicode-only snapshot taken before the custom-emoji upgrade runs.
// Discord cannot render custom emojis in embed titles, authors, or footers —
// use UNICODE there, and EMOJI everywhere else (descriptions, fields,
// Components V2 text, buttons).
export const UNICODE = Object.freeze({ ...EMOJI })

// Small helper so callers can do emoji("completed") with a safe fallback.
export const emoji = (key) => EMOJI[key] || ""

// Common server-emoji names (normalized: lowercased, underscores stripped)
// mapped onto EMOJI keys, so existing packs like :first_place: or
// :crystalball_gif: apply without renaming any uploads.
const EMOJI_ALIASES = {
  firstplace: "gold",
  secondplace: "silver",
  thirdplace: "bronze",
  crystalball: "crystal",
  crystalballgif: "crystal",
  clock: "time",
  cog: "tools",
  pixelaccept: "check",
  greenyes: "check",
  redno: "cross",
  discord: "chat",
  polls: "clipboard",
};

// Auto-upgrade to custom emojis on boot: upload emojis to the bot's app
// (Developer Portal -> Emojis) or any server the bot is in, named after the
// keys above ("star", "completed", ...), prefixed ("hikari_star"), or matching
// an alias. Matching keys get swapped in automatically - no code changes
// needed. An exact key name always beats an alias.
export const resolveCustomEmojis = async (client) => {
  try {
    const appEmojis = await client.application?.emojis?.fetch?.().catch(() => null);
    const pools = [...(appEmojis?.values?.() || []), ...client.emojis.cache.values()];
    const keyByNorm = Object.fromEntries(Object.keys(EMOJI).map((key) => [key.toLowerCase(), key]));

    const best = {};
    for (const emoji of pools) {
      const norm = String(emoji.name || "")
        .toLowerCase()
        .replace(/^hikari_/, "")
        .replace(/_/g, "");
      const direct = keyByNorm[norm];
      const key = direct || EMOJI_ALIASES[norm];
      if (!key) continue;
      const priority = direct ? 2 : 1;
      if (!best[key] || priority >= best[key].priority) best[key] = { priority, emoji };
    }

    const applied = [];
    for (const [key, { emoji }] of Object.entries(best)) {
      EMOJI[key] = emoji.toString();
      applied.push(`:${emoji.name}:→${key}`);
    }
    if (applied.length) {
      console.log(`[hikari-bot] Using ${applied.length} custom emoji(s): ${applied.join(", ")}`);
    }
  } catch (error) {
    console.warn("[hikari-bot] Custom emoji resolution failed:", error?.message || error);
  }
};
