import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Use external URL if available, otherwise fall back to SUPABASE_URL
// This ensures invitation emails use the correct external IP instead of 127.0.0.1
const getSupabaseUrl = (): string => {
  const externalUrl = Deno.env.get("SUPABASE_EXTERNAL_URL");
  if (externalUrl) {
    return externalUrl;
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  // Replace 127.0.0.1 with 192.168.1.97 for local development with external access
  return supabaseUrl.replace("127.0.0.1", "192.168.1.97");
};

export const supabaseAdmin: SupabaseClient = createClient(
  getSupabaseUrl(),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
