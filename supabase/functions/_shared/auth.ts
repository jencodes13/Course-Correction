// Authentication utilities for Edge Functions

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function getSupabaseClient(authHeader?: string) {
  // For authenticated requests, use the user's JWT
  if (authHeader) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });
  }
  // For service operations, use service role
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export async function requireAuth(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return null;
  }

  const supabase = getSupabaseClient(authHeader);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { userId: user.id };
}

export async function trackApiUsage(
  userId: string,
  endpoint: string,
  model: string,
  tokensUsed?: number
) {
  const supabase = getSupabaseClient();

  await supabase.from("api_usage").insert({
    user_id: userId,
    endpoint,
    model,
    tokens_used: tokensUsed,
  });
}
