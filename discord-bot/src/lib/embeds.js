import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { buildDiscordBotInviteUrl, buildHikariUrl, config } from "../config.js";
import { EMOJI } from "./emojis.js";

// Brand palette tuned to the Hikari web app (navy base, banana accent).
// One gold accent for everything informational; green/amber/red are reserved
// for success/warning/error so color always carries meaning.
export const embedColors = {
  brand: 0xf3d36b,
  info: 0xf3d36b,
  success: 0x22c55e,
  warning: 0xf59e0b,
  error: 0xef4444,
  discovery: 0xf3d36b,
};

// ▰▰▰▰▱▱▱▱▱▱ — takes a 0..1 ratio.
export const progressBar = (ratio, width = 10) => {
  const pct = Math.max(0, Math.min(1, Number(ratio) || 0));
  const filled = Math.round(pct * width);
  return "▰".repeat(filled) + "▱".repeat(width - filled);
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

// "TV_SHORT" → "TV Short", "MOVIE" → "Movie"; keeps all-caps initialisms.
const formatLabel = (raw) =>
  String(raw || "")
    .split("_")
    .filter(Boolean)
    .map((part) => (/^(TV|OVA|ONA)$/i.test(part) ? part.toUpperCase() : part.charAt(0) + part.slice(1).toLowerCase()))
    .join(" ");

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
  buildBaseEmbed({ color: embedColors.success, title: title ? `${EMOJI.check}  ${title}` : title, description, url });

export const buildWarningEmbed = ({ title, description, url } = {}) =>
  buildBaseEmbed({ color: embedColors.warning, title: title ? `${EMOJI.warning}  ${title}` : title, description, url });

export const buildErrorEmbed = ({ title = "Request Failed", description } = {}) =>
  buildBaseEmbed({ color: embedColors.error, title: `${EMOJI.cross}  ${title}`, description });

export const profileUrl = (handle, campaign = "sharing") =>
  buildHikariUrl(handle ? `/u/${encodeURIComponent(handle)}` : "/", campaign);

export const animeUrl = (mediaId, campaign = "sharing") =>
  buildHikariUrl(`/media/${encodeURIComponent(mediaId)}`, campaign);

export const listUrl = (handle, campaign = "sharing") =>
  buildHikariUrl(handle ? `/u/${encodeURIComponent(handle)}` : "/lists", campaign);

export const buildProfileEmbed = ({
  handle,
  displayName,
  avatarUrl,
  watchingLine,
  counts,
  topGenres,
  totalEpisodes = 0,
  campaign = "sharing",
}) => {
  const safeName = displayName || handle || "User";
  const nowWatching = watchingLine || "Nothing in progress";
  const c = counts || {};
  const total =
    (c.watching || 0) +
    (c.completed || 0) +
    (c.plan_to_watch || 0) +
    (c.on_hold || 0) +
    (c.dropped || 0) +
    (c.rewatching || 0);

  // Episodes → rough watch time (~24 min/ep).
  const minutes = (totalEpisodes || 0) * 24;
  const timeWatched =
    minutes >= 60 * 24 ? `${(minutes / 60 / 24).toFixed(1)} days` : `${Math.max(0, Math.round(minutes / 60))} hrs`;

  const embed = buildBaseEmbed({
    color: embedColors.brand,
    title: safeName,
    description: `${EMOJI.nowWatching} **Now Watching**\n> ${nowWatching}`,
    url: profileUrl(handle, campaign),
  }).addFields(
    { name: `${EMOJI.completed} Completed`, value: `\`\`\`\n${c.completed || 0}\n\`\`\``, inline: true },
    { name: `${EMOJI.watching} Watching`, value: `\`\`\`\n${c.watching || 0}\n\`\`\``, inline: true },
    { name: `${EMOJI.planned} Planned`, value: `\`\`\`\n${c.plan_to_watch || 0}\n\`\`\``, inline: true },
    { name: `${EMOJI.onHold} On Hold`, value: `\`\`\`\n${c.on_hold || 0}\n\`\`\``, inline: true },
    { name: `${EMOJI.dropped} Dropped`, value: `\`\`\`\n${c.dropped || 0}\n\`\`\``, inline: true },
    { name: `${EMOJI.episodes} Episodes`, value: `\`\`\`\n${(totalEpisodes || 0).toLocaleString()}\n\`\`\``, inline: true },
  );

  embed.addFields({
    name: `${EMOJI.library} Library`,
    value: `**${total.toLocaleString()}** titles tracked  ·  ${EMOJI.time} ~**${timeWatched}** watched`,
    inline: false,
  });

  if (topGenres?.length) {
    embed.addFields({ name: `${EMOJI.genres} Top Genres`, value: topGenres.map((g) => `\`${g}\``).join("  "), inline: false });
  }

  if (handle) embed.setAuthor({ name: `@${handle}` });
  if (avatarUrl) embed.setThumbnail(avatarUrl);

  return embed;
};

export const buildProfileButtons = ({ handle, campaign = "sharing" }) =>
  new ActionRowBuilder().addComponents(
    linkButton("View Profile", profileUrl(handle, campaign), "🌐"),
    linkButton("My Lists", listUrl(handle, campaign), "📋"),
    linkButton("Open Hikari", buildHikariUrl("/", campaign), "✨"),
  );

export const buildAnimeEmbed = (media, { campaign = "sharing" } = {}) => {
  const title = media?.title?.english || media?.title?.romaji || "Unknown anime";
  const score10 = Number.isFinite(Number(media?.averageScore)) ? (Number(media.averageScore) / 10).toFixed(1) : null;
  const episodes = Number(media?.episodes || 0);
  const genres = (media?.genres || []).slice(0, 4);
  const studios = (media?.studios?.nodes || []).map((node) => node?.name).filter(Boolean);
  const desc = cleanText(media?.description || "No synopsis available yet.", 240);

  // One compact meta strip — the hero card below already repeats the basics,
  // so the embed only adds what the card doesn't show.
  const meta = [
    score10 ? `${EMOJI.star} **${score10}**` : null,
    media?.format ? formatLabel(media.format) : null,
    episodes ? `${episodes} ep${episodes === 1 ? "" : "s"}` : null,
    media?.startDate?.year || null,
    media?.status ? statusLabel(media.status) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const lines = [meta, "", desc];
  if (genres.length || studios.length) lines.push("");
  if (genres.length) lines.push(genres.map((genre) => `\`${genre}\``).join(" "));
  if (studios.length) lines.push(`-# ${EMOJI.studio} ${studios.slice(0, 2).join(", ")}`);

  const embed = buildBaseEmbed({
    color: embedColors.brand,
    title,
    description: lines.join("\n"),
    url: animeUrl(media?.id, campaign),
  });

  // The site renders a branded share card per title — use it as the hero image.
  // No thumbnail: the card already shows the cover art.
  if (media?.id) embed.setImage(`${config.hikariWebBaseUrl}/media/${media.id}/opengraph-image`);
  else if (media?.coverImage?.large || media?.coverImage?.medium) {
    embed.setThumbnail(media.coverImage.large || media.coverImage.medium);
  }

  return embed;
};

export const buildAnimeButtons = (media, { campaign = "sharing", includeInvite = false } = {}) => {
  const buttons = [linkButton("Open on Hikari", animeUrl(media?.id, campaign), "▶️")];
  if (includeInvite) buttons.push(linkButton("Add Hikari to Server", buildDiscordBotInviteUrl(), "➕"));
  return new ActionRowBuilder().addComponents(buttons);
};

const STATUS_EMOJI = {
  Watching: EMOJI.watching,
  Completed: EMOJI.completed,
  Planned: EMOJI.planned,
  "Plan to Watch": EMOJI.planned,
  "On Hold": EMOJI.onHold,
  Dropped: EMOJI.dropped,
  Rewatching: EMOJI.rewatching,
};

// Small Components V2 notice card: heading + body + optional button rows.
// Used where a panel already lives in Components V2 and can't edit back to
// classic embeds (the IsComponentsV2 flag is permanent on a message).
export const buildNoticeView = ({ color = embedColors.brand, title, description, rows = [] }) => {
  const container = new ContainerBuilder().setAccentColor(color);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent([title ? `## ${title}` : null, description].filter(Boolean).join("\n")),
  );
  if (rows.length) {
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    for (const row of rows) container.addActionRowComponents(row);
  }
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# 光 Hikari"));
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
};

// One list row: linked title plus a progress line rendered as small subtext.
const listItemText = (item, campaign) => {
  const title = `**[${item.title}](${animeUrl(item.mediaId, campaign)})**`;
  const isPlanned = /plan/i.test(String(item.status));
  const isCompleted = /complet/i.test(String(item.status));
  const total = Number(item.episodes || 0);
  const seen = Number(item.progress || 0);

  let meta;
  if (isPlanned) {
    // Planned titles haven't been started — show the show's length, not "Ep 0".
    meta = total ? `${progressBar(0)}  ${total} eps · Not started` : "Not started";
  } else if (isCompleted) {
    meta = `${progressBar(1)}  ${total || seen} / ${total || seen} · Completed`;
  } else if (total > 0) {
    const pct = Math.max(0, Math.min(1, seen / total));
    meta = `${progressBar(pct)}  Ep ${seen} / ${total} · ${Math.round(pct * 100)}%`;
  } else {
    meta = `Ep ${seen}`;
  }
  return `${title}\n-# ${meta}`;
};

// Components V2 list card: each anime gets its own row with cover art.
// Returns a full reply payload (components + flags), not an embed.
export const buildListView = ({
  handle,
  displayName,
  statusLabel: label,
  previewItems,
  statsLine,
  campaign = "sharing",
}) => {
  const safeName = displayName || handle || "User";
  // Component budget: 8 items × (section + text + thumbnail) + chrome stays
  // under Discord's 40-component message cap.
  const items = (previewItems || []).slice(0, 8);
  const headerEmoji = STATUS_EMOJI[label] || EMOJI.library;

  const container = new ContainerBuilder().setAccentColor(embedColors.brand);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [`### ${headerEmoji}  ${safeName} — ${label || "List"}`, statsLine ? `-# ${statsLine}` : null]
        .filter(Boolean)
        .join("\n"),
    ),
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  if (!items.length) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("_No entries yet._"));
  }

  items.forEach((item, index) => {
    const text = new TextDisplayBuilder().setContent(listItemText(item, campaign));
    if (item.cover) {
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(text)
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(item.cover)),
      );
    } else {
      container.addTextDisplayComponents(text);
    }
    if (index < items.length - 1) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false),
      );
    }
  });

  if (handle) {
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(linkButton("View Full List", listUrl(handle, campaign), "📋")),
    );
  }
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# 光 Hikari"));

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
};
