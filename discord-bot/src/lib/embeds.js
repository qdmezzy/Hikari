import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { config } from "../config.js";

// Brand palette tuned to the Hikari web app (primary blue → cyan accent).
export const embedColors = {
  brand: 0x3b82f6,
  info: 0x4f91f5,
  success: 0x22c55e,
  warning: 0xf59e0b,
  error: 0xef4444,
  discovery: 0x8b5cf6,
};

const FOOTER = "光 Hikari";

const cleanText = (value, max = 200) => {
  const plain = String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trimEnd()}…`;
};

const statusLabel = (raw) => {
  const key = String(raw || "").toLowerCase();
  if (key === "not_yet_released") return "Coming soon";
  if (key === "currently_airing" || key === "releasing") return "Airing";
  if (key === "finished") return "Finished";
  if (key === "hiatus") return "On hiatus";
  if (key === "cancelled") return "Cancelled";
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const buildBaseEmbed = ({ color = embedColors.brand, title, description, url } = {}) => {
  const embed = new EmbedBuilder().setColor(color).setFooter({ text: FOOTER }).setTimestamp();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (url) embed.setURL(url);
  return embed;
};

const linkButton = (label, url, emoji) => {
  const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);
  if (emoji) button.setEmoji(emoji);
  return button;
};

export const buildInfoEmbed = ({ title, description, url } = {}) =>
  buildBaseEmbed({ color: embedColors.info, title, description, url });

export const buildSuccessEmbed = ({ title, description, url } = {}) =>
  buildBaseEmbed({ color: embedColors.success, title: title ? `✅  ${title}` : title, description, url });

export const buildWarningEmbed = ({ title, description, url } = {}) =>
  buildBaseEmbed({ color: embedColors.warning, title: title ? `⚠️  ${title}` : title, description, url });

export const buildErrorEmbed = ({ title = "Request Failed", description } = {}) =>
  buildBaseEmbed({ color: embedColors.error, title: `🚫  ${title}`, description });

export const profileUrl = (handle) =>
  handle ? `${config.hikariWebBaseUrl}/u/${encodeURIComponent(handle)}` : config.hikariWebBaseUrl;

export const animeUrl = (mediaId) => `${config.hikariWebBaseUrl}/media/${encodeURIComponent(mediaId)}`;

export const listUrl = (handle) =>
  handle ? `${config.hikariWebBaseUrl}/u/${encodeURIComponent(handle)}` : config.hikariWebBaseUrl;

export const buildProfileEmbed = ({ handle, displayName, avatarUrl, watchingLine, counts, topGenres, totalEpisodes = 0 }) => {
  const safeName = displayName || handle || "User";
  const nowWatching = watchingLine || "Nothing in progress";

  const embed = buildBaseEmbed({
    color: embedColors.brand,
    title: safeName,
    description: `▶️ **Now watching** · ${nowWatching}`,
    url: profileUrl(handle),
  }).addFields(
    { name: "▶️ Watching", value: `**${counts?.watching || 0}**`, inline: true },
    { name: "✅ Completed", value: `**${counts?.completed || 0}**`, inline: true },
    { name: "🗓️ Planned", value: `**${counts?.plan_to_watch || 0}**`, inline: true },
    { name: "⏸️ On hold", value: `**${counts?.on_hold || 0}**`, inline: true },
    { name: "🚫 Dropped", value: `**${counts?.dropped || 0}**`, inline: true },
    { name: "🎞️ Episodes", value: `**${totalEpisodes || 0}**`, inline: true },
  );

  if (topGenres?.length) {
    embed.addFields({ name: "🎭 Top genres", value: topGenres.join("  •  "), inline: false });
  }

  if (handle) embed.setAuthor({ name: `@${handle}` });
  if (avatarUrl) embed.setThumbnail(avatarUrl);

  return embed;
};

export const buildProfileButtons = ({ handle }) =>
  new ActionRowBuilder().addComponents(
    linkButton("View Profile", profileUrl(handle), "🌐"),
    linkButton("My Lists", listUrl(handle), "📋"),
    linkButton("Open Hikari", config.hikariWebBaseUrl, "✨"),
  );

export const buildAnimeEmbed = (media) => {
  const title = media?.title?.english || media?.title?.romaji || "Unknown anime";
  const score10 = Number.isFinite(Number(media?.averageScore))
    ? `⭐ ${(Number(media.averageScore) / 10).toFixed(1)} / 10`
    : "Not rated";
  const episodes = media?.episodes ?? "?";
  const type = media?.format ? String(media.format).replace(/_/g, " ") : "Anime";
  const year = media?.startDate?.year || "—";
  const status = statusLabel(media?.status || "unknown");
  const genres = (media?.genres || []).slice(0, 4);
  const studios = (media?.studios?.nodes || []).map((node) => node?.name).filter(Boolean);
  const desc = cleanText(media?.description || "No synopsis available yet.", 240);
  const cover = media?.coverImage?.large || media?.coverImage?.medium || null;

  const embed = buildBaseEmbed({
    color: embedColors.info,
    title,
    description: desc,
    url: animeUrl(media?.id),
  }).addFields(
    { name: "Rating", value: score10, inline: true },
    { name: "📺 Format", value: String(type), inline: true },
    { name: "🎞️ Episodes", value: String(episodes), inline: true },
    { name: "📅 Year", value: String(year), inline: true },
    { name: "📡 Status", value: status, inline: true },
  );

  if (genres.length) embed.addFields({ name: "🎭 Genres", value: genres.join("  •  "), inline: false });
  if (studios.length) embed.addFields({ name: "🎨 Studio", value: studios.slice(0, 3).join(", "), inline: true });
  if (cover) embed.setThumbnail(cover);

  return embed;
};

export const buildAnimeButtons = (media) =>
  new ActionRowBuilder().addComponents(linkButton("Open on Hikari", animeUrl(media?.id), "▶️"));

const STATUS_EMOJI = {
  Watching: "▶️",
  Completed: "✅",
  Planned: "🗓️",
  "Plan to Watch": "🗓️",
  "On Hold": "⏸️",
  Dropped: "🚫",
  Rewatching: "🔁",
};

export const buildListEmbed = ({ handle, displayName, statusLabel: label, previewItems }) => {
  const safeName = displayName || handle || "User";
  const lines = (previewItems || [])
    .slice(0, 10)
    .map((item, index) => {
      const emoji = STATUS_EMOJI[item.status] || "•";
      return `\`${String(index + 1).padStart(2, " ")}\` ${emoji} **${item.title}** · Ep ${item.progress}`;
    });

  return buildBaseEmbed({
    color: embedColors.brand,
    title: label ? `${label}` : "List",
    description: lines.length ? lines.join("\n") : "_No entries yet._",
    url: listUrl(handle),
  }).setAuthor({ name: safeName });
};

export const buildListButtons = ({ handle }) =>
  new ActionRowBuilder().addComponents(linkButton("View Full List", listUrl(handle), "📋"));
