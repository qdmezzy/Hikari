import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

const sanitizeDiscordId = (value: unknown) => String(value || "").trim();
const sanitizeDiscordName = (value: unknown) => String(value || "").trim().slice(0, 100);

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
    const discordUserId = sanitizeDiscordId(body?.discord_user_id);
    const discordName = sanitizeDiscordName(body?.discord_name);

    if (!accessToken) return errorResponse("Missing access token.", 401);
    if (!discordUserId || !/^\d{5,30}$/.test(discordUserId)) {
      return errorResponse("Invalid Discord user id.");
    }

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

    // Keep mapping one-to-one from both directions before writing new row.
    const { error: deleteByDiscordError } = await admin
      .from("discord_links")
      .delete()
      .eq("discord_user_id", discordUserId);
    if (deleteByDiscordError) {
      return errorResponse(deleteByDiscordError.message || "Failed clearing previous discord link.", 500);
    }

    const { error: deleteByUserError } = await admin
      .from("discord_links")
      .delete()
      .eq("hikari_user_id", hikariUserId);
    if (deleteByUserError) {
      return errorResponse(deleteByUserError.message || "Failed clearing previous user link.", 500);
    }

    const payload = {
      discord_user_id: discordUserId,
      hikari_user_id: hikariUserId,
      hikari_username: fallbackHandle,
    };

    const { data: linkedRow, error: upsertError } = await admin
      .from("discord_links")
      .upsert(payload, { onConflict: "discord_user_id" })
      .select("discord_user_id, hikari_user_id, hikari_username, linked_at")
      .single();

    if (upsertError) {
      return errorResponse(upsertError.message || "Failed to create Discord link.", 500);
    }

    return NextResponse.json({
      ok: true,
      linked: linkedRow,
      discord_name: discordName || null,
    });
  } catch (error) {
    return errorResponse(String(error || "Failed to link account."), 500);
  }
}
