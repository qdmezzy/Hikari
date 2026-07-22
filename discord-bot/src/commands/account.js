import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { buildHikariLinkUrl, buildHikariUrl } from "../config.js";
import { buildNoticeView, buildProfileButtons, buildProfileEmbed, embedColors } from "../lib/embeds.js";
import { EMOJI } from "../lib/emojis.js";
import { replyError, respond } from "../lib/interaction.js";
import { getLinkByDiscordId, removeLinkByDiscordId, safeLinkTableMessage } from "../services/links.js";
import { buildWatchingLine, getListCounts, getListEntriesByUser, getTopGenres } from "../services/profiles.js";
import { resolveTarget } from "../services/targets.js";
import { buildHelpHome } from "../ui/helpMenu.js";
import { syncFoundingRoleForDiscordUser } from "../services/foundingRole.js";

const helpCommand = {
  data: new SlashCommandBuilder().setName("help").setDescription("Open the clickable Hikari help menu."),
  async execute(interaction) {
    await respond(interaction, await buildHelpHome(interaction.user.id));
  },
};

const accountPrefix = "hikari_account";

// One /account command: shows your link state with the right action buttons
// instead of separate /link + /unlink commands.
const buildAccountView = async (user, discordClient) => {
  const url = buildHikariLinkUrl(user.id, user.username);
  const existing = await getLinkByDiscordId(user.id).catch(() => null);

  if (existing?.hikari_user_id) {
    await syncFoundingRoleForDiscordUser(discordClient, user.id).catch(() => null);
    const entries = await getListEntriesByUser(existing.hikari_user_id, { limit: 500 }).catch(() => []);

    // Profile-card style: avatar pinned right, buttons inside the container.
    const container = new ContainerBuilder().setAccentColor(embedColors.success);
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `## ${EMOJI.check} Account linked`,
              `${EMOJI.user} **@${existing.hikari_username || "linked user"}**  ·  ${EMOJI.episodes} **${entries.length}** entries`,
              "-# Your Discord is connected to Hikari — track anime right from here.",
            ].join("\n"),
          ),
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 128 }))),
    );
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji(EMOJI.sparkle).setLabel("Open Hikari").setURL(buildHikariUrl("/", "help")),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji(EMOJI.link).setLabel("Re-link").setURL(url),
        new ButtonBuilder().setCustomId(`${accountPrefix}:refresh`).setStyle(ButtonStyle.Secondary).setLabel("Refresh"),
        new ButtonBuilder().setCustomId(`${accountPrefix}:unlink`).setStyle(ButtonStyle.Danger).setLabel("Unlink"),
      ),
    );
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# 光 Hikari"));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
  }

  return buildNoticeView({
    color: embedColors.brand,
    title: `${EMOJI.link} Connect Discord to Hikari`,
    description: "Tap the button below to securely link your account — no passwords are entered in Discord.",
    rows: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji(EMOJI.link).setLabel("Link Hikari").setURL(url),
        new ButtonBuilder().setCustomId(`${accountPrefix}:refresh`).setStyle(ButtonStyle.Secondary).setLabel("I linked it — refresh"),
      ),
    ],
  });
};

const accountCommand = {
  data: new SlashCommandBuilder().setName("account").setDescription("Your Hikari link status - link or unlink."),
  async execute(interaction) {
    await respond(interaction, await buildAccountView(interaction.user, interaction.client));
  },
};

export const isAccountComponent = (interaction) =>
  String(interaction.customId || "").startsWith(`${accountPrefix}:`);

export const handleAccountComponent = async (interaction) => {
  const [, action] = String(interaction.customId || "").split(":");
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
  }
  if (action === "refresh") {
    await respond(interaction, await buildAccountView(interaction.user, interaction.client));
    return true;
  }
  if (action === "unlink") {
    try {
      const removed = await removeLinkByDiscordId(interaction.user.id);
      if (!removed) {
        await respond(interaction, await buildAccountView(interaction.user, interaction.client));
        return true;
      }
      const relinkUrl = buildHikariLinkUrl(interaction.user.id, interaction.user.username);
      await respond(
        interaction,
        buildNoticeView({
          color: embedColors.warning,
          title: `${EMOJI.warning} Account unlinked`,
          description:
            "Your Discord has been disconnected from Hikari.\n-# Your anime data is still safe on the website.",
          rows: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji(EMOJI.link).setLabel("Re-link Account").setURL(relinkUrl),
            ),
          ],
        }),
      );
    } catch (error) {
      // The panel lives in Components V2, so the error notice must too — a
      // classic error embed can't be edited onto this message.
      await respond(
        interaction,
        buildNoticeView({
          color: embedColors.error,
          title: `${EMOJI.cross} Request failed`,
          description: safeLinkTableMessage(error),
        }),
      );
    }
    return true;
  }
  return false;
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

export const accountCommands = [helpCommand, accountCommand, profileCommand];
