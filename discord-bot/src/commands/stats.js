import {
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { getAnimeByIds, mediaTitle } from "../lib/anilist.js";
import { embedColors } from "../lib/embeds.js";
import { EMOJI } from "../lib/emojis.js";
import { replyError, respond } from "../lib/interaction.js";
import { supabase } from "../lib/supabase.js";
import { countLinkedAccounts, getAllLinks, getLinkByDiscordId } from "../services/links.js";

const listTable = "list_entries";

const daysAgoIso = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const startOfTodayIso = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
};

const rankBadge = (index) => [EMOJI.gold, EMOJI.silver, EMOJI.bronze][index] || `**#${index + 1}**`;

const rankLine = (index, username, value, suffix) =>
  `${rankBadge(index)} @${username || "unknown"} — **${value}** ${suffix}`;

// Niko-style typographic card: big heading, meta subtext, body blocks.
const buildStatsCard = ({ heading, subtext, thumbnail, blocks }) => {
  const container = new ContainerBuilder().setAccentColor(embedColors.brand);
  const head = new TextDisplayBuilder().setContent(`# ${heading}\n-# ${subtext}`);
  if (thumbnail) {
    container.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(head).setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail)),
    );
  } else {
    container.addTextDisplayComponents(head);
  }
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  for (const block of blocks.filter(Boolean)) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block));
  }
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# 光 Hikari"));
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
};

const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Leaderboards, server stats, and taste comparisons.")
    .addSubcommand((sub) =>
      sub
        .setName("episodes")
        .setDescription("Leaderboard by episode progress updates.")
        .addStringOption((option) =>
          option
            .setName("period")
            .setDescription("Time range")
            .addChoices({ name: "Weekly", value: "weekly" }, { name: "Monthly", value: "monthly" }),
        ),
    )
    .addSubcommand((sub) => sub.setName("streak").setDescription("Approximate consistency streak leaderboard."))
    .addSubcommand((sub) => sub.setName("server").setDescription("High-level Hikari server stats.")),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand(true);
    if (sub === "server") return serverStatsCommand.execute(interaction);
    try {
      if (sub === "episodes") {
        const period = interaction.options.getString("period") || "weekly";
        const days = period === "monthly" ? 30 : 7;
        const cutoff = daysAgoIso(days);

        const [links, entriesResponse] = await Promise.all([
          getAllLinks(),
          supabase
            .from(listTable)
            .select("user_id, progress, updated_at")
            .eq("media_type", "ANIME")
            .gte("updated_at", cutoff)
            .order("updated_at", { ascending: false }),
        ]);

        if (entriesResponse.error) throw entriesResponse.error;
        const entries = entriesResponse.data || [];
        const usernameByUserId = new Map(links.map((row) => [String(row.hikari_user_id), row.hikari_username || "user"]));

        const scoreByUser = {};
        for (const row of entries) {
          const userId = String(row.user_id);
          scoreByUser[userId] = (scoreByUser[userId] || 0) + Number(row.progress || 0);
        }

        const top = Object.entries(scoreByUser)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        const topLines = top.map(([userId, score], idx) => rankLine(idx, usernameByUserId.get(userId), score, "eps"));

        const selfLink = await getLinkByDiscordId(interaction.user.id).catch(() => null);
        let selfLine = "Not ranked this period";
        if (selfLink?.hikari_user_id) {
          const allRanks = Object.entries(scoreByUser).sort((a, b) => b[1] - a[1]);
          const selfIndex = allRanks.findIndex(([userId]) => userId === String(selfLink.hikari_user_id));
          if (selfIndex >= 0) {
            selfLine = `#${selfIndex + 1} with ${allRanks[selfIndex][1]} eps`;
          }
        }

        await respond(
          interaction,
          buildStatsCard({
            heading: `${EMOJI.trophy} Episode Leaderboard`,
            subtext: period === "monthly" ? "This Month" : "This Week",
            blocks: [
              topLines.length ? topLines.join("\n") : "No episode activity in this period.",
              `-# Your position: ${selfLine}`,
            ],
          }),
        );
        return;
      }

      if (sub === "streak") {
        const [links, entriesResponse] = await Promise.all([
          getAllLinks(),
          supabase
            .from(listTable)
            .select("user_id, updated_at")
            .eq("media_type", "ANIME")
            .order("updated_at", { ascending: false })
            .limit(5000),
        ]);

        if (entriesResponse.error) throw entriesResponse.error;
        const entries = entriesResponse.data || [];
        const usernameByUserId = new Map(links.map((row) => [String(row.hikari_user_id), row.hikari_username || "user"]));

        const daysByUser = {};
        for (const row of entries) {
          const userId = String(row.user_id);
          const day = new Date(row.updated_at).toISOString().slice(0, 10);
          if (!daysByUser[userId]) daysByUser[userId] = new Set();
          daysByUser[userId].add(day);
        }

        const today = new Date().toISOString().slice(0, 10);
        const streakRows = Object.entries(daysByUser).map(([userId, daySet]) => {
          let streak = 0;
          const cursor = new Date(today);
          while (true) {
            const key = cursor.toISOString().slice(0, 10);
            if (!daySet.has(key)) break;
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
          }
          return [userId, streak];
        });

        const top = streakRows
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .filter((row) => row[1] > 0)
          .map(([userId, streak], idx) => rankLine(idx, usernameByUserId.get(userId), streak, "day(s)"));

        await respond(
          interaction,
          buildStatsCard({
            heading: `${EMOJI.fire} Streak Leaderboard`,
            subtext: "All Time",
            blocks: [top.length ? top.join("\n") : "No active streaks right now."],
          }),
        );
      }
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to load leaderboard.");
    }
  },
};

const serverStatsCommand = {
  data: new SlashCommandBuilder().setName("serverstats").setDescription("Show high-level Hikari bot stats."),
  async execute(interaction) {
    try {
      if (!interaction.guildId) {
        await replyError(interaction, "This command is only available in a server.");
        return;
      }

      const weekCutoff = daysAgoIso(7);
      const todayCutoff = startOfTodayIso();

      const [linkedCount, entriesCountResponse, links, weeklyEntriesResponse] = await Promise.all([
        countLinkedAccounts(),
        supabase.from(listTable).select("id", { count: "exact", head: true }),
        getAllLinks(),
        supabase
          .from(listTable)
          .select("user_id, media_id, progress, updated_at")
          .eq("media_type", "ANIME")
          .gte("updated_at", weekCutoff)
          .order("updated_at", { ascending: false }),
      ]);

      if (entriesCountResponse.error) throw entriesCountResponse.error;
      if (weeklyEntriesResponse.error) throw weeklyEntriesResponse.error;

      const entriesCount = entriesCountResponse.count || 0;
      const weeklyEntries = weeklyEntriesResponse.data || [];
      const episodesThisWeek = weeklyEntries.reduce((sum, row) => sum + Number(row.progress || 0), 0);
      const activeTodayUsers = new Set(
        weeklyEntries
          .filter((row) => new Date(row.updated_at || 0).toISOString() >= todayCutoff)
          .map((row) => String(row.user_id)),
      );

      const scoreByUser = {};
      const countByMedia = {};
      for (const row of weeklyEntries) {
        const userId = String(row.user_id);
        const mediaId = Number(row.media_id);
        scoreByUser[userId] = (scoreByUser[userId] || 0) + Number(row.progress || 0);
        countByMedia[mediaId] = (countByMedia[mediaId] || 0) + 1;
      }

      const topUserEntry = Object.entries(scoreByUser).sort((a, b) => b[1] - a[1])[0] || null;
      const usernameByUserId = new Map(links.map((row) => [String(row.hikari_user_id), row.hikari_username || "unknown"]));
      const topUserText = topUserEntry
        ? `@${usernameByUserId.get(topUserEntry[0]) || "unknown"} — **${topUserEntry[1]}** eps this week`
        : "No weekly activity";

      const topAnimeIds = Object.entries(countByMedia)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => Number(id));
      const topAnimeMedia = topAnimeIds.length ? await getAnimeByIds(topAnimeIds) : [];
      const mediaById = new Map(topAnimeMedia.map((m) => [Number(m.id), m]));
      const topAnimeLines = topAnimeIds
        .map((id, index) => `${rankBadge(index)} ${mediaTitle(mediaById.get(id))}`)
        .join("\n");

      await respond(
        interaction,
        buildStatsCard({
          heading: `${EMOJI.library} Server Stats`,
          subtext: `${interaction.guild?.name || "Server"} · past 7 days`,
          thumbnail: interaction.guild?.iconURL?.({ size: 128 }) || null,
          blocks: [
            [
              `**${Number(interaction.guild?.memberCount || 0).toLocaleString()}** members  ·  **${Number(linkedCount).toLocaleString()}** linked  ·  **${activeTodayUsers.size.toLocaleString()}** active today`,
              `${EMOJI.episodes} **${episodesThisWeek.toLocaleString()}** episodes watched this week`,
            ].join("\n"),
            `**${EMOJI.fire} Top Anime**\n${topAnimeLines || "No weekly anime data"}`,
            `**${EMOJI.trophy} Most Active**\n${topUserText}`,
          ],
        }),
      );
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to load server stats.");
    }
  },
};

export const statsCommands = [leaderboardCommand];
