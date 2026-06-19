import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { replyError } from "../lib/interaction.js";

// One-shot server builder: creates the Hikari category/channel layout and sets
// all the permissions (staff/logs hidden, announcements read-only). Idempotent —
// re-running skips anything that already exists (matched by name).

const STAFF_ROLE_NAME = "Staff";

const TEXT_STRUCTURE = [
  {
    category: "📌 START HERE",
    channels: [
      { name: "welcome", readonly: true },
      { name: "rules", readonly: true },
      { name: "announcements", readonly: true },
      { name: "changelog", readonly: true },
      { name: "roles" },
    ],
  },
  {
    category: "💬 COMMUNITY",
    channels: [
      { name: "general" },
      { name: "now-watching" },
      { name: "recommendations" },
      { name: "seasonal-anime" },
      { name: "manga-corner" },
      { name: "clips-and-trailers" },
      { name: "share-your-list" },
      { name: "media" },
    ],
  },
  {
    category: "🛠️ HIKARI APP",
    channels: [
      { name: "support" },
      { name: "suggestions" },
      { name: "bug-reports" },
      { name: "bot-commands" },
      { name: "link-account", readonly: true },
    ],
  },
  {
    category: "🔒 STAFF",
    staffOnly: true,
    channels: [
      { name: "staff-chat" },
      { name: "staff-commands" },
      { name: "mod-logs" },
      { name: "ticket-logs" },
    ],
  },
  {
    category: "📊 LOGS",
    staffOnly: true,
    channels: [
      { name: "member-join" },
      { name: "member-leave" },
      { name: "bot-errors" },
      { name: "guild-join" },
      { name: "guild-leave" },
    ],
  },
];

const VOICE_STRUCTURE = { category: "🔊 VOICE", channels: ["General", "Music", "Watch Party", "AFK"] };

const norm = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const setupCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Build the full Hikari server layout — categories, channels & permissions (admin only).")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await replyError(interaction, "Run this in a server, not a DM.");
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await replyError(interaction, "You need the **Administrator** permission to run setup.", { title: "Not Allowed" });
      return;
    }

    const guild = interaction.guild;
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageChannels) || !me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await replyError(
        interaction,
        "I need the **Manage Channels** and **Manage Roles** permissions to set this up. Grant them and try again.",
        { title: "Missing Permissions" },
      );
      return;
    }

    // The interaction is already deferred by the bot's command handler.

    // Make sure caches are fresh so idempotency works.
    await guild.channels.fetch().catch(() => {});
    await guild.roles.fetch().catch(() => {});

    // Ensure a Staff role exists to lock private channels to.
    let staffRole = guild.roles.cache.find((r) => r.name.toLowerCase() === STAFF_ROLE_NAME.toLowerCase());
    if (!staffRole) {
      staffRole = await guild.roles
        .create({ name: STAFF_ROLE_NAME, color: 0x22d3ee, hoist: true, reason: "Hikari setup" })
        .catch(() => null);
    }

    const everyoneId = guild.roles.everyone.id;
    const created = [];
    const skipped = [];

    const findCategory = (name) =>
      guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && norm(c.name) === norm(name));
    const findChannel = (name, type) =>
      guild.channels.cache.find((c) => c.type === type && norm(c.name) === norm(name));

    const overwritesFor = ({ staffOnly, readonly }) => {
      const ow = [];
      if (staffOnly) {
        ow.push({ id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] });
        if (staffRole) ow.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel] });
        if (me) ow.push({ id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
      }
      if (readonly) {
        ow.push({
          id: everyoneId,
          deny: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.CreatePublicThreads,
            PermissionFlagsBits.CreatePrivateThreads,
          ],
        });
        if (staffRole) ow.push({ id: staffRole.id, allow: [PermissionFlagsBits.SendMessages] });
      }
      return ow;
    };

    try {
      for (const group of TEXT_STRUCTURE) {
        let category = findCategory(group.category);
        if (!category) {
          category = await guild.channels.create({
            name: group.category,
            type: ChannelType.GuildCategory,
            permissionOverwrites: group.staffOnly ? overwritesFor({ staffOnly: true }) : [],
            reason: "Hikari setup",
          });
          created.push(`📂 ${group.category}`);
        } else {
          skipped.push(group.category);
        }

        for (const ch of group.channels) {
          if (findChannel(ch.name, ChannelType.GuildText)) {
            skipped.push(`#${ch.name}`);
            continue;
          }
          await guild.channels.create({
            name: ch.name,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: overwritesFor({ staffOnly: group.staffOnly, readonly: ch.readonly }),
            reason: "Hikari setup",
          });
          created.push(`#${ch.name}`);
        }
      }

      // Voice category + channels.
      let voiceCat = findCategory(VOICE_STRUCTURE.category);
      if (!voiceCat) {
        voiceCat = await guild.channels.create({
          name: VOICE_STRUCTURE.category,
          type: ChannelType.GuildCategory,
          reason: "Hikari setup",
        });
        created.push(`📂 ${VOICE_STRUCTURE.category}`);
      }
      for (const vname of VOICE_STRUCTURE.channels) {
        if (findChannel(vname, ChannelType.GuildVoice)) {
          skipped.push(`🔊 ${vname}`);
          continue;
        }
        await guild.channels.create({
          name: vname,
          type: ChannelType.GuildVoice,
          parent: voiceCat.id,
          reason: "Hikari setup",
        });
        created.push(`🔊 ${vname}`);
      }
    } catch (error) {
      await interaction.editReply({
        content: `⚠️ Setup stopped partway: ${error?.message || "unknown error"}. Re-run **/setup** to finish the rest (it skips what already exists).`,
      });
      return;
    }

    const lines = [];
    lines.push(created.length ? `✅ **Created ${created.length}:**\n${created.join(", ")}` : "Nothing new to create — already set up.");
    if (skipped.length) lines.push(`\n⏭️ **Skipped (already existed): ${skipped.length}**`);
    if (staffRole) lines.push(`\n🔒 Private channels are locked to the **@${staffRole.name}** role — assign it to your mods.`);
    lines.push(`\n💡 Now drop the welcome/rules/link-account text into those channels.`);

    await interaction.editReply({ content: lines.join("\n").slice(0, 1950) });
  },
};

// ---------------------------------------------------------------------------
// /secure — apply permissions to an EXISTING category and its channels.
// Only edits permission overwrites; never creates/deletes anything, so all
// messages are preserved. Use this on the channels you already have.
// ---------------------------------------------------------------------------
const secureCommand = {
  data: new SlashCommandBuilder()
    .setName("secure")
    .setDescription("Apply permissions to an existing category & its channels (keeps all messages).")
    .addChannelOption((o) =>
      o
        .setName("category")
        .setDescription("The category to update")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("mode")
        .setDescription("How to lock it down")
        .setRequired(true)
        .addChoices(
          { name: "🔒 Staff only — hide from everyone", value: "staff" },
          { name: "📢 Read-only — anyone can view, only staff post", value: "readonly" },
          { name: "🌐 Public — reset to default (anyone view + post)", value: "reset" },
        ),
    )
    .addRoleOption((o) =>
      o.setName("role").setDescription("Role allowed in (staff/read-only modes). Defaults to a Staff role."),
    )
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await replyError(interaction, "Run this in a server, not a DM.");
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await replyError(interaction, "You need the **Administrator** permission to run this.", { title: "Not Allowed" });
      return;
    }

    const guild = interaction.guild;
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageChannels) || !me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await replyError(
        interaction,
        "I need **Manage Channels** and **Manage Roles** to edit permissions. Grant them and try again.",
        { title: "Missing Permissions" },
      );
      return;
    }

    const category = interaction.options.getChannel("category");
    const mode = interaction.options.getString("mode");
    let role = interaction.options.getRole("role");

    if (category?.type !== ChannelType.GuildCategory) {
      await replyError(interaction, "Pick a **category**, not a regular channel.");
      return;
    }

    // The interaction is already deferred by the bot's command handler.

    const everyoneId = guild.roles.everyone.id;

    // Staff / read-only modes need a role to allow in. Default to (or create) "Staff".
    if ((mode === "staff" || mode === "readonly") && !role) {
      await guild.roles.fetch().catch(() => {});
      role =
        guild.roles.cache.find((r) => r.name.toLowerCase() === STAFF_ROLE_NAME.toLowerCase()) ||
        (await guild.roles
          .create({ name: STAFF_ROLE_NAME, color: 0x22d3ee, hoist: true, reason: "Hikari /secure" })
          .catch(() => null));
    }

    let overwrites = [];
    if (mode === "staff") {
      overwrites = [
        { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
        { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ];
      if (role) overwrites.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel] });
    } else if (mode === "readonly") {
      overwrites = [
        {
          id: everyoneId,
          deny: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.CreatePublicThreads,
            PermissionFlagsBits.CreatePrivateThreads,
          ],
        },
      ];
      if (role) overwrites.push({ id: role.id, allow: [PermissionFlagsBits.SendMessages] });
    } // reset → empty overwrites

    try {
      await category.permissionOverwrites.set(overwrites, "Hikari /secure");
      // Sync every channel in the category to the category's permissions.
      let synced = 0;
      for (const child of category.children.cache.values()) {
        await child.lockPermissions().catch(() => {});
        synced += 1;
      }

      const label =
        mode === "staff"
          ? `🔒 locked to **@${role?.name || "(no role)"}**`
          : mode === "readonly"
            ? `📢 set to read-only (only **@${role?.name || "staff"}** can post)`
            : "🌐 reset to default (public)";

      await interaction.editReply({
        content: `✅ **${category.name}** ${label}.\nSynced **${synced}** channel${synced === 1 ? "" : "s"} inside it — all messages kept.`,
      });
    } catch (error) {
      await interaction.editReply({ content: `⚠️ Couldn't update **${category.name}**: ${error?.message || "unknown error"}.` });
    }
  },
};

export const setupCommands = [setupCommand, secureCommand];
