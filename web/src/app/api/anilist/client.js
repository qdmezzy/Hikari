import { createClient } from "@supabase/supabase-js/dist/index.cjs";

// Fall back to a valid placeholder so createClient does not throw when env vars
// are missing.
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-placeholder-key"
);

export default client;
