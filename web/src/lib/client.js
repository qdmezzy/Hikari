import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[v0] Missing Supabase environment variables. Using a placeholder client so the UI can still render. " +
      "Auth and data features will not work until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
  );
}

// Fall back to a syntactically valid placeholder URL/key so createClient does not
// throw ("supabaseUrl is required") when env vars are absent. This keeps pages
// rendering for design work even without a configured Supabase project.
const client = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "public-anon-placeholder-key"
);

export default client;
