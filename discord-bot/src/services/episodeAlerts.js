import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { buildHikariUrl } from "../config.js";
import { supabase } from "../lib/supabase.js";
import { getGuildsWithAlerts } from "./guilds.js";

// Every 30 minutes: find bell'd titles (episode_alerts — same table the web
// push cron uses) with an episode airing inside the window, then post to each
// guild's alert channel with a discussion thread and DM every linked user who
// asked for that title. Dedupe is in-memory; worst case after a restart is one
// repeat, and the web cron keeps its own dedupe column untouched.

const CHECK_MS = 30 * 60 * 1000;
const WINDOW_S = 40 * 60;
const notified = new Set();

const AIRING_QUERY = `
query ($ids: [Int], $from: Int, $to: Int) {
  Page(perPage: 50) {
    airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to) {
      episode
      airingAt
      media {
        id
        title { romaji english }
        coverImage { large }
      }
    }
  }
}
`;

const run = async (client) => {
  try {
    const { data: alerts } = await supabase.from("episode_alerts").select("user_id, media_id");
    if (!alerts?.length) return;

    const ids = [...new Set(alerts.map((a) => Number(a.media_id)).filter(Number.isFinite))].slice(0, 50);
    const now = Math.floor(Date.now() / 1000);
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: AIRING_QUERY, variables: { ids, from: now - 120, to: now + WINDOW_S } }),
    });
    if (!res.ok) return;
    const json = await res.json().catch(() => null);
    const schedules = json?.data?.Page?.airingSchedules || [];
    if (!schedules.length) return;

    const { data: links } = await supabase.from("discord_links").select("discord_user_id, hikari_user_id");
    const discordByHikari = new Map((links || []).map((l) => [String(l.hikari_user_id), l.discord_user_id]));
    const guilds = await getGuildsWithAlerts().catch(() => []);

    for (const schedule of schedules) {
      const media = schedule.media;
      const key = `${media.id}:${schedule.episode}`;
      if (notified.has(key)) continue;
      notified.add(key);

      const title = media.title?.english || media.title?.romaji || "Anime";
      const mediaUrl = buildHikariUrl(`/media/${media.id}`, "alerts");
      const embed = new EmbedBuilder()
        .setColor(0xf3d36b)
        .setTitle(`${title} — Episode ${schedule.episode}`)
        .setDescription(`Airing <t:${schedule.airingAt}:R> (<t:${schedule.airingAt}:t>).`)
        .setURL(mediaUrl)
        .setFooter({ text: "光 Hikari" })
        .setTimestamp();
      if (media.coverImage?.large) embed.setThumbnail(media.coverImage.large);
      const components = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open on Hikari").setEmoji("▶️").setURL(mediaUrl),
        ),
      ];

      const createdThreads = [];
      for (const guild of guilds) {
        try {
          const channel = await client.channels.fetch(guild.alert_channel_id);
          if (channel?.isTextBased?.()) {
            const message = await channel.send({ embeds: [embed], components });
            const thread = await message
              .startThread({ name: `${title} · Ep ${schedule.episode} 💬`.slice(0, 100), autoArchiveDuration: 1440 })
              .catch(() => null);
            if (thread) createdThreads.push(thread);
          }
        } catch {
          /* channel gone or missing perms — skip this guild */
        }
      }

      // Everyone with this title on their list joins the party, not just bells.
      const { data: holders } = await supabase
        .from("list_entries")
        .select("user_id")
        .eq("media_id", Number(media.id));
      const hikariUserIds = [
        ...new Set([
          ...alerts.filter((al) => Number(al.media_id) === Number(media.id)).map((al) => String(al.user_id)),
          ...(holders || []).map((row) => String(row.user_id)),
        ]),
      ];
      for (const hikariUserId of hikariUserIds) {
        const discordId = discordByHikari.get(hikariUserId);
        if (!discordId) continue;
        for (const thread of createdThreads) {
          await thread.members.add(discordId).catch(() => {});
        }
        try {
          const user = await client.users.fetch(discordId);
          await user.send({ embeds: [embed], components });
        } catch {
          /* DMs closed — fine */
        }
      }
    }
  } catch (error) {
    console.warn("[hikari-bot] episode alerts failed:", error?.message || error);
  }
};

export const startEpisodeAlerts = (client) => {
  setTimeout(() => run(client), 60 * 1000);
  setInterval(() => run(client), CHECK_MS);
  console.log("[hikari-bot] Episode alert loop started (every 30 min).");
};
