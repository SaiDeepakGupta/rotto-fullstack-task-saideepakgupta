import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./http";
import { userClient } from "./supabase";

export type Recruiter = { userId: string; db: SupabaseClient };

/** Authenticate the `Authorization: Bearer <supabase access token>` header. */
export async function requireRecruiter(req: Request): Promise<Recruiter> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new HttpError(401, "Missing bearer token");

  const db = userClient(match[1]);
  const { data, error } = await db.auth.getClaims(match[1]);
  const userId = data?.claims?.sub;
  if (error || !userId) throw new HttpError(401, "Invalid or expired token");
  return { userId, db };
}
