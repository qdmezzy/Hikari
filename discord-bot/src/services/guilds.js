import { supabase, isMissingTableError } from "../lib/supabase.js";

const table = "discord_guilds";

export const guildTableMessage =
  "Server settings aren't set up yet. Run `sql/create-discord-guilds.sql` on your Supabase database.";

/** Returns the guild's config row, or null if none / table missing. */
export const getGuildConfig = async (guildId) => {
  if (!guildId) return null;
  const { data, error } = await supabase.from(table).select("*").eq("guild_id", String(guildId)).maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data;
};

/** Upsert arbitrary guild settings (guild_id required). */
export const upsertGuildConfig = async (guildId, patch = {}) => {
  const { data, error } = await supabase
    .from(table)
    .upsert({ guild_id: String(guildId), ...patch }, { onConflict: "guild_id" })
    .select("*")
    .single();
  if (error) {
    if (isMissingTableError(error)) {
      const err = new Error(guildTableMessage);
      err.friendly = true;
      throw err;
    }
    throw error;
  }
  return data;
};

export const setAlertChannel = (guildId, channelId, guildName) =>
  upsertGuildConfig(guildId, { alert_channel_id: channelId ? String(channelId) : null, guild_name: guildName || null });

/** All guilds that have an alert channel configured (for the broadcast loop). */
export const getGuildsWithAlerts = async () => {
  const { data, error } = await supabase
    .from(table)
    .select("guild_id, alert_channel_id")
    .not("alert_channel_id", "is", null);
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return data || [];
};
