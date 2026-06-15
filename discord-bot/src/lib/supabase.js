import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const isMissingTableError = (error) => {
  const code = String(error?.code || "");
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    text.includes("does not exist")
  );
};

