import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getAnimeByIds, mediaTitle, searchAnime } from "../lib/anilist.js";
import { listUrl } from "../lib/embeds.js";
import { normalizeStatusForDisplay, normalizeStatusInput, statusChoices } from "../lib/status.js";
import { supabase } from "../lib/supabase.js";
import { getLinkByDiscordId } from "../services/links.js";
import { buildListPreview, getListEntriesByUser } from "../services/profiles.js";
import { resolveTarget } from "../services/targets.js";
import { replyError, replySuccess, respond } from "../lib/interaction.js";

const listTable = "list_entries";
const lastActions = new Map();
const trackingPrefix = "hikari_tracking";

const rememberUndo = (discordUserId, action) => {
  lastActions.set(String(discordUserId), action);
};

const requireLinkedUser = async (interaction) => {
  const link = await getLinkByDiscordId(interaction.user.id);
  if (!link?.hikari_user_id) {
    await replyError(interaction, "Your account is not linked. Use `/link` first.");
    return null;
  }
  return link;
};

const getEntryByMediaId = async (hikariUserId, mediaId) => {
  const { data, error } = await supabase
    .from(listTable)
    .select("id, user_id, media_id, media_type, status, progress, updated_at")
    .eq("user_id", String(hikariUserId))
    .eq("media_id", Number(mediaId))
    .maybeSingle();
  if (error) throw error;
  return data;
};

const upsertEntry = async ({ hikariUserId, mediaId, status, progress, before }) => {
  if (!before) {
    const { data, error } = await supabase
      .from(listTable)
      .insert({
        user_id: String(hikariUserId),
        media_id: Number(mediaId),
        media_type: "ANIME",
        status,
        progress,
      })
      .select("id, user_id, media_id, media_type, status, progress, updated_at")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from(listTable)
    .update({ status, progress, media_type: "ANIME" })
    .eq("id", before.id)
    .select("id, user_id, media_id, media_type, status, progress, updated_at")
    .single();

  if (error) throw error;
  return data;
};

const restoreSnapshot = async (snapshot) => {
  if (!snapshot) return;
  const { error } = await supabase.from(listTable).upsert(snapshot, { onConflict: "user_id,media_id" });
  if (error) throw error;
};

const findAnimeForCommand = async (queryText) => {
  const media = await searchAnime(queryText);
  if (!media) {
    throw new Error(`Could not find anime for "${queryText}".`);
  }
  return media;
};

const progressBar = (value, total, width = 14) => {
  if (!Number.isFinite(total) || total <= 0) return "No episode total available";
  const pct = Math.max(0, Math.min(1, Number(value || 0) / total));
  const filled = Math.round(pct * width);
  return `[${"#".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}] ${Math.round(pct * 100)}%`;
};

const buildProgressActionRow = (mediaId) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${trackingPrefix}:undo`)
      .setLabel("Undo")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${trackingPrefix}:plusone:${Number(mediaId)}`)
      .setLabel("+1 Episode")
      .setStyle(ButtonStyle.Primary),
  );

const buildProgressEmbed = ({ media, progress, status }) => {
  const totalEpisodes = Number(media?.episodes || 0);
  const value = Number(progress || 0);
  const remaining = totalEpisodes > 0 ? Math.max(0, totalEpisodes - value) : null;
  const pct = totalEpisodes > 0 ? Math.round((value / totalEpisodes) * 100) : null;
  const cover = media?.coverImage?.medium || media?.coverImage?.large || null;

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("Progress Updated")
    .setDescription(
      [
        `**${mediaTitle(media)}**`,
        totalEpisodes > 0 ? `Episode ${value} / ${totalEpisodes}` : `Episode ${value}`,
      ].join("\n"),
    )
    .addFields(
      { name: "STATUS", value: normalizeStatusForDisplay(status), inline: true },
      { name: "COMPLETE", value: pct === null ? "Unknown" : `${pct}%`, inline: true },
      { name: "Progress", value: progressBar(value, totalEpisodes), inline: false },
      {
        name: "REMAINING",
        value: remaining === null ? "Unknown" : `${remaining} episode(s) left`,
        inline: true,
      },
    )
    .setFooter({ text: "光 Hikari" })
    .setTimestamp();
  if (cover) {
    embed.setThumbnail(cover);
  }
  return embed;
};

const applyPlusOne = async ({ hikariUserId, media, existing }) => {
  const before = existing ? { ...existing } : null;
  const currentProgress = Number(existing?.progress || 0);
  const nextProgress = currentProgress + 1;
  let nextStatus = existing?.status || "watching";
  if (media.episodes && nextProgress >= media.episodes) {
    nextStatus = "completed";
  } else if (nextStatus === "plan_to_watch") {
    nextStatus = "watching";
  }

  const updated = await upsertEntry({
    hikariUserId,
    mediaId: media.id,
    status: nextStatus,
    progress: nextProgress,
    before: existing,
  });

  return { before, updated, nextProgress, nextStatus };
};

const runUndo = async (interaction) => {
  const action = lastActions.get(String(interaction.user.id));
  if (!action) {
    await replyError(interaction, "Nothing to undo.");
    return;
  }

  if (action.type === "restore_entry") {
    if (!action.before) {
      const { error } = await supabase
        .from(listTable)
        .delete()
        .eq("user_id", String(action.hikariUserId))
        .eq("media_id", Number(action.mediaId));
      if (error) throw error;
    } else {
      await restoreSnapshot(action.before);
    }
  } else if (action.type === "restore_deleted") {
    await restoreSnapshot(action.row);
  } else {
    await replyError(interaction, "Last action cannot be undone.");
    return;
  }

  lastActions.delete(String(interaction.user.id));
  let reverted = "Recent change";
  let restored = "Previous state restored";
  if (action.type === "restore_entry") {
    reverted = action.before ? `Update media #${action.mediaId}` : `Add media #${action.mediaId}`;
    if (action.before) {
      restored = `${normalizeStatusForDisplay(action.before.status)} - Ep ${Number(action.before.progress || 0)}`;
    } else {
      restored = "Entry removed";
    }
  } else if (action.type === "restore_deleted") {
    reverted = `Remove media #${action.row?.media_id || "unknown"}`;
    restored = `${normalizeStatusForDisplay(action.row?.status || "watching")} - Ep ${Number(action.row?.progress || 0)}`;
  }

  const undoEmbed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("Action Undone")
    .setDescription("Your last tracking change has been reverted.")
    .addFields(
      { name: "Reverted", value: reverted, inline: true },
      { name: "Restored", value: restored, inline: true },
    )
    .setFooter({ text: "光 Hikari" })
    .setTimestamp();
  await respond(interaction, { embeds: [undoEmbed] });
};

const watchStatusChoices = statusChoices.map((choice) => ({
  name: choice.name,
  value: choice.value,
}));

const watchingCommand = {
  data: new SlashCommandBuilder()
    .setName("watching")
    .setDescription("Show currently watched anime for yourself, a Hikari username, or linked @user.")
    .addUserOption((option) => option.setName("user").setDescription("Linked Discord user"))
    .addStringOption((option) => option.setName("username").setDescription("Hikari username")),
  async execute(interaction) {
    const userOpt = interaction.options.getUser("user");
    const usernameOpt = interaction.options.getString("username");

    try {
      const targetResult = await resolveTarget({
        requesterDiscordId: interaction.user.id,
        mentionDiscordId: userOpt?.id,
        username: usernameOpt,
      });

      if (!targetResult.ok) {
        await replyError(interaction, targetResult.message);
        return;
      }

      const { hikariUserId, handle, profile } = targetResult.target;
      const entries = await getListEntriesByUser(hikariUserId, {
        statuses: ["watching", "rewatching"],
        limit: 200,
      });
      const preview = await buildListPreview(entries, 5);
      const lines = preview.map((item, index) => `${index + 1}. ${item.title} - Ep ${item.progress}`);
      const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const episodesThisWeek = (entries || [])
        .filter((entry) => new Date(entry.updated_at || 0).getTime() >= weekCutoff)
        .reduce((sum, entry) => sum + Number(entry.progress || 0), 0);
      const displayHandle = handle ? `@${handle}` : "User";
      const displayName = profile?.display_name || handle || "Hikari User";
      const avatarUrl = profile?.avatar_url || null;

      const embed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle("Currently Watching")
        .setDescription(
          [
            `${displayHandle}`,
            lines.length ? lines.join("\n") : "No active watching entries.",
          ].join("\n\n"),
        )
        .addFields(
          { name: "TOTAL SHOWS", value: String(entries.length), inline: true },
          { name: "EPISODES THIS WEEK", value: String(episodesThisWeek), inline: true },
        )
        .setFooter({ text: "光 Hikari" })
        .setTimestamp();
      if (avatarUrl) {
        embed.setAuthor({ name: displayName, iconURL: avatarUrl });
      }
      const components = [];
      if (handle) {
        components.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("View Full List").setURL(listUrl(handle)),
          ),
        );
      }

      await respond(interaction, { embeds: [embed], components });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to load watching list.");
    }
  },
};

const addCommand = {
  data: new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add an anime to your list (defaults to Planned).")
    .addStringOption((option) => option.setName("anime").setDescription("Anime title").setRequired(true)),
  async execute(interaction) {
    const animeInput = interaction.options.getString("anime", true);
    const link = await requireLinkedUser(interaction);
    if (!link) return;

    try {
      const media = await findAnimeForCommand(animeInput);
      const existing = await getEntryByMediaId(link.hikari_user_id, media.id);
      if (existing) {
        await replyError(interaction, `${mediaTitle(media)} is already in your list.`);
        return;
      }

      const created = await upsertEntry({
        hikariUserId: link.hikari_user_id,
        mediaId: media.id,
        status: "plan_to_watch",
        progress: 0,
        before: null,
      });

      rememberUndo(interaction.user.id, {
        type: "restore_entry",
        hikariUserId: link.hikari_user_id,
        mediaId: media.id,
        before: null,
        after: created,
      });

      await replySuccess(interaction, `**${mediaTitle(media)}** was added as **Planned**.`, {
        title: "Added to List",
      });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to add anime.");
    }
  },
};

const statusCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Set list status for an anime.")
    .addStringOption((option) => option.setName("anime").setDescription("Anime title").setRequired(true))
    .addStringOption((option) =>
      option
        .setName("state")
        .setDescription("New status")
        .setRequired(true)
        .addChoices(...watchStatusChoices),
    ),
  async execute(interaction) {
    const animeInput = interaction.options.getString("anime", true);
    const stateInput = normalizeStatusInput(interaction.options.getString("state", true));
    const link = await requireLinkedUser(interaction);
    if (!link) return;

    try {
      const media = await findAnimeForCommand(animeInput);
      const existing = await getEntryByMediaId(link.hikari_user_id, media.id);
      const before = existing ? { ...existing } : null;
      const progress = existing?.progress || 0;

      const updated = await upsertEntry({
        hikariUserId: link.hikari_user_id,
        mediaId: media.id,
        status: stateInput,
        progress,
        before: existing,
      });

      rememberUndo(interaction.user.id, {
        type: "restore_entry",
        hikariUserId: link.hikari_user_id,
        mediaId: media.id,
        before,
        after: updated,
      });

      const statusEmbed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("Status Updated")
        .setDescription(`**${mediaTitle(media)}** has been marked as **${normalizeStatusForDisplay(stateInput)}**.`)
        .addFields(
          { name: "Previous", value: normalizeStatusForDisplay(before?.status || "plan_to_watch"), inline: true },
          { name: "New Status", value: normalizeStatusForDisplay(stateInput), inline: true },
        )
        .setFooter({ text: "光 Hikari" })
        .setTimestamp();

      await respond(interaction, { embeds: [statusEmbed] });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to update status.");
    }
  },
};

const progressCommand = {
  data: new SlashCommandBuilder()
    .setName("progress")
    .setDescription("Set episode progress for an anime.")
    .addStringOption((option) => option.setName("anime").setDescription("Anime title").setRequired(true))
    .addIntegerOption((option) =>
      option.setName("number").setDescription("Episode progress number").setRequired(true).setMinValue(0),
    ),
  async execute(interaction) {
    const animeInput = interaction.options.getString("anime", true);
    const progressValue = interaction.options.getInteger("number", true);
    const link = await requireLinkedUser(interaction);
    if (!link) return;

    try {
      const media = await findAnimeForCommand(animeInput);
      const existing = await getEntryByMediaId(link.hikari_user_id, media.id);
      const before = existing ? { ...existing } : null;

      let nextStatus = existing?.status || "watching";
      if (media.episodes && progressValue >= media.episodes) {
        nextStatus = "completed";
      } else if (nextStatus === "plan_to_watch" && progressValue > 0) {
        nextStatus = "watching";
      }

      const updated = await upsertEntry({
        hikariUserId: link.hikari_user_id,
        mediaId: media.id,
        status: nextStatus,
        progress: progressValue,
        before: existing,
      });

      rememberUndo(interaction.user.id, {
        type: "restore_entry",
        hikariUserId: link.hikari_user_id,
        mediaId: media.id,
        before,
        after: updated,
      });

      const embed = buildProgressEmbed({ media, progress: progressValue, status: nextStatus });
      const row = buildProgressActionRow(media.id);
      await respond(interaction, { embeds: [embed], components: [row] });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to update progress.");
    }
  },
};

const plusOneCommand = {
  data: new SlashCommandBuilder()
    .setName("plusone")
    .setDescription("Increment episode progress by +1.")
    .addStringOption((option) => option.setName("anime").setDescription("Anime title (optional)")),
  async execute(interaction) {
    const animeInput = interaction.options.getString("anime");
    const link = await requireLinkedUser(interaction);
    if (!link) return;

    try {
      let media = null;
      let existing = null;
      if (animeInput) {
        media = await findAnimeForCommand(animeInput);
        existing = await getEntryByMediaId(link.hikari_user_id, media.id);
      } else {
        const [latestWatching] = await getListEntriesByUser(link.hikari_user_id, {
          statuses: ["watching", "rewatching"],
          limit: 1,
        });
        if (!latestWatching) {
          await replyError(interaction, "No active watching entry found. Pass an anime name with `/plusone <anime>`.");
          return;
        }
        const mediaList = await getAnimeByIds([latestWatching.media_id]);
        media = mediaList?.[0] || null;
        existing = latestWatching;
      }

      if (!media) {
        await replyError(interaction, "Could not resolve anime for plus one.");
        return;
      }

      const { before, updated, nextProgress, nextStatus } = await applyPlusOne({
        hikariUserId: link.hikari_user_id,
        media,
        existing,
      });

      rememberUndo(interaction.user.id, {
        type: "restore_entry",
        hikariUserId: link.hikari_user_id,
        mediaId: media.id,
        before,
        after: updated,
      });

      const embed = buildProgressEmbed({ media, progress: nextProgress, status: nextStatus });
      const row = buildProgressActionRow(media.id);
      await respond(interaction, { embeds: [embed], components: [row] });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to increment progress.");
    }
  },
};

const removeCommand = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove an anime from your list.")
    .addStringOption((option) => option.setName("anime").setDescription("Anime title").setRequired(true)),
  async execute(interaction) {
    const animeInput = interaction.options.getString("anime", true);
    const link = await requireLinkedUser(interaction);
    if (!link) return;

    try {
      const media = await findAnimeForCommand(animeInput);
      const existing = await getEntryByMediaId(link.hikari_user_id, media.id);
      if (!existing) {
        await replyError(interaction, `${mediaTitle(media)} is not currently in your list.`, { title: "Not Found" });
        return;
      }

      const before = { ...existing };
      const { error } = await supabase.from(listTable).delete().eq("id", existing.id);
      if (error) throw error;

      rememberUndo(interaction.user.id, {
        type: "restore_deleted",
        row: before,
      });
      const removedEmbed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("Anime Removed")
        .setDescription(`**${mediaTitle(media)}** has been removed from your list.`)
        .addFields(
          { name: "EPISODES WATCHED", value: String(before.progress || 0), inline: true },
          { name: "PREVIOUS STATUS", value: normalizeStatusForDisplay(before.status), inline: true },
          { name: "Undo", value: "Use `/undo` to restore this entry.", inline: false },
        )
        .setFooter({ text: "光 Hikari" })
        .setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${trackingPrefix}:undo`).setLabel("Undo").setStyle(ButtonStyle.Secondary),
      );
      await respond(interaction, { embeds: [removedEmbed], components: [row] });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to remove anime.");
    }
  },
};

const undoCommand = {
  data: new SlashCommandBuilder().setName("undo").setDescription("Undo your last tracking mutation."),
  async execute(interaction) {
    try {
      await runUndo(interaction);
    } catch (error) {
      await replyError(interaction, error?.message || "Undo failed.");
    }
  },
};

export const isTrackingComponent = (interaction) =>
  String(interaction.customId || "").startsWith(`${trackingPrefix}:`);

export const handleTrackingComponent = async (interaction) => {
  const [prefix, action, mediaIdRaw] = String(interaction.customId || "").split(":");
  if (prefix !== trackingPrefix) return false;

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    if (action === "undo") {
      await runUndo(interaction);
      return true;
    }

    if (action === "plusone") {
      const mediaId = Number(mediaIdRaw);
      if (!Number.isFinite(mediaId)) {
        await replyError(interaction, "Invalid media id.");
        return true;
      }

      const link = await requireLinkedUser(interaction);
      if (!link) return true;

      const mediaList = await getAnimeByIds([mediaId]);
      const media = mediaList?.[0] || null;
      if (!media) {
        await replyError(interaction, "Could not resolve this anime.");
        return true;
      }

      const existing = await getEntryByMediaId(link.hikari_user_id, media.id);
      const { before, updated, nextProgress, nextStatus } = await applyPlusOne({
        hikariUserId: link.hikari_user_id,
        media,
        existing,
      });

      rememberUndo(interaction.user.id, {
        type: "restore_entry",
        hikariUserId: link.hikari_user_id,
        mediaId: media.id,
        before,
        after: updated,
      });

      const embed = buildProgressEmbed({ media, progress: nextProgress, status: nextStatus });
      const row = buildProgressActionRow(media.id);
      await respond(interaction, { embeds: [embed], components: [row] });
      return true;
    }
  } catch (error) {
    await replyError(interaction, error?.message || "Tracking action failed.");
    return true;
  }

  return false;
};

export const trackingCommands = [
  watchingCommand,
  addCommand,
  statusCommand,
  progressCommand,
  plusOneCommand,
  undoCommand,
  removeCommand,
];
