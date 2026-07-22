import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { buildAnimeButtons, buildAnimeEmbed, buildInfoEmbed, embedColors, progressBar } from "../lib/embeds.js";
import { EMOJI, UNICODE } from "../lib/emojis.js";
import { replyError, respond } from "../lib/interaction.js";
import { getRecommendationPool, mediaTitle, searchAnime, buildTrailerUrl, getAnimeByIds } from "../lib/anilist.js";
import { getListEntriesByUser, getTopGenres } from "../services/profiles.js";
import { resolveTarget } from "../services/targets.js";
import { buildHikariUrl } from "../config.js";
import { supabase } from "../lib/supabase.js";
import { getLinkByDiscordId } from "../services/links.js";
import { UserSelectMenuBuilder } from "discord.js";

// Everything already on the user's list (any status) - recommendations
// should never suggest what they've seen or planned.
const getUserMediaIdSet = async (discordUserId) => {
  try {
    const link = await getLinkByDiscordId(discordUserId);
    if (!link?.hikari_user_id) return new Set();
    const { data } = await supabase.from("list_entries").select("media_id").eq("user_id", String(link.hikari_user_id));
    return new Set((data || []).map((row) => Number(row.media_id)));
  } catch {
    return new Set();
  }
};

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

const discoverPrefix = "hikari_discover";
const enc = (value) => encodeURIComponent(String(value || "")).slice(0, 55);

const recommendationButtons = (media, trailerUrl, { mood, tagsCsv } = {}) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${discoverPrefix}:rec:${enc(mood)}:${enc(tagsCsv)}`)
      .setLabel("Next Pick")
      .setEmoji(EMOJI.dice)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${discoverPrefix}:share:${Number(media.id)}`)
      .setLabel("Share")
      .setEmoji(EMOJI.megaphone)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${discoverPrefix}:add:${Number(media.id)}`)
      .setLabel("Add to List")
      .setEmoji(EMOJI.plus)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji(EMOJI.sparkle)
      .setLabel("Open on Hikari")
      .setURL(buildHikariUrl(`/discover?focus=${Number(media.id)}`, "recommendations")),
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
    return runRecommend(interaction, interaction.options.getString("mood"), interaction.options.getString("tags"));
  },
};

const runRecommend = async (interaction, mood, tagsCsv) => {
    const tags = parseTags(tagsCsv);
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

      const owned = await getUserMediaIdSet(interaction.user.id);
      const pool = (await getRecommendationPool({ genres, tags, perPage: 25 })).filter(
        (item) => !owned.has(Number(item.id)),
      );
      if (!pool.length) {
        await replyError(interaction, "No recommendations found for those filters.", { title: "No Results" });
        return;
      }

      const pick = pool[Math.floor(Math.random() * Math.min(pool.length, 5))];
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
        .setColor(embedColors.brand)
        .setTitle(mediaTitle(pick))
        .setURL(buildHikariUrl(`/media/${Number(pick.id)}`, "recommendations"))
        .setDescription(
          [
            `${EMOJI.star} **${score10}**  ·  ${episodes} episodes`,
            genresLine.length ? genresLine.map((genre) => `\`${genre}\``).join(" ") : null,
            "",
            `${EMOJI.target} **${match}% match** — ${reason}`,
            `-# Mood: ${moodLabel(mood)}`,
          ]
            .filter((line) => line !== null)
            .join("\n"),
        )
        .setFooter({ text: "光 Hikari" });

      const cover = pick?.coverImage?.large || pick?.coverImage?.medium;
      if (cover) embed.setThumbnail(cover);

      const trailerUrl = buildTrailerUrl(pick);
      await respond(interaction, { embeds: [embed], components: [recommendationButtons(pick, trailerUrl, { mood, tagsCsv })] });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to fetch recommendations.");
    }
};

const randomCommand = {
  data: new SlashCommandBuilder()
    .setName("random")
    .setDescription("Get a random anime recommendation.")
    .addStringOption((option) => option.setName("tag").setDescription("Genre or tag filter")),
  async execute(interaction) {
    return runRandom(interaction, interaction.options.getString("tag"));
  },
};

const runRandom = async (interaction, tag) => {
    try {
      const owned = await getUserMediaIdSet(interaction.user.id);
      const pool = (await getRecommendationPool({ genres: tag ? [tag] : [], tags: tag ? [tag] : [], perPage: 25 })).filter(
        (item) => !owned.has(Number(item.id)),
      );
      if (!pool.length) {
        await replyError(interaction, "No random result for that tag.", { title: "No Results" });
        return;
      }

      const pick = pool[Math.floor(Math.random() * pool.length)];
      const embed = buildAnimeEmbed(pick, { campaign: "recommendations" }).setAuthor({
        // Author text can't render custom emojis — unicode only here.
        name: tag ? `${UNICODE.dice} Random pick · ${tag}` : `${UNICODE.dice} Random pick`,
      });
      const trailerUrl = buildTrailerUrl(pick);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${discoverPrefix}:rand:${enc(tag)}`)
          .setLabel("Another Random")
          .setEmoji(EMOJI.dice)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${discoverPrefix}:share:${Number(pick.id)}`)
          .setLabel("Share")
          .setEmoji(EMOJI.megaphone)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${discoverPrefix}:add:${Number(pick.id)}`)
          .setLabel("Add to List")
          .setEmoji(EMOJI.plus)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setEmoji(EMOJI.sparkle)
          .setLabel("Open on Hikari")
          .setURL(buildHikariUrl(`/discover?focus=${Number(pick.id)}`, "recommendations")),
      );
      await respond(interaction, { embeds: [embed], components: [row] });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to fetch random anime.");
    }
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
        const displayName = targetUser.globalName || targetUser.username;
        const embed = buildInfoEmbed({
          title: `${displayName} is not on Hikari yet`,
          description: [
            "They need their own Hikari account before you can compare anime taste.",
            "They can create an account below, then run `/account` themselves to link it securely.",
            "Hikari never creates an account-linking URL for someone else.",
          ].join("\n\n"),
        });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Create a Hikari Account")
            .setEmoji(EMOJI.sparkle)
            .setURL(buildHikariUrl("/register", "sharing")),
        );
        await respond(interaction, { embeds: [embed], components: [row] });
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
        .setColor(embedColors.brand)
        .setTitle(`${UNICODE.sparkle} Taste Comparison`)
        .setDescription(
          [
            `**${selfName}** vs **${otherName}**`,
            "",
            `${progressBar(compatibility / 100, 12)}  **${compatibility}%** compatible`,
          ].join("\n"),
        )
        .addFields(
          { name: "Shared Titles", value: `**${sharedIds.length}**`, inline: true },
          { name: "Avg Rating", value: `${avgSelf.toFixed(1)} vs ${avgOther.toFixed(1)}`, inline: true },
          { name: "Top Genre", value: topGenre, inline: true },
        )
        .setFooter({ text: "光 Hikari" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("View Shared Anime")
          .setURL(buildHikariUrl("/discover", "sharing")),
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

export const isDiscoverComponent = (interaction) =>
  String(interaction.customId || "").startsWith(`${discoverPrefix}:`);

export const handleDiscoverComponent = async (interaction) => {
  const [, action, a, b] = String(interaction.customId || "").split(":");
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
  }
  if (action === "rand") {
    await runRandom(interaction, decodeURIComponent(a || "") || null);
    return true;
  }
  if (action === "rec") {
    await runRecommend(interaction, decodeURIComponent(a || "") || null, decodeURIComponent(b || "") || null);
    return true;
  }
  if (action === "share") {
    const mediaId = Number(a);
    if (!Number.isFinite(mediaId)) return true;
    const menu = new UserSelectMenuBuilder()
      .setCustomId(`${discoverPrefix}:sharedm:${mediaId}`)
      .setPlaceholder("Who should watch this?")
      .setMinValues(1)
      .setMaxValues(3);
    await interaction.followUp({
      content: "Pick who to send this to - I'll DM them the card.",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    }).catch(() => {});
    return true;
  }
  if (action === "sharedm") {
    const mediaId = Number(a);
    const [media] = (await getAnimeByIds([mediaId]).catch(() => [])) || [];
    if (!media) return true;
    let sent = 0;
    for (const userId of interaction.values || []) {
      try {
        const user = await interaction.client.users.fetch(userId);
        await user.send({
          content: `📣 <@${interaction.user.id}> thinks you should watch this:`,
          embeds: [buildAnimeEmbed(media, { campaign: "recommendations" })],
          components: [buildAnimeButtons(media, { campaign: "recommendations", includeInvite: true })],
        });
        sent += 1;
      } catch {
        /* DMs closed */
      }
    }
    const doneMsg = sent ? `Sent to ${sent} ${sent === 1 ? "person" : "people"} ✅` : "Couldn't DM them (their DMs are closed).";
    await interaction.editReply({ content: doneMsg, components: [] }).catch(() => {});
    return true;
  }
  if (action === "add") {
    const mediaId = Number(a);
    if (!Number.isFinite(mediaId)) return true;
    const link = await getLinkByDiscordId(interaction.user.id).catch(() => null);
    if (!link?.hikari_user_id) {
      await interaction.followUp({ content: "Link your account first with `/account`.", ephemeral: true }).catch(() => {});
      return true;
    }
    const { error } = await supabase.from("list_entries").upsert(
      { user_id: String(link.hikari_user_id), media_id: mediaId, media_type: "ANIME", status: "plan_to_watch", progress: 0 },
      { onConflict: "user_id,media_id", ignoreDuplicates: true },
    );
    const addMsg = error ? "Couldn't add that - try again." : "Added to your **Plan to Watch** ✅";
    await interaction.followUp({ content: addMsg, ephemeral: true }).catch(() => {});
    return true;
  }
  return false;
};

export { compareCommand };
export const discoverCommands = [discoverCommand];
