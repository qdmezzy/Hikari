import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyDiscordLinkToken } from "@/lib/discord-link-token.mjs";
import { decideDiscordLinkWrite } from "@/lib/discord-link-ownership.mjs";
import { syncFoundingRoleForHikariUser } from "@/lib/server/discord-founding-role";

const readFirstEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
};

const readSupabaseConfig = () => {
  const url = readFirstEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readFirstEnv("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = readFirstEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  return { url, anonKey, serviceRoleKey };
};

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const DISCORD_API = "https://discord.com/api/v10";

// Best-effort DM to the user confirming the link. Never throws (the user may
// have DMs closed, or the bot token may be unset).
const notifyDiscordLinked = async (discordUserId: string, username: string | null, origin: string) => {
  const token = readFirstEnv("DISCORD_BOT_TOKEN");
  if (!token) return;
  try {
    const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    const channel = await dmRes.json().catch(() => null);
    if (!channel?.id) return;

    await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "✅ Account linked",
            description: `Your Discord is now connected to **Hikari**${
              username ? ` as **@${username}**` : ""
            }.\nTry \`/profile\`, \`/watching\`, or \`/favorites\` right here.`,
            color: 0x3b82f6,
            footer: { text: "光 Hikari" },
            timestamp: new Date().toISOString(),
          },
        ],
        components: origin
          ? [{ type: 1, components: [{ type: 2, style: 5, label: "Open Hikari", url: origin }] }]
          : [],
      }),
    });
  } catch {
    /* best-effort */
  }
};

export async function POST(req: Request) {
  const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceRoleKey } = readSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("SUPABASE_URL");
    if (!supabaseAnonKey) missing.push("SUPABASE_ANON_KEY");
    if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    return errorResponse(`Missing Supabase server configuration: ${missing.join(", ")}`, 500);
  }

  try {
    const body = await req.json();
    const accessToken = String(body?.access_token || "").trim();
    const linkToken = String(body?.token || "").trim();

    if (!accessToken) return errorResponse("Missing access token.", 401);
    if (!linkToken) return errorResponse("Missing Discord link token.");

    const signingSecret = readFirstEnv("DISCORD_LINK_SIGNING_SECRET");
    if (!signingSecret) {
      return errorResponse("Discord account linking is not configured.", 503);
    }

    let verifiedLink;
    try {
      verifiedLink = verifyDiscordLinkToken(linkToken, signingSecret);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Invalid Discord link token.", 401);
    }
    const { discordUserId, discordName } = verifiedLink;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);

    if (authError || !authData?.user?.id) {
      return errorResponse("Invalid or expired session token.", 401);
    }

    const hikariUserId = authData.user.id;
    const fallbackHandle =
      String(authData.user.user_metadata?.username || authData.user.user_metadata?.handle || "")
        .trim()
        .toLowerCase() || null;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [discordLookup, hikariLookup] = await Promise.all([
      admin
        .from("discord_links")
        .select("discord_user_id, hikari_user_id, hikari_username, linked_at")
        .eq("discord_user_id", discordUserId)
        .maybeSingle(),
      admin
        .from("discord_links")
        .select("discord_user_id, hikari_user_id, hikari_username, linked_at")
        .eq("hikari_user_id", hikariUserId)
        .maybeSingle(),
    ]);

    if (discordLookup.error || hikariLookup.error) {
      return errorResponse(
        discordLookup.error?.message || hikariLookup.error?.message || "Failed checking account links.",
        500,
      );
    }

    const decision = decideDiscordLinkWrite({
      discordLink: discordLookup.data,
      hikariLink: hikariLookup.data,
      hikariUserId,
      discordUserId,
    });
    if (!decision.ok) {
      const message =
        decision.reason === "discord_claimed"
          ? "That Discord account is already linked to another Hikari account."
          : "This Hikari account is already linked to a different Discord account. Unlink it in Discord before linking another.";
      return errorResponse(message, decision.status);
    }

    const payload = {
      discord_user_id: discordUserId,
      hikari_user_id: hikariUserId,
      hikari_username: fallbackHandle,
    };

    const writeQuery = decision.mode === "update"
      ? admin.from("discord_links").update(payload).eq("discord_user_id", discordUserId)
      : admin.from("discord_links").insert(payload);

    const { data: linkedRow, error: upsertError } = await writeQuery
      .select("discord_user_id, hikari_user_id, hikari_username, linked_at")
      .single();

    if (upsertError) {
      if (String(upsertError.code || "") === "23505") {
        return errorResponse("That Discord or Hikari account was linked by another request. Please refresh and try again.", 409);
      }
      return errorResponse(upsertError.message || "Failed to create Discord link.", 500);
    }

    // Best-effort confirmation DM in Discord (won't block/break linking).
    const origin = (() => {
      const configured = readFirstEnv("NEXT_PUBLIC_APP_URL", "HIKARI_WEB_BASE_URL", "NEXT_PUBLIC_SITE_URL");
      if (configured) return configured.replace(/\/+$/, "");
      try {
        return new URL(req.url).origin;
      } catch {
        return "";
      }
    })();
    await notifyDiscordLinked(discordUserId, linkedRow?.hikari_username ?? null, origin);
    await syncFoundingRoleForHikariUser(admin, hikariUserId);

    return NextResponse.json(
      { ok: true, linked: linkedRow, discord_name: discordName || null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(String(error || "Failed to link account."), 500);
  }
}
