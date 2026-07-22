import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import {
  buildDiscordBotInviteUrl,
  buildHikariLinkUrl,
  buildHikariUrl,
  getDiscordSupportUrl,
} from "../config.js";
import { embedColors } from "../lib/embeds.js";
import { EMOJI } from "../lib/emojis.js";

const ABOUT =
  "**Hikari** is a modern anime discovery & tracking platform. Discover what to watch next, " +
  "track your progress, build lists, and import your history from **MyAnimeList** & **AniList** — " +
  "now right inside your server.";

const categories = [
  {
    key: "account",
    emoji: "👤",
    label: "Account",
    description: "Link, unlink & view profiles",
    body: [
      "`/account` — Connect your Discord to Hikari",
      "`/account` — Disconnect your account",
      "`/profile [user|username]` — View a profile",
      "`/favorites` — Show your saved favorites",
    ],
  },
  {
    key: "tracking",
    emoji: "📊",
    label: "Tracking",
    description: "Manage your watch list",
    body: [
      "`/list show [user]` — What you're watching",
      "`/list add <anime>` — Add a title to your list",
      "`/list next [anime]` — +1 episode",
      "`/list update <anime> <episode>` — Set episode",
      "`/list status <anime> <state>` — Set a status",
      "`/list remove <anime>` — Remove a title",
      "_Undo any change with the **Undo** button._",
    ],
  },
  {
    key: "discover",
    emoji: "🔮",
    label: "Discover",
    description: "Find your next anime",
    body: [
      "`/discover recommend [mood] [tags]` — Tailored picks",
      "`/discover random [tag]` — Surprise me",
      "`/compare @user` — Compatibility check",
    ],
  },
  {
    key: "share",
    emoji: "📤",
    label: "Share",
    description: "Post embeds to a channel",
    body: [
      "`/share profile [user]`",
      "`/share list <watching|completed|planned> [user]`",
      "`/share anime <anime>`",
    ],
  },
  {
    key: "stats",
    emoji: "📈",
    label: "Stats",
    description: "Leaderboards & analytics",
    body: ["`/stats episodes [weekly|monthly]`", "`/stats streak`", "`/stats server`"],
  },
  {
    key: "server",
    emoji: "🛠️",
    label: "Server (Admin)",
    description: "Bot configuration",
    body: [
      "`/admin alerts <#channel>` — Daily airing broadcasts",
      "`/admin announce <title> <message>` — Post a site announcement (mods)",
    ],
  },
];

const helpCustomIdPrefix = "hikari_help";
const categoryByKey = new Map(categories.map((item) => [item.key, item]));
const commandCount = categories.reduce((n, c) => n + c.body.length, 0);

// Home: a Components V2 page — heading, blurb, then one section per category
// with a "View" button pinned to the right of each row.
const buildHomePayload = (ownerId) => {
  const container = new ContainerBuilder().setAccentColor(embedColors.brand);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# ${EMOJI.sparkle} What is Hikari?\n-# Anime discovery & tracking, right inside your server`,
    ),
    new TextDisplayBuilder().setContent(ABOUT),
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  for (const cat of categories) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${cat.emoji} ${cat.label}**\n-# ${cat.description}`),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`${helpCustomIdPrefix}:cat:${ownerId}:${cat.key}`)
            .setLabel("View")
            .setStyle(ButtonStyle.Secondary),
        ),
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji("✨").setLabel("Open Hikari").setURL(buildHikariUrl("/", "help")),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji("➕").setLabel("Add to Server").setURL(buildDiscordBotInviteUrl()),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji("💬").setLabel("Support").setURL(getDiscordSupportUrl()),
    ),
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# 光 Hikari · ${commandCount} commands`),
  );

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
};

const buildCategoryPayload = (ownerId, username, category) => {
  const container = new ContainerBuilder().setAccentColor(embedColors.brand);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${category.emoji} ${category.label}\n-# ${category.description}`),
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(category.body.join("\n")));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${helpCustomIdPrefix}:back:${ownerId}`)
        .setEmoji("⬅️")
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setEmoji("🔗")
        .setLabel("Link Account")
        .setURL(buildHikariLinkUrl(ownerId, username)),
    ),
  );
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# 光 Hikari"));

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
};

export const buildHelpHome = async (ownerId) => buildHomePayload(ownerId);

export const isHelpComponent = (interaction) => {
  const id = interaction.customId || "";
  return id.startsWith(`${helpCustomIdPrefix}:`);
};

export const handleHelpComponent = async (interaction) => {
  const [prefix, action, ownerId, categoryKey] = String(interaction.customId || "").split(":");
  if (prefix !== helpCustomIdPrefix) return false;

  const deferAndEdit = async (payload) => {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
    await interaction.editReply(payload);
  };

  if (ownerId && ownerId !== interaction.user.id) {
    await interaction.reply({
      content: "This help panel belongs to someone else. Run `/help` for your own menu.",
      flags: 64,
    });
    return true;
  }

  if (action === "back") {
    await deferAndEdit(buildHomePayload(interaction.user.id));
    return true;
  }

  if (action === "cat") {
    const category = categoryByKey.get(categoryKey);
    await deferAndEdit(
      category
        ? buildCategoryPayload(interaction.user.id, interaction.user.username, category)
        : buildHomePayload(interaction.user.id),
    );
    return true;
  }

  // Legacy select menu from panels posted before the Components V2 redesign.
  // Those messages hold classic embeds and can't be edited into V2, so post a
  // fresh panel instead.
  if (action === "select" && interaction.isStringSelectMenu()) {
    const category = categoryByKey.get(interaction.values?.[0]);
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
    await interaction.followUp(
      category
        ? buildCategoryPayload(interaction.user.id, interaction.user.username, category)
        : buildHomePayload(interaction.user.id),
    );
    return true;
  }

  return false;
};
