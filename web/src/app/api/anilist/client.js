import { createClient } from "@supabase/supabase-js/dist/index.cjs";

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default client;