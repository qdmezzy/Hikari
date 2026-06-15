import { supabase, isMissingTableError } from "../lib/supabase.js";

const table = "discord_links";

export const getLinkByDiscordId = async (discordUserId) => {
  const { data, error } = await supabase
    .from(table)
    .select("discord_user_id, hikari_user_id, hikari_username, linked_at")
    .eq("discord_user_id", String(discordUserId))
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const removeLinkByDiscordId = async (discordUserId) => {
  const { error, data } = await supabase
    .from(table)
    .delete()
    .eq("discord_user_id", String(discordUserId))
    .select("discord_user_id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
};

export const countLinkedAccounts = async () => {
  const { count, error } = await supabase.from(table).select("discord_user_id", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
};

export const getAllLinks = async () => {
  const { data, error } = await supabase
    .from(table)
    .select("discord_user_id, hikari_user_id, hikari_username, linked_at")
    .order("linked_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const safeLinkTableMessage = (error) => {
  if (isMissingTableError(error)) {
    return "Link table missing. Run discord-bot/sql/create-discord-links.sql first.";
  }
  return error?.message || "Link operation failed.";
};

