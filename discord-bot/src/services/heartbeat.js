import { supabase, isMissingTableError } from "../lib/supabase.js";

// Writes a heartbeat row so the website's /status page can tell whether the
// bot is alive. Upserts every minute; the status API treats a heartbeat older
// than ~5 minutes as "down". No-ops gracefully if the table doesn't exist yet.

const HEARTBEAT_INTERVAL_MS = 60 * 1000;
let warned = false;

const writeHeartbeat = async (client) => {
  try {
    await supabase.from("service_heartbeats").upsert(
      {
        service: "discord-bot",
        last_seen: new Date().toISOString(),
        meta: { guilds: client?.guilds?.cache?.size ?? null },
      },
      { onConflict: "service" },
    );
  } catch (error) {
    if (!warned && !isMissingTableError(error)) {
      warned = true;
      console.warn("[hikari-bot] heartbeat write failed:", error?.message || error);
    }
  }
};

export const startHeartbeat = (client) => {
  void writeHeartbeat(client);
  const timer = setInterval(() => void writeHeartbeat(client), HEARTBEAT_INTERVAL_MS);
  timer.unref?.();
  return timer;
};
