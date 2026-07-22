import { config } from "../config.js";
import { decideFoundingRoleSync } from "../lib/foundingRoleDecision.js";
import { supabase } from "../lib/supabase.js";
import { getLinkByDiscordId } from "./links.js";

const getConfiguredGuild = async (client) => {
  if (!config.discordGuildId || !config.discordFoundingRoleId) return null;
  const guild = await client.guilds.fetch(config.discordGuildId).catch(() => null);
  if (!guild) return null;
  const role = await guild.roles.fetch(config.discordFoundingRoleId).catch(() => null);
  return role ? guild : null;
};

const syncLinkedRow = async (guild, link, membership) => {
  const member = await guild.members.fetch(String(link.discord_user_id)).catch(() => null);
  const hasRole = Boolean(member?.roles?.cache?.has(config.discordFoundingRoleId));
  const decision = decideFoundingRoleSync({
    configured: Boolean(guild && config.discordFoundingRoleId),
    linked: Boolean(link?.hikari_user_id),
    memberPresent: Boolean(member),
    membershipActive: membership?.active === true,
    hasRole,
  });
  if (decision.action === "add") await member.roles.add(config.discordFoundingRoleId, "Active Hikari Founding 25 member");
  if (decision.action === "remove") await member.roles.remove(config.discordFoundingRoleId, "Hikari founding membership inactive");
  return decision;
};

export const syncFoundingRoleForDiscordUser = async (client, discordUserId) => {
  const configured = Boolean(config.discordGuildId && config.discordFoundingRoleId);
  if (!configured) return { action: "none", reason: "not_configured" };
  const link = await getLinkByDiscordId(discordUserId).catch(() => null);
  if (!link?.hikari_user_id) return { action: "none", reason: "not_linked" };
  const guild = await getConfiguredGuild(client);
  if (!guild) return { action: "none", reason: "not_configured" };
  const { data: membership } = await supabase
    .from("founding_members")
    .select("active")
    .eq("user_id", link.hikari_user_id)
    .maybeSingle();
  return syncLinkedRow(guild, link, membership);
};

export const syncAllFoundingRoles = async (client) => {
  const guild = await getConfiguredGuild(client);
  if (!guild) return { status: "not_configured", added: 0, removed: 0, unchanged: 0, missing: 0, failed: 0 };

  const [{ data: links, error: linksError }, { data: memberships, error: membershipError }] = await Promise.all([
    supabase.from("discord_links").select("discord_user_id, hikari_user_id"),
    supabase.from("founding_members").select("user_id, active"),
  ]);
  if (linksError || membershipError) throw linksError || membershipError;
  const membershipMap = new Map((memberships || []).map((membership) => [membership.user_id, membership]));
  const result = { status: "complete", added: 0, removed: 0, unchanged: 0, missing: 0, failed: 0 };

  for (const link of links || []) {
    try {
      const decision = await syncLinkedRow(guild, link, membershipMap.get(link.hikari_user_id));
      if (decision.action === "add") result.added += 1;
      else if (decision.action === "remove") result.removed += 1;
      else if (decision.reason === "missing_member") result.missing += 1;
      else result.unchanged += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
};
