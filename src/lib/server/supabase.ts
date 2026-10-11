import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/**
 * A client that acts as the signed-in recruiter: every query runs under their
 * token, so Postgres row level security decides what they can see or change.
 */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

let serviceClient: SupabaseClient | undefined;

/** Bypasses RLS. Used only by the Stripe webhook, which has no recruiter. */
export function adminClient(): SupabaseClient {
  serviceClient ??= createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), { auth: noSession });
  return serviceClient;
}
