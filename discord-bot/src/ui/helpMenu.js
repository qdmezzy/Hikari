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
    emojiKey: "user",
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
    emojiKey: "library",
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
    emojiKey: "crystal",
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
    emojiKey: "share",
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
    emojiKey: "chart",
    label: "Stats",
    description: "Leaderboards & analytics",
    body: ["`/stats episodes [weekly|monthly]`", "`/stats streak`", "`/stats server`"],
  },
  {
    key: "server",
    emojiKey: "tools",
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

// Home: two stacked Components V2 cards — a hero card with the blurb and an
// "Open Hikari" button pinned beside the heading, then a commands card with
// one section per category and a "View" button on each row.
const buildHomePayload = (ownerId) => {
  const hero = new ContainerBuilder().setAccentColor(embedColors.brand);
  hero.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# ${EMOJI.sparkle} What is Hikari?\n-# Anime discovery & tracking, right inside your server`,
        ),
      )
      .setButtonAccessory(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji(EMOJI.sparkle).setLabel("Open Hikari").setURL(buildHikariUrl("/", "help")),
      ),
  );
  hero.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(ABOUT),
    new TextDisplayBuilder().setContent(
      "-# **NOTE:** Hikari isn't affiliated with MyAnimeList or AniList — it imports your history from both.",
    ),
  );

  const commands = new ContainerBuilder().setAccentColor(embedColors.brand);
  commands.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## Commands\n-# ${commandCount} commands · pick a category`),
  );
  commands.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  for (const cat of categories) {
    commands.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          // EMOJI is resolved per render, not at import — the custom-emoji
          // upgrade on boot happens after this module loads.
          new TextDisplayBuilder().setContent(`**${EMOJI[cat.emojiKey]} ${cat.label}**\n-# ${cat.description}`),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`${helpCustomIdPrefix}:cat:${ownerId}:${cat.key}`)
            .setLabel("View")
            .setStyle(ButtonStyle.Secondary),
        ),
    );
  }

  commands.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  commands.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji(EMOJI.plus).setLabel("Add to Server").setURL(buildDiscordBotInviteUrl()),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji(EMOJI.chat).setLabel("Support").setURL(getDiscordSupportUrl()),
    ),
  );
  commands.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# 光 Hikari"));

  return { components: [hero, commands], flags: MessageFlags.IsComponentsV2 };
};

const buildCategoryPayload = (ownerId, username, category) => {
  const container = new ContainerBuilder().setAccentColor(embedColors.brand);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${EMOJI[category.emojiKey]} ${category.label}\n-# ${category.description} · ${category.body.length} commands`,
    ),
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(category.body.join("\n")));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${helpCustomIdPrefix}:back:${ownerId}`)
        .setEmoji(EMOJI.back)
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setEmoji(EMOJI.link)
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
