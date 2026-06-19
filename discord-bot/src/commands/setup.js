import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  GuildVerificationLevel,
  GuildExplicitContentFilter,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  AutoModerationActionType,
  AutoModerationRuleKeywordPresetType,
} from "discord.js";
import { replyError } from "../lib/interaction.js";

// /finish-setup — one-shot to finish configuring the server AFTER the channels
// already exist: ensures roles, creates self-assign roles, locks staff/log
// categories, sets safety settings, and adds AutoMod rules. Idempotent and
// non-destructive (never deletes channels or messages).

const STAFF_ROLE_NAME = "Staff";

const SELF_ROLES = [
  "Spoilers OK",
  "Beta Tester",
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Romance",
  "Fantasy",
  "Sci-Fi",
  "Horror",
  "Slice of Life",
];

// Categories whose name contains any of these get locked to staff only.
const PRIVATE_CATEGORY_KEYWORDS = ["staff", "log", "mod", "admin"];

const norm = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const finishSetupCommand = {
  data: new SlashCommandBuilder()
    .setName("finish-setup")
    .setDescription("Finish server setup: roles, safety, AutoMod & lock staff/log categories (admin only).")
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
    const needed = [
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageGuild,
    ];
    if (!needed.every((p) => me?.permissions.has(p))) {
      await replyError(
        interaction,
        "I need **Manage Roles**, **Manage Channels**, and **Manage Server** to finish setup. Grant them (and drag my role up) and try again.",
        { title: "Missing Permissions" },
      );
      return;
    }

    // (Interaction is already deferred by the bot's command handler.)
    const results = [];
    await guild.roles.fetch().catch(() => {});
    await guild.channels.fetch().catch(() => {});

    const roleByName = (name) => guild.roles.cache.find((r) => r.name.toLowerCase() === name.toLowerCase());

    // 1) Staff role
    let staffRole = roleByName(STAFF_ROLE_NAME);
    if (!staffRole) {
      staffRole = await guild.roles
        .create({ name: STAFF_ROLE_NAME, color: 0x22d3ee, hoist: true, reason: "Hikari setup" })
        .catch(() => null);
    }
    results.push(staffRole ? "🛡️ Staff role ready" : "⚠️ Couldn't create the Staff role (is my role high enough?)");

    // 2) Self-assign roles (genres / spoilers / beta)
    let rolesCreated = 0;
    for (const name of SELF_ROLES) {
      if (roleByName(name)) continue;
      const created = await guild.roles.create({ name, mentionable: false, reason: "Hikari setup" }).catch(() => null);
      if (created) rolesCreated += 1;
    }
    results.push(`🎭 Self-assign roles: ${rolesCreated} created (${SELF_ROLES.length} total)`);

    // 3) Lock staff/log categories to the Staff role
    const everyoneId = guild.roles.everyone.id;
    const privateCats = guild.channels.cache.filter(
      (c) =>
        c.type === ChannelType.GuildCategory &&
        PRIVATE_CATEGORY_KEYWORDS.some((k) => norm(c.name).includes(k)),
    );
    let lockedCats = 0;
    for (const cat of privateCats.values()) {
      try {
        const ow = [
          { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
          { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ];
        if (staffRole) ow.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel] });
        await cat.permissionOverwrites.set(ow, "Hikari setup");
        for (const child of cat.children.cache.values()) await child.lockPermissions().catch(() => {});
        lockedCats += 1;
      } catch {
        /* skip this category */
      }
    }
    results.push(
      lockedCats
        ? `🔒 Locked ${lockedCats} staff/log categor${lockedCats === 1 ? "y" : "ies"} (kept all messages)`
        : "🔒 No staff/log categories matched to lock",
    );

    // 4) Server safety settings
    try {
      await guild.setVerificationLevel(GuildVerificationLevel.Medium, "Hikari setup");
      await guild.setExplicitContentFilter(GuildExplicitContentFilter.AllMembers, "Hikari setup");
      results.push("🧯 Verification → Medium, explicit-content filter → On");
    } catch {
      results.push("⚠️ Couldn't change verification/content settings");
    }

    // 5) AutoMod rules
    const existingRules = await guild.autoModerationRules.fetch().catch(() => new Map());
    const ruleExists = (name) => [...existingRules.values()].some((r) => r.name === name);
    const automodRules = [
      { name: "Hikari • Block Spam", triggerType: AutoModerationRuleTriggerType.Spam },
      {
        name: "Hikari • Mention Spam",
        triggerType: AutoModerationRuleTriggerType.MentionSpam,
        triggerMetadata: { mentionTotalLimit: 6 },
      },
      {
        name: "Hikari • Bad Words",
        triggerType: AutoModerationRuleTriggerType.KeywordPreset,
        triggerMetadata: {
          presets: [
            AutoModerationRuleKeywordPresetType.Profanity,
            AutoModerationRuleKeywordPresetType.SexualContent,
            AutoModerationRuleKeywordPresetType.Slurs,
          ],
        },
      },
    ];
    let automodAdded = 0;
    for (const rule of automodRules) {
      if (ruleExists(rule.name)) continue;
      try {
        await guild.autoModerationRules.create({
          name: rule.name,
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: rule.triggerType,
          triggerMetadata: rule.triggerMetadata,
          actions: [{ type: AutoModerationActionType.BlockMessage }],
          enabled: true,
          reason: "Hikari setup",
        });
        automodAdded += 1;
      } catch {
        /* a rule of this type may already exist (Discord limits one per type) */
      }
    }
    results.push(`🤖 AutoMod rules: ${automodAdded} added`);

    const note = staffRole ? `\n\n👉 Assign **@${staffRole.name}** to your mods (and yourself).` : "";
    const stillManual =
      "\n\n*Still do by hand:* reaction-roles in #roles, Discord **Onboarding** (Server Settings), and a permanent invite link.";

    await interaction.editReply({
      content: `✅ **Setup finished.**\n\n${results.join("\n")}${note}${stillManual}`.slice(0, 1950),
    });
  },
};

export const setupCommands = [finishSetupCommand];
