import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { config } from "../config.js";
import { replyError, replySuccess } from "../lib/interaction.js";
import { supabase, isMissingTableError } from "../lib/supabase.js";
import { setAlertChannel, guildTableMessage } from "../services/guilds.js";
import { getLinkByDiscordId } from "../services/links.js";

const setAlertsCommand = {
  data: new SlashCommandBuilder()
    .setName("set-alerts")
    .setDescription("Choose the channel for daily airing-anime broadcasts (server admin only).")
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
    .setDescription("Post a site-wide Hikari announcement (Hikari moderators only).")
    .addStringOption((option) =>
      option.setName("title").setDescription("Announcement title").setRequired(true).setMaxLength(120),
    )
    .addStringOption((option) =>
      option.setName("message").setDescription("Announcement body").setRequired(true).setMaxLength(1000),
    ),
  async execute(interaction) {
    const link = await getLinkByDiscordId(interaction.user.id).catch(() => null);
    if (!link?.hikari_user_id) {
      await replyError(interaction, "Link your Hikari account first with `/link`.", { title: "Not Linked" });
      return;
    }

    // Only real Hikari moderators may post global announcements.
    // Read from app_metadata (service-role-only) so the flag can't be self-set.
    let isMod = false;
    try {
      const { data } = await supabase.auth.admin.getUserById(link.hikari_user_id);
      const meta = data?.user?.app_metadata || {};
      isMod = meta.is_mod === true || meta.isMod === true;
    } catch {
      isMod = false;
    }
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
      `**${title}** is now live on Hikari.\n${config.hikariWebBaseUrl}/community`,
      { title: "Announcement Posted" },
    );
  },
};

export const adminCommands = [setAlertsCommand, announceCommand];
