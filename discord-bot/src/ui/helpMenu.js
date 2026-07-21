import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import {
  buildDiscordBotInviteUrl,
  buildHikariLinkUrl,
  buildHikariUrl,
  getDiscordSupportUrl,
} from "../config.js";
import { embedColors } from "../lib/embeds.js";
import { EMOJI } from "../lib/emojis.js";

const FOOTER = "光 Hikari";

const ABOUT =
  "**Hikari** is a modern anime discovery & tracking platform. Discover what to watch next, " +
  "track your progress, build lists, and import your history from **MyAnimeList** & **AniList** — " +
  "now right inside your server.";

const categories = [
  {
    key: "account",
    emoji: "👤",
    color: embedColors.brand,
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
    color: embedColors.success,
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
    color: embedColors.discovery,
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
    color: 0xeb459e,
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
    color: embedColors.success,
    label: "Stats",
    description: "Leaderboards & analytics",
    body: ["`/stats episodes [weekly|monthly]`", "`/stats streak`", "`/stats server`"],
  },
  {
    key: "server",
    emoji: "🛠️",
    color: embedColors.info,
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

const buildHomeEmbed = () =>
  new EmbedBuilder()
    .setColor(embedColors.brand)
    .setAuthor({ name: "Hikari • Help" })
    .setTitle(`${EMOJI.sparkle} What is Hikari?`)
    .setDescription(`${ABOUT}\n\n**Pick a category below** to see its commands.`)
    .addFields(
      categories.map((cat) => ({
        name: `${cat.emoji} ${cat.label}`,
        value: cat.description,
        inline: true,
      })),
    )
    .setFooter({ text: `${FOOTER} • ${categories.reduce((n, c) => n + c.body.length, 0)} commands` })
    .setTimestamp();

const buildCategoryEmbed = (category) =>
  new EmbedBuilder()
    .setColor(category.color)
    .setAuthor({ name: "Hikari • Help" })
    .setTitle(`${category.emoji} ${category.label}`)
    .setDescription(category.body.join("\n"))
    .setFooter({ text: FOOTER })
    .setTimestamp();

const buildHomeComponents = (ownerId) => [
  new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${helpCustomIdPrefix}:select:${ownerId}`)
      .setPlaceholder("📂 Choose a category…")
      .addOptions(
        categories.map((cat) => ({
          label: cat.label,
          value: cat.key,
          description: cat.description,
          emoji: cat.emoji,
        })),
      ),
  ),
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji("✨").setLabel("Open Hikari").setURL(buildHikariUrl("/", "help")),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji("➕").setLabel("Add to Server").setURL(buildDiscordBotInviteUrl()),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji("💬").setLabel("Support").setURL(getDiscordSupportUrl()),
  ),
];

const buildCategoryComponents = (ownerId, username) =>
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
  );

export const buildHelpHome = async (ownerId) => ({
  embeds: [buildHomeEmbed()],
  components: buildHomeComponents(ownerId),
});

const buildHelpCategory = async (ownerId, username, category) => ({
  embeds: [buildCategoryEmbed(category)],
  components: [buildCategoryComponents(ownerId, username)],
});

export const isHelpComponent = (interaction) => {
  const id = interaction.customId || "";
  return id.startsWith(`${helpCustomIdPrefix}:`);
};

export const handleHelpComponent = async (interaction) => {
  const [prefix, action, ownerId] = String(interaction.customId || "").split(":");
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
    await deferAndEdit(await buildHelpHome(interaction.user.id));
    return true;
  }

  if (action === "select" && interaction.isStringSelectMenu()) {
    const category = categoryByKey.get(interaction.values?.[0]);
    await deferAndEdit(
      category
        ? await buildHelpCategory(interaction.user.id, interaction.user.username, category)
        : await buildHelpHome(interaction.user.id),
    );
    return true;
  }

  return false;
};
