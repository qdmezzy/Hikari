import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { config } from "../config.js";
import { buildInfoEmbed } from "../lib/embeds.js";
import { respond, replyError } from "../lib/interaction.js";
import { getAnimeByIds, mediaTitle } from "../lib/anilist.js";
import { getLinkByDiscordId } from "../services/links.js";
import { getFavoriteMediaIds } from "../services/profiles.js";

const favoritesCommand = {
  data: new SlashCommandBuilder().setName("favorites").setDescription("Show the anime you've favorited on Hikari."),
  async execute(interaction) {
    const link = await getLinkByDiscordId(interaction.user.id).catch(() => null);
    if (!link?.hikari_user_id) {
      await replyError(interaction, "Link your Hikari account first with `/account`.", { title: "Not Linked" });
      return;
    }

    const ids = await getFavoriteMediaIds(link.hikari_user_id).catch(() => []);
    if (!ids.length) {
      await respond(interaction, {
        embeds: [
          buildInfoEmbed({
            title: "No favorites yet",
            description: `Tap the heart on any title to favorite it.\n${config.hikariWebBaseUrl}/search`,
          }),
        ],
      });
      return;
    }

    const media = await getAnimeByIds(ids.slice(0, 10));
    const byId = new Map(media.map((item) => [Number(item.id), item]));
    const lines = ids
      .slice(0, 10)
      .map((id) => byId.get(Number(id)))
      .filter(Boolean)
      .map((item) => `• [${mediaTitle(item)}](${config.hikariWebBaseUrl}/media/${item.id})`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0xe23b6d)
      .setTitle(`${link.hikari_username || "Your"} favorites ❤️`)
      .setDescription(lines || "Couldn't load your favorites right now.")
      .setFooter({ text: ids.length > 10 ? `Showing 10 of ${ids.length}` : "Hikari" })
      .setTimestamp();

    const cover = media.find((item) => item?.coverImage?.large)?.coverImage?.large;
    if (cover) embed.setThumbnail(cover);

    const handle = link.hikari_username ? String(link.hikari_username).replace(/^@/, "") : "";
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("View on Hikari")
        .setURL(handle ? `${config.hikariWebBaseUrl}/u/${encodeURIComponent(handle)}` : `${config.hikariWebBaseUrl}/lists`),
    );

    await respond(interaction, { embeds: [embed], components: [row] });
  },
};

export const favoritesCommands = [favoritesCommand];
