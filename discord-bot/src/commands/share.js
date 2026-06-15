import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { buildAnimeEmbed, buildListButtons, buildListEmbed, buildProfileButtons, buildProfileEmbed } from "../lib/embeds.js";
import { replyError, respond } from "../lib/interaction.js";
import { searchAnime, buildTrailerUrl } from "../lib/anilist.js";
import { getListCounts, getListEntriesByUser, getTopGenres, buildWatchingLine, buildListPreview } from "../services/profiles.js";
import { resolveTarget } from "../services/targets.js";
import { config } from "../config.js";

const shareCommand = {
  data: new SlashCommandBuilder()
    .setName("share")
    .setDescription("Share Hikari data as Discord embeds.")
    .addSubcommand((sub) =>
      sub
        .setName("profile")
        .setDescription("Share a profile embed.")
        .addUserOption((option) => option.setName("user").setDescription("Linked Discord user"))
        .addStringOption((option) => option.setName("username").setDescription("Hikari username")),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Share a list embed.")
        .addStringOption((option) =>
          option
            .setName("status")
            .setDescription("List status")
            .setRequired(true)
            .addChoices(
              { name: "Watching", value: "watching" },
              { name: "Completed", value: "completed" },
              { name: "Planned", value: "plan_to_watch" },
            ),
        )
        .addUserOption((option) => option.setName("user").setDescription("Linked Discord user"))
        .addStringOption((option) => option.setName("username").setDescription("Hikari username")),
    )
    .addSubcommand((sub) =>
      sub
        .setName("anime")
        .setDescription("Share an anime embed.")
        .addStringOption((option) => option.setName("anime").setDescription("Anime title").setRequired(true)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand(true);

    if (sub === "anime") {
      const anime = interaction.options.getString("anime", true);
      try {
        const media = await searchAnime(anime);
        if (!media) {
          await replyError(interaction, "No anime found.");
          return;
        }

        const embed = buildAnimeEmbed(media);
        const trailerUrl = buildTrailerUrl(media);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Add to List")
            .setURL(`${config.hikariWebBaseUrl}/media/${media.id}`),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("View Details")
            .setURL(media.siteUrl || `${config.hikariWebBaseUrl}/media/${media.id}`),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Trailer")
            .setURL(trailerUrl || media.siteUrl || "https://anilist.co"),
        );

        await respond(interaction, { embeds: [embed], components: [row] });
      } catch (error) {
        await replyError(interaction, error?.message || "Failed to share anime.");
      }
      return;
    }

    const username = interaction.options.getString("username");
    const user = interaction.options.getUser("user");
    const resolved = await resolveTarget({
      requesterDiscordId: interaction.user.id,
      mentionDiscordId: user?.id,
      username,
    });

    if (!resolved.ok) {
      await replyError(interaction, resolved.message);
      return;
    }

    const { hikariUserId, handle, profile } = resolved.target;
    const displayName = profile?.display_name || profile?.handle || handle || "User";

    try {
      if (sub === "profile") {
        const entries = await getListEntriesByUser(hikariUserId, { limit: 200 });
        const counts = getListCounts(entries);
        const topGenres = await getTopGenres(entries, 3);
        const watchingLine = await buildWatchingLine(entries);
        const totalEpisodes = entries.reduce((sum, entry) => sum + Number(entry.progress || 0), 0);

        const embed = buildProfileEmbed({
          handle,
          displayName,
          avatarUrl: profile?.avatar_url || null,
          watchingLine,
          counts,
          topGenres,
          totalEpisodes,
        });
        const row = buildProfileButtons({ handle });
        await respond(interaction, { embeds: [embed], components: [row] });
        return;
      }

      if (sub === "list") {
        const status = interaction.options.getString("status", true);
        const entries = await getListEntriesByUser(hikariUserId, { statuses: [status], limit: 50 });
        const preview = await buildListPreview(entries, 10);
        const statusLabel =
          status === "plan_to_watch" ? "Planned" : status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");
        const embed = buildListEmbed({ handle, displayName, statusLabel, previewItems: preview });
        const row = buildListButtons({ handle });
        await respond(interaction, { embeds: [embed], components: [row] });
      }
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to share content.");
    }
  },
};

export const shareCommands = [shareCommand];
