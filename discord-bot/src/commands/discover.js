import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { buildAnimeEmbed } from "../lib/embeds.js";
import { replyError, respond } from "../lib/interaction.js";
import { getRecommendationPool, mediaTitle, searchAnime, buildTrailerUrl, getAnimeByIds } from "../lib/anilist.js";
import { getListEntriesByUser, getTopGenres } from "../services/profiles.js";
import { resolveTarget } from "../services/targets.js";
import { config } from "../config.js";

const moodToGenres = {
  chill: ["Slice of Life", "Iyashikei"],
  hype: ["Action", "Adventure"],
  dark: ["Psychological", "Thriller"],
  funny: ["Comedy"],
  romance: ["Romance"],
};

const moodLabel = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return "General";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const parseTags = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const cleanText = (value, max = 180) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
};

const progressBar = (pct, width = 20) => {
  const value = Math.max(0, Math.min(100, Number(pct || 0)));
  const filled = Math.round((value / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}`;
};

const recommendationButtons = (media, trailerUrl) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Add to List")
      .setURL(`${config.hikariWebBaseUrl}/media/${media.id}`),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Skip").setURL(`${config.hikariWebBaseUrl}/discover`),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Another").setURL(`${config.hikariWebBaseUrl}/discover`),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Trailer")
      .setURL(trailerUrl || media?.siteUrl || "https://anilist.co"),
  );

const recommendCommand = {
  data: new SlashCommandBuilder()
    .setName("recommend")
    .setDescription("Get anime recommendations.")
    .addStringOption((option) =>
      option
        .setName("mood")
        .setDescription("Recommendation mood")
        .addChoices(
          { name: "Chill", value: "chill" },
          { name: "Hype", value: "hype" },
          { name: "Dark", value: "dark" },
          { name: "Funny", value: "funny" },
          { name: "Romance", value: "romance" },
        ),
    )
    .addStringOption((option) => option.setName("tags").setDescription("Comma-separated tags")),
  async execute(interaction) {
    const mood = interaction.options.getString("mood");
    const tags = parseTags(interaction.options.getString("tags"));

    try {
      let genres = mood ? moodToGenres[mood] || [] : [];
      if (!genres.length && !tags.length) {
        const target = await resolveTarget({
          requesterDiscordId: interaction.user.id,
          requireLinkedSelf: false,
        });
        if (target.ok) {
          const entries = await getListEntriesByUser(target.target.hikariUserId, { limit: 120 });
          genres = await getTopGenres(entries, 2);
        }
      }

      const pool = await getRecommendationPool({ genres, tags, perPage: 12 });
      if (!pool.length) {
        await replyError(interaction, "No recommendations found for those filters.", { title: "No Results" });
        return;
      }

      const pick = pool[0];
      const score10 = Number.isFinite(Number(pick?.averageScore))
        ? (Number(pick.averageScore) / 10).toFixed(1)
        : "N/A";
      const episodes = pick?.episodes || "?";
      const genresLine = (pick?.genres || []).slice(0, 3);
      const match = Math.min(98, Math.max(72, Number(pick?.averageScore || 82)));
      const reason = genres.length
        ? `Based on your interest in ${genres.join(", ")} anime.`
        : tags.length
          ? `Matched by tags: ${tags.join(", ")}.`
          : "Based on popular picks that fit your activity.";

      const embed = new EmbedBuilder()
        .setColor(0xeb459e)
        .setTitle("Recommendation")
        .setDescription(
          [
            `**${mediaTitle(pick)}**`,
            `Score ${score10} • ${episodes} episodes`,
            genresLine.length ? genresLine.map((genre) => `\`${genre}\``).join(" ") : "`General`",
          ].join("\n"),
        )
        .addFields(
          { name: "Mood", value: moodLabel(mood), inline: true },
          { name: "Match", value: `${match}% Match`, inline: true },
          { name: "Why this pick", value: reason, inline: false },
        )
        .setFooter({ text: "光 Hikari" });

      const cover = pick?.coverImage?.large || pick?.coverImage?.medium;
      if (cover) embed.setThumbnail(cover);

      const trailerUrl = buildTrailerUrl(pick);
      await respond(interaction, { embeds: [embed], components: [recommendationButtons(pick, trailerUrl)] });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to fetch recommendations.");
    }
  },
};

const randomCommand = {
  data: new SlashCommandBuilder()
    .setName("random")
    .setDescription("Get a random anime recommendation.")
    .addStringOption((option) => option.setName("tag").setDescription("Genre or tag filter")),
  async execute(interaction) {
    const tag = interaction.options.getString("tag");
    try {
      const pool = await getRecommendationPool({ genres: tag ? [tag] : [], tags: tag ? [tag] : [], perPage: 25 });
      if (!pool.length) {
        await replyError(interaction, "No random result for that tag.", { title: "No Results" });
        return;
      }

      const pick = pool[Math.floor(Math.random() * pool.length)];
      const embed = buildAnimeEmbed(pick).setDescription(
        tag
          ? `${cleanText(pick?.description, 140)}\n\nTag: **${tag}**`
          : cleanText(pick?.description, 160) || "Random recommendation.",
      );
      const trailerUrl = buildTrailerUrl(pick);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Add to List").setURL(`${config.hikariWebBaseUrl}/media/${pick.id}`),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Another Random").setURL(`${config.hikariWebBaseUrl}/discover`),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Trailer").setURL(trailerUrl || pick?.siteUrl || "https://anilist.co"),
      );
      await respond(interaction, { embeds: [embed], components: [row] });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to fetch random anime.");
    }
  },
};

const compareCommand = {
  data: new SlashCommandBuilder()
    .setName("compare")
    .setDescription("Compare your taste with another linked user.")
    .addUserOption((option) => option.setName("user").setDescription("Discord user to compare with").setRequired(true)),
  async execute(interaction) {
    const targetUser = interaction.options.getUser("user", true);
    try {
      const selfTarget = await resolveTarget({
        requesterDiscordId: interaction.user.id,
        requireLinkedSelf: true,
      });
      if (!selfTarget.ok) {
        await replyError(interaction, selfTarget.message);
        return;
      }

      const otherTarget = await resolveTarget({
        requesterDiscordId: interaction.user.id,
        mentionDiscordId: targetUser.id,
      });
      if (!otherTarget.ok) {
        await replyError(interaction, otherTarget.message);
        return;
      }

      const selfEntries = await getListEntriesByUser(selfTarget.target.hikariUserId, { limit: 200 });
      const otherEntries = await getListEntriesByUser(otherTarget.target.hikariUserId, { limit: 200 });

      const selfMediaIds = new Set(selfEntries.map((row) => Number(row.media_id)));
      const sharedIds = otherEntries.map((row) => Number(row.media_id)).filter((id) => selfMediaIds.has(id));
      const sampledShared = sharedIds.slice(0, 30);
      const sharedMedia = sampledShared.length ? await getAnimeByIds(sampledShared) : [];

      const selfGenres = new Set((await getTopGenres(selfEntries, 5)).map((item) => item.toLowerCase()));
      const otherTopGenres = await getTopGenres(otherEntries, 5);
      const overlap = otherTopGenres.filter((genre) => selfGenres.has(genre.toLowerCase()));

      // Deterministic affinity: how much of the smaller list is shared (70%)
      // plus top-genre overlap (30%).
      const smallerList = Math.max(1, Math.min(selfEntries.length, otherEntries.length));
      const sharedRatio = Math.min(1, sharedIds.length / smallerList);
      const genreRatio = otherTopGenres.length ? overlap.length / otherTopGenres.length : 0;
      const compatibility = Math.round(sharedRatio * 70 + genreRatio * 30);
      const avgSelf = sharedMedia.length
        ? sharedMedia.reduce((sum, media) => sum + Number(media?.averageScore || 0), 0) / sharedMedia.length / 10
        : 0;
      const avgOther = avgSelf;

      const selfName = selfTarget.target.profile?.display_name || selfTarget.target.handle || interaction.user.username;
      const otherName = otherTarget.target.profile?.display_name || otherTarget.target.handle || targetUser.username;
      const topGenre = overlap[0] || (otherTopGenres[0] || "Action");

      const embed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle("Taste Comparison")
        .setDescription(
          [
            `**${selfName}** vs **${otherName}**`,
            `Compatibility ${compatibility}%`,
            `\`${progressBar(compatibility)}\``,
          ].join("\n"),
        )
        .addFields(
          { name: "Shared", value: String(sharedIds.length), inline: true },
          { name: "Avg vs", value: `${avgSelf.toFixed(1)} vs ${avgOther.toFixed(1)}`, inline: true },
          { name: "Top Genre", value: topGenre, inline: true },
        )
        .setFooter({ text: "光 Hikari" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("View Shared Anime").setURL(`${config.hikariWebBaseUrl}/discover`),
      );
      await respond(interaction, { embeds: [embed], components: [row] });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to compare users.");
    }
  },
};

// One /discover command instead of separate /recommend + /random - fewer
// top-level commands keeps the bot easy to scan. /compare lives under /stats.
const discoverCommand = {
  data: new SlashCommandBuilder()
    .setName("discover")
    .setDescription("Find something to watch.")
    .addSubcommand((sub) =>
      sub
        .setName("recommend")
        .setDescription("Personalized anime recommendations.")
        .addStringOption((option) =>
          option
            .setName("mood")
            .setDescription("Recommendation mood")
            .addChoices(
              { name: "Chill", value: "chill" },
              { name: "Hype", value: "hype" },
              { name: "Dark", value: "dark" },
              { name: "Funny", value: "funny" },
              { name: "Romance", value: "romance" },
            ),
        )
        .addStringOption((option) => option.setName("tags").setDescription("Comma-separated tags")),
    )
    .addSubcommand((sub) =>
      sub
        .setName("random")
        .setDescription("Get a random anime pick.")
        .addStringOption((option) => option.setName("tag").setDescription("Genre or tag filter")),
    ),
  async execute(interaction) {
    return interaction.options.getSubcommand() === "random"
      ? randomCommand.execute(interaction)
      : recommendCommand.execute(interaction);
  },
};

export { compareCommand };
export const discoverCommands = [discoverCommand];

