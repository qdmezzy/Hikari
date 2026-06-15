import { EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { getAiringSchedule, mediaTitle } from "../lib/anilist.js";
import { getGuildsWithAlerts } from "./guilds.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const BROADCAST_HOUR = Number(process.env.AIRING_BROADCAST_HOUR ?? 9); // local hour, 0-23
const MAX_LINES = 15;

const msUntilNextRun = () => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(BROADCAST_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
};

const buildAiringEmbed = (schedules) => {
  const lines = schedules.slice(0, MAX_LINES).map((entry) => {
    const time = `<t:${entry.airingAt}:t>`;
    const title = mediaTitle(entry.media);
    const url = `${config.hikariWebBaseUrl}/media/${entry.media.id}`;
    return `**${time}** · Ep ${entry.episode} — [${title}](${url})`;
  });

  return new EmbedBuilder()
    .setColor(0x6c5ce7)
    .setTitle("📅 Airing in the next 24 hours")
    .setDescription(lines.join("\n") || "Nothing scheduled right now.")
    .setFooter({ text: `Track everything on Hikari · ${config.hikariWebBaseUrl}` })
    .setTimestamp();
};

const runBroadcast = async (client) => {
  let guilds = [];
  try {
    guilds = await getGuildsWithAlerts();
  } catch (error) {
    console.error("[hikari-bot] airing broadcast: failed to load guild configs:", error?.message || error);
    return;
  }
  if (!guilds.length) return;

  let schedules = [];
  try {
    schedules = await getAiringSchedule({ hours: 24 });
  } catch (error) {
    console.error("[hikari-bot] airing broadcast: AniList fetch failed:", error?.message || error);
    return;
  }
  if (!schedules.length) return;

  const embed = buildAiringEmbed(schedules);

  for (const guild of guilds) {
    try {
      const channel = await client.channels.fetch(guild.alert_channel_id);
      if (channel?.isTextBased?.()) {
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.warn(
        `[hikari-bot] airing broadcast: could not post to channel ${guild.alert_channel_id}:`,
        error?.message || error,
      );
    }
  }
  console.log(`[hikari-bot] airing broadcast sent to ${guilds.length} guild(s).`);
};

/** Schedules the daily airing broadcast at BROADCAST_HOUR local time. */
export const startAiringBroadcast = (client) => {
  const schedule = () => {
    const delay = msUntilNextRun();
    setTimeout(async () => {
      await runBroadcast(client).catch((e) => console.error("[hikari-bot] broadcast error:", e));
      setInterval(() => runBroadcast(client).catch((e) => console.error("[hikari-bot] broadcast error:", e)), DAY_MS);
    }, delay);
    console.log(`[hikari-bot] Airing broadcast scheduled in ${Math.round(delay / 60000)} min.`);
  };
  schedule();
};
