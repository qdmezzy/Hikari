import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { buildHikariUrl } from "../config.js";
import { replyError, replySuccess } from "../lib/interaction.js";
import { supabase, isMissingTableError } from "../lib/supabase.js";
import { setAlertChannel, guildTableMessage } from "../services/guilds.js";
import { getLinkByDiscordId } from "../services/links.js";
import { syncAllFoundingRoles } from "../services/foundingRole.js";

const isLinkedHikariModerator = async (discordUserId) => {
  const link = await getLinkByDiscordId(discordUserId).catch(() => null);
  if (!link?.hikari_user_id) return false;
  const { data } = await supabase.auth.admin.getUserById(link.hikari_user_id);
  const metadata = data?.user?.app_metadata || {};
  return metadata.is_mod === true || metadata.isMod === true;
};

const setAlertsCommand = {
  data: new SlashCommandBuilder()
    .setName("alerts")
    .setDescription("Choose the channel for airing broadcasts & digests.")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel where the bot should post airing updates")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await replyError(interaction, "Run this in a server, not a DM.");
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await replyError(interaction, "You need the **Manage Server** permission to change bot settings.", {
        title: "Not Allowed",
      });
      return;
    }

    const channel = interaction.options.getChannel("channel");
    try {
      await setAlertChannel(interaction.guildId, channel.id, interaction.guild?.name);
      await replySuccess(
        interaction,
        `Daily airing broadcasts will now post in <#${channel.id}>.`,
        { title: "Alerts Configured" },
      );
    } catch (error) {
      await replyError(interaction, error?.friendly ? error.message : guildTableMessage);
    }
  },
};

const announceCommand = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Post a site-wide Hikari announcement (moderators only).")
    .addStringOption((option) =>
      option.setName("title").setDescription("Announcement title").setRequired(true).setMaxLength(120),
    )
    .addStringOption((option) =>
      option.setName("message").setDescription("Announcement body").setRequired(true).setMaxLength(1000),
    ),
  async execute(interaction) {
    const link = await getLinkByDiscordId(interaction.user.id).catch(() => null);
    if (!link?.hikari_user_id) {
      await replyError(interaction, "Link your Hikari account first with `/account`.", { title: "Not Linked" });
      return;
    }

    // Only real Hikari moderators may post global announcements.
    // Read from app_metadata (service-role-only) so the flag can't be self-set.
    const isMod = await isLinkedHikariModerator(interaction.user.id).catch(() => false);
    if (!isMod) {
      await replyError(interaction, "Only Hikari moderators can post site-wide announcements.", { title: "Not Allowed" });
      return;
    }

    const title = interaction.options.getString("title");
    const message = interaction.options.getString("message");

    const { error } = await supabase.from("announcements").insert({
      title,
      body: message,
      is_published: true,
      created_by: link.hikari_user_id,
      author_name: link.hikari_username || interaction.user.username,
    });

    if (error) {
      await replyError(
        interaction,
        isMissingTableError(error)
          ? "Announcements table missing. Run `web/db/create-community-content.sql` first."
          : error.message || "Could not post the announcement.",
      );
      return;
    }

    await replySuccess(
      interaction,
      `**${title}** is now live on Hikari.\n${buildHikariUrl("/community", "sharing")}`,
      { title: "Announcement Posted" },
    );
  },
};

const foundingSyncCommand = {
  async execute(interaction) {
    const isMod = await isLinkedHikariModerator(interaction.user.id).catch(() => false);
    if (!isMod) {
      await replyError(interaction, "Link a Hikari moderator account before syncing founding roles.", { title: "Not Allowed" });
      return;
    }
    try {
      const result = await syncAllFoundingRoles(interaction.client);
      if (result.status === "not_configured") {
        await replyError(interaction, "Set `DISCORD_GUILD_ID` and `DISCORD_FOUNDING_ROLE_ID`, then place the bot role above Founding 25.", { title: "Role Not Configured" });
        return;
      }
      await replySuccess(
        interaction,
        `Added **${result.added}**, removed **${result.removed}**, unchanged **${result.unchanged}**, missing from server **${result.missing}**, failed **${result.failed}**.`,
        { title: "Founding 25 Roles Synced" },
      );
    } catch {
      await replyError(interaction, "Role sync failed. Check the migration, guild membership, role order, and bot permissions.");
    }
  },
};


// Single /admin command (hidden from members without Manage Server) instead of
// separate /set-alerts and /announce cluttering the picker for everyone.
const adminCommand = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Hikari admin tools.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("alerts")
        .setDescription("Choose the channel for airing broadcasts & digests.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel where the bot should post airing updates")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("announce")
        .setDescription("Post a site-wide Hikari announcement (moderators only).")
        .addStringOption((option) =>
          option.setName("title").setDescription("Announcement title").setRequired(true).setMaxLength(120),
        )
        .addStringOption((option) =>
          option.setName("message").setDescription("Announcement body").setRequired(true).setMaxLength(1000),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("founding-sync").setDescription("Sync Founding 25 roles from secure Hikari links."),
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "alerts") return setAlertsCommand.execute(interaction);
    if (subcommand === "founding-sync") return foundingSyncCommand.execute(interaction);
    return announceCommand.execute(interaction);
  },
};

export const adminCommands = [adminCommand];
