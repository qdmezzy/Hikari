import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { buildHikariLinkUrl } from "../config.js";
import {
  buildInfoEmbed,
  buildProfileButtons,
  buildProfileEmbed,
  buildSuccessEmbed,
  buildWarningEmbed,
} from "../lib/embeds.js";
import { EMOJI } from "../lib/emojis.js";
import { replyError, respond } from "../lib/interaction.js";
import { getLinkByDiscordId, removeLinkByDiscordId, safeLinkTableMessage } from "../services/links.js";
import { buildWatchingLine, getListCounts, getListEntriesByUser, getTopGenres } from "../services/profiles.js";
import { resolveTarget } from "../services/targets.js";
import { buildHelpHome } from "../ui/helpMenu.js";

const helpCommand = {
  data: new SlashCommandBuilder().setName("help").setDescription("Open the clickable Hikari help menu."),
  async execute(interaction) {
    await respond(interaction, await buildHelpHome(interaction.user.id));
  },
};

const linkCommand = {
  data: new SlashCommandBuilder().setName("link").setDescription("Link your Discord account to Hikari."),
  async execute(interaction) {
    const url = buildHikariLinkUrl(interaction.user.id, interaction.user.username);
    const existing = await getLinkByDiscordId(interaction.user.id).catch(() => null);
    let embed;
    if (existing?.hikari_user_id) {
      const entries = await getListEntriesByUser(existing.hikari_user_id, { limit: 500 }).catch(() => []);
      embed = buildSuccessEmbed({
        title: "Account linked",
        description: "Your Discord is connected to Hikari — track anime right from here.",
      }).addFields(
        { name: "👤 Username", value: existing.hikari_username || "Linked user", inline: true },
        { name: `${EMOJI.episodes} Entries`, value: `**${entries.length}**`, inline: true },
      );
    } else {
      embed = buildInfoEmbed({
        title: "Connect Discord to Hikari",
        description: "Tap the button below to securely link your account — no passwords are entered in Discord.",
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setEmoji("🔗")
        .setLabel(existing ? "Re-link Account" : "Link Hikari")
        .setURL(url),
    );

    await respond(interaction, { embeds: [embed], components: [row] });
  },
};

const unlinkCommand = {
  data: new SlashCommandBuilder().setName("unlink").setDescription("Unlink your Discord account from Hikari."),
  async execute(interaction) {
    try {
      const removed = await removeLinkByDiscordId(interaction.user.id);
      if (!removed) {
        await replyError(interaction, "You do not currently have a linked Hikari account.", { title: "Nothing to Unlink" });
        return;
      }
      const relinkUrl = buildHikariLinkUrl(interaction.user.id, interaction.user.username);
      const embed = buildWarningEmbed({
        title: "Account unlinked",
        description: "Your Discord has been disconnected from Hikari.\nYour anime data is still safe on the website.",
      });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji("🔗").setLabel("Re-link Account").setURL(relinkUrl),
      );
      await respond(interaction, { embeds: [embed], components: [row] });
    } catch (error) {
      await replyError(interaction, safeLinkTableMessage(error));
    }
  },
};

const profileCommand = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Show your linked profile, a Hikari username, or a linked @mention.")
    .addStringOption((option) =>
      option.setName("username").setDescription("Hikari username (handle), e.g. mezxyofficial"),
    )
    .addUserOption((option) => option.setName("user").setDescription("Linked Discord user to look up")),
  async execute(interaction) {
    const username = interaction.options.getString("username");
    const mentionUser = interaction.options.getUser("user");

    try {
      const result = await resolveTarget({
        requesterDiscordId: interaction.user.id,
        mentionDiscordId: mentionUser?.id,
        username,
      });

      if (!result.ok) {
        await replyError(interaction, result.message);
        return;
      }

      const { hikariUserId, handle, profile } = result.target;
      const entries = await getListEntriesByUser(hikariUserId, { limit: 200 });
      const counts = getListCounts(entries);
      const topGenres = await getTopGenres(entries, 3);
      const watchingLine = await buildWatchingLine(entries);
      const totalEpisodes = entries.reduce((sum, entry) => sum + Number(entry.progress || 0), 0);

      const embed = buildProfileEmbed({
        handle,
        displayName: profile?.display_name || profile?.handle || handle || "User",
        avatarUrl: profile?.avatar_url || null,
        watchingLine,
        counts,
        topGenres,
        totalEpisodes,
      });

      const buttons = buildProfileButtons({ handle });
      await respond(interaction, { embeds: [embed], components: [buttons] });
    } catch (error) {
      await replyError(interaction, error?.message || "Failed to load profile.");
    }
  },
};

export const accountCommands = [helpCommand, linkCommand, unlinkCommand, profileCommand];
