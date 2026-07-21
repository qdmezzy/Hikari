import { EmbedBuilder } from "discord.js";
import { buildHikariUrl, config } from "../config.js";
import { getAiringSchedule, mediaTitle } from "../lib/anilist.js";
import { EMOJI } from "../lib/emojis.js";
import { getGuildsWithAlerts } from "./guilds.js";
import { getAllLinks } from "./links.js";
import { supabase } from "../lib/supabase.js";

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
    const url = buildHikariUrl(`/media/${entry.media.id}`, "alerts");
    return `**${time}** · Ep ${entry.episode} — [${title}](${url})`;
  });

  return new EmbedBuilder()
    .setColor(0xf3d36b)
    .setTitle(`${EMOJI.calendar} Airing in the next 24 hours`)
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


// Sunday extra: a weekly digest of linked members' activity.
const runWeeklyDigest = async (client) => {
  try {
    const guilds = await getGuildsWithAlerts().catch(() => []);
    if (!guilds.length) return;
    const links = await getAllLinks().catch(() => []);
    if (!links.length) return;

    const userIds = links.map((l) => String(l.hikari_user_id));
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await supabase
      .from("list_entries")
      .select("user_id, status, updated_at")
      .in("user_id", userIds)
      .gte("updated_at", cutoff);
    if (!rows?.length) return;

    const updatesByUser = {};
    let completions = 0;
    rows.forEach((row) => {
      updatesByUser[row.user_id] = (updatesByUser[row.user_id] || 0) + 1;
      if (row.status === "completed") completions += 1;
    });
    const discordByHikari = new Map(links.map((l) => [String(l.hikari_user_id), l.discord_user_id]));
    const medals = ["🥇", "🥈", "🥉"];
    const top = Object.entries(updatesByUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([uid, count], i) => `${medals[i]} <@${discordByHikari.get(uid)}> — ${count} update${count === 1 ? "" : "s"}`);

    const embed = new EmbedBuilder()
      .setColor(0xf3d36b)
      .setTitle("📊 This week on Hikari")
      .setDescription(
        [
          `**${rows.length}** list updates · **${completions}** completion${completions === 1 ? "" : "s"} 🎉`,
          "",
          "**Top watchers**",
          ...(top.length ? top : ["No activity this week — go watch something!"]),
        ].join("\n"),
      )
      .setFooter({ text: `Track your anime · ${config.hikariWebBaseUrl}` })
      .setTimestamp();

    for (const guild of guilds) {
      try {
        const channel = await client.channels.fetch(guild.alert_channel_id);
        if (channel?.isTextBased?.()) await channel.send({ embeds: [embed] });
      } catch {
        /* skip */
      }
    }
    console.log("[hikari-bot] Weekly digest sent.");
  } catch (error) {
    console.warn("[hikari-bot] weekly digest failed:", error?.message || error);
  }
};

/** Schedules the daily airing broadcast at BROADCAST_HOUR local time. */
export const startAiringBroadcast = (client) => {
  const schedule = () => {
    const delay = msUntilNextRun();
    setTimeout(async () => {
      await runBroadcast(client).catch((e) => console.error("[hikari-bot] broadcast error:", e));
      if (new Date().getDay() === 0) await runWeeklyDigest(client).catch(() => {});
      setInterval(async () => {
        await runBroadcast(client).catch((e) => console.error("[hikari-bot] broadcast error:", e));
        if (new Date().getDay() === 0) await runWeeklyDigest(client).catch(() => {});
      }, DAY_MS);
    }, delay);
    console.log(`[hikari-bot] Airing broadcast scheduled in ${Math.round(delay / 60000)} min.`);
  };
  schedule();
};
