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
import { buildHikariUrl } from "../config.js";
import { buildInfoEmbed, embedColors } from "../lib/embeds.js";
import { EMOJI } from "../lib/emojis.js";
import { respond, replyError } from "../lib/interaction.js";
import { getAnimeByIds, mediaTitle } from "../lib/anilist.js";
import { getLinkByDiscordId } from "../services/links.js";
import { getFavoriteMediaIds } from "../services/profiles.js";

const MAX_ROWS = 6;

// One favorite row: linked title + a small meta line, cover pinned right.
const favoriteRowText = (item) => {
  const score = Number.isFinite(Number(item?.averageScore)) ? (Number(item.averageScore) / 10).toFixed(1) : null;
  const meta = [
    score ? `${EMOJI.star} ${score}` : null,
    item?.format ? String(item.format).replace(/_/g, " ") : null,
    item?.startDate?.year || null,
  ]
    .filter(Boolean)
    .join(" · ");
  const title = `**[${mediaTitle(item)}](${buildHikariUrl(`/media/${item.id}`, "sharing")})**`;
  return meta ? `${title}\n-# ${meta}` : title;
};

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
            description: `Tap the heart on any title to favorite it.\n${buildHikariUrl("/search", "sharing")}`,
          }),
        ],
      });
      return;
    }

    const media = await getAnimeByIds(ids.slice(0, MAX_ROWS));
    const byId = new Map(media.map((item) => [Number(item.id), item]));
    const items = ids
      .slice(0, MAX_ROWS)
      .map((id) => byId.get(Number(id)))
      .filter(Boolean);
    const username = link.hikari_username || "Your";
    const handle = link.hikari_username ? String(link.hikari_username).replace(/^@/, "") : "";

    const container = new ContainerBuilder().setAccentColor(embedColors.brand);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `### ${EMOJI.heart}  ${username} — Favorites`,
          ids.length > items.length ? `-# Showing ${items.length} of ${ids.length}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    for (const item of items) {
      const text = new TextDisplayBuilder().setContent(favoriteRowText(item));
      const cover = item?.coverImage?.large || item?.coverImage?.medium || null;
      if (cover) {
        container.addSectionComponents(
          new SectionBuilder().addTextDisplayComponents(text).setThumbnailAccessory(new ThumbnailBuilder().setURL(cover)),
        );
      } else {
        container.addTextDisplayComponents(text);
      }
    }

    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setEmoji(EMOJI.globe)
          .setLabel("View on Hikari")
          .setURL(buildHikariUrl(handle ? `/u/${encodeURIComponent(handle)}` : "/lists", "sharing")),
      ),
    );
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# 光 Hikari"));

    await respond(interaction, { components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};

export const favoritesCommands = [favoritesCommand];
