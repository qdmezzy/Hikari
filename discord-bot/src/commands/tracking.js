import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { config } from "../config.js";
import { getAnimeByIds, mediaTitle, searchAnime } from "../lib/anilist.js";
import { buildListView, embedColors, progressBar } from "../lib/embeds.js";
import { EMOJI, UNICODE } from "../lib/emojis.js";
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
    await replyError(interaction, "Your account is not linked. Use `/account` first.");
    return null;
  }
  return link;
};

const getEntryByMediaId = async (hikariUserId, mediaId) => {
  const { data, error } = await supabase
    .from(listTable)
    .select("id, user_id, media_id, media_type, status, progress, score, updated_at")
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

const buildProgressActionRow = (mediaId) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${trackingPrefix}:undo`)
      .setEmoji(EMOJI.rewatching)
      .setLabel("Undo")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${trackingPrefix}:plusone:${Number(mediaId)}`)
      .setEmoji(EMOJI.watching)
      .setLabel("+1 Episode")
      .setStyle(ButtonStyle.Primary),
  );

const shareCardUrl = (mediaId) => `${config.hikariWebBaseUrl}/media/${Number(mediaId)}/opengraph-image`;

// 1-10 rating buttons shown when a title is completed without a score.
const buildRatingRows = (mediaId) => {
  const button = (score) =>
    new ButtonBuilder()
      .setCustomId(`${trackingPrefix}:rate:${Number(mediaId)}:${score}`)
      .setLabel(String(score))
      .setStyle(score >= 8 ? ButtonStyle.Primary : ButtonStyle.Secondary);
  return [
    new ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map(button)),
    new ActionRowBuilder().addComponents([6, 7, 8, 9, 10].map(button)),
  ];
};

const buildCompletionPayload = ({ media, entry }) => {
  const embed = new EmbedBuilder()
    .setColor(embedColors.brand)
    .setTitle("Completed!")
    .setDescription(
      [
        // EMOJI.party lives here, not the title — descriptions render custom emojis.
        `${EMOJI.party} **${mediaTitle(media)}** — all ${Number(media?.episodes || entry?.progress || 0) || ""} episodes done.`.replace("  ", " "),
        "",
        "How was it? **Rate it below** (ノ◕ヮ◕)ノ*:・゚✧",
      ].join("\n"),
    )
    .setImage(shareCardUrl(media.id))
    .setFooter({ text: "光 Hikari" })
    .setTimestamp();
  return { embeds: [embed], components: [buildProgressActionRow(media.id), ...buildRatingRows(media.id)] };
};

const buildProgressEmbed = ({ media, progress, status }) => {
  const totalEpisodes = Number(media?.episodes || 0);
  // Clamp: split-cour data can leave progress past the listed total.
  const value = totalEpisodes > 0 ? Math.min(Number(progress || 0), totalEpisodes) : Number(progress || 0);
  const remaining = totalEpisodes > 0 ? Math.max(0, totalEpisodes - value) : null;
  const pct = totalEpisodes > 0 ? Math.min(100, Math.round((value / totalEpisodes) * 100)) : null;
  const cover = media?.coverImage?.medium || media?.coverImage?.large || null;

  const metaBits = [normalizeStatusForDisplay(status)];
  if (remaining !== null) metaBits.push(remaining === 0 ? "All caught up" : `${remaining} episode${remaining === 1 ? "" : "s"} left`);

  const embed = new EmbedBuilder()
    .setColor(embedColors.success)
    .setTitle(`${UNICODE.episodes} Progress Updated`)
    .setDescription(
      [
        `**${mediaTitle(media)}**`,
        totalEpisodes > 0
          ? `${progressBar(value / totalEpisodes, 12)}  **${value} / ${totalEpisodes}** · ${pct}%`
          : `Episode **${value}**`,
        "",
        `-# ${metaBits.join(" · ")}`,
      ].join("\n"),
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
    .setColor(embedColors.success)
    .setTitle(`${UNICODE.rewatching} Action Undone`)
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

// ---- Subcommand handlers ----------------------------------------------

const handleShow = async (interaction) => {
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
    const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const episodesThisWeek = (entries || [])
      .filter((entry) => new Date(entry.updated_at || 0).getTime() >= weekCutoff)
      .reduce((sum, entry) => sum + Number(entry.progress || 0), 0);
    const displayName = profile?.display_name || handle || "Hikari User";
    const statsLine = `${entries.length} show${entries.length === 1 ? "" : "s"} · ${episodesThisWeek} eps this week`;

    await respond(
      interaction,
      buildListView({ handle, displayName, statusLabel: "Watching", previewItems: preview, statsLine }),
    );
  } catch (error) {
    await replyError(interaction, error?.message || "Failed to load watching list.");
  }
};

const handleAdd = async (interaction) => {
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
};

const handleStatus = async (interaction) => {
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

    if (String(stateInput) === "completed" && !Number(before?.score || 0)) {
      await respond(interaction, buildCompletionPayload({ media, entry: updated }));
      return;
    }

    const statusEmbed = new EmbedBuilder()
      .setColor(embedColors.success)
      .setTitle(`${UNICODE.check} Status Updated`)
      .setDescription(
        [
          `**${mediaTitle(media)}**`,
          `-# ${normalizeStatusForDisplay(before?.status || "plan_to_watch")} → **${normalizeStatusForDisplay(stateInput)}**`,
        ].join("\n"),
      )
      .setFooter({ text: "光 Hikari" })
      .setTimestamp();

    await respond(interaction, { embeds: [statusEmbed] });
  } catch (error) {
    await replyError(interaction, error?.message || "Failed to update status.");
  }
};

const handleProgress = async (interaction) => {
  const animeInput = interaction.options.getString("anime", true);
  const progressValue = interaction.options.getInteger("episode", true);
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

    if (nextStatus === "completed" && !Number(existing?.score || 0)) {
      await respond(interaction, buildCompletionPayload({ media, entry: updated }));
    } else {
      const embed = buildProgressEmbed({ media, progress: progressValue, status: nextStatus });
      const row = buildProgressActionRow(media.id);
      await respond(interaction, { embeds: [embed], components: [row] });
    }
  } catch (error) {
    await replyError(interaction, error?.message || "Failed to update progress.");
  }
};

const handleNext = async (interaction) => {
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
        await replyError(interaction, "No active watching entry found. Try `/list next anime:<title>`.");
        return;
      }
      const mediaList = await getAnimeByIds([latestWatching.media_id]);
      media = mediaList?.[0] || null;
      existing = latestWatching;
    }

    if (!media) {
      await replyError(interaction, "Could not resolve anime for the next episode.");
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

    if (nextStatus === "completed" && !Number(existing?.score || 0)) {
      await respond(interaction, buildCompletionPayload({ media, entry: updated }));
    } else {
      const embed = buildProgressEmbed({ media, progress: nextProgress, status: nextStatus });
      const row = buildProgressActionRow(media.id);
      await respond(interaction, { embeds: [embed], components: [row] });
    }
  } catch (error) {
    await replyError(interaction, error?.message || "Failed to increment progress.");
  }
};

const handleRemove = async (interaction) => {
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
      .setColor(embedColors.warning)
      .setTitle(`${UNICODE.dropped} Anime Removed`)
      .setDescription(
        [
          `**${mediaTitle(media)}** has been removed from your list.`,
          `-# ${normalizeStatusForDisplay(before.status)} · Ep ${Number(before.progress || 0)}`,
          "",
          "Changed your mind? Tap **Undo** below to restore it.",
        ].join("\n"),
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
};

// ---- One /list command with subcommands -------------------------------

const listCommand = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("Manage and view your Hikari anime list.")
    .addSubcommand((s) =>
      s
        .setName("show")
        .setDescription("Show what you (or someone) are currently watching.")
        .addUserOption((o) => o.setName("user").setDescription("Linked Discord user"))
        .addStringOption((o) => o.setName("username").setDescription("Hikari username")),
    )
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Add an anime to your list (defaults to Planned).")
        .addStringOption((o) => o.setName("anime").setDescription("Anime title").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("next")
        .setDescription("Watch the next episode (+1). Defaults to your latest show.")
        .addStringOption((o) => o.setName("anime").setDescription("Anime title (optional)")),
    )
    .addSubcommand((s) =>
      s
        .setName("update")
        .setDescription("Set episode progress for an anime.")
        .addStringOption((o) => o.setName("anime").setDescription("Anime title").setRequired(true))
        .addIntegerOption((o) =>
          o.setName("episode").setDescription("Episode number").setRequired(true).setMinValue(0),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("status")
        .setDescription("Set the status of an anime (watching, completed, …).")
        .addStringOption((o) => o.setName("anime").setDescription("Anime title").setRequired(true))
        .addStringOption((o) =>
          o.setName("state").setDescription("New status").setRequired(true).addChoices(...watchStatusChoices),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove an anime from your list.")
        .addStringOption((o) => o.setName("anime").setDescription("Anime title").setRequired(true)),
    ),
  async execute(interaction) {
    switch (interaction.options.getSubcommand()) {
      case "show":
        return handleShow(interaction);
      case "add":
        return handleAdd(interaction);
      case "next":
        return handleNext(interaction);
      case "update":
        return handleProgress(interaction);
      case "status":
        return handleStatus(interaction);
      case "remove":
        return handleRemove(interaction);
      default:
        return replyError(interaction, "Unknown subcommand.");
    }
  },
};

// ---- Button handlers (Undo / +1 stay as buttons, not commands) ---------

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

      if (nextStatus === "completed" && !Number(existing?.score || 0)) {
        await respond(interaction, buildCompletionPayload({ media, entry: updated }));
      } else {
        const embed = buildProgressEmbed({ media, progress: nextProgress, status: nextStatus });
        const row = buildProgressActionRow(media.id);
        await respond(interaction, { embeds: [embed], components: [row] });
      }
      return true;
    }

    if (action === "rate") {
      const [, , mediaIdPart, scorePart] = String(interaction.customId || "").split(":");
      const mediaId = Number(mediaIdPart);
      const score = Number(scorePart);
      if (!Number.isFinite(mediaId) || !(score >= 1 && score <= 10)) {
        await replyError(interaction, "Invalid rating.");
        return true;
      }

      const link = await requireLinkedUser(interaction);
      if (!link) return true;

      const existing = await getEntryByMediaId(link.hikari_user_id, mediaId);
      if (!existing) {
        await replyError(interaction, "This title is no longer on your list.");
        return true;
      }

      const { error } = await supabase.from(listTable).update({ score }).eq("id", existing.id);
      if (error) throw error;

      const mediaList = await getAnimeByIds([mediaId]);
      const media = mediaList?.[0] || null;
      const ratedEmbed = new EmbedBuilder()
        .setColor(embedColors.brand)
        .setTitle(`${UNICODE.star} Rated ${score}/10 ${"★".repeat(Math.round(score / 2))}`)
        .setDescription(`**${media ? mediaTitle(media) : `#${mediaId}`}** — saved to your Hikari list.`)
        .setFooter({ text: "光 Hikari" })
        .setTimestamp();
      if (media?.coverImage?.medium || media?.coverImage?.large) {
        ratedEmbed.setThumbnail(media.coverImage.medium || media.coverImage.large);
      }
      await respond(interaction, { embeds: [ratedEmbed], components: [] });
      return true;
    }
  } catch (error) {
    await replyError(interaction, error?.message || "Tracking action failed.");
    return true;
  }

  return false;
};

export const trackingCommands = [listCommand];
