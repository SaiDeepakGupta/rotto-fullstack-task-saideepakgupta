import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRecruiter } from "@/lib/server/auth";
import { fromPostgrest, handle, HttpError, json } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string; personId: string }> };

/** RLS hides other companies' shortlists, so "not visible" and "doesn't exist" are both 404. */
async function assertShortlist(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("shortlists").select("id").eq("id", id).maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw new HttpError(404, "Shortlist not found");
}

/** POST — add a candidate. Adding someone already on the list changes nothing. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { db } = await requireRecruiter(req);
  const { id, personId } = await ctx.params;
  await assertShortlist(db, id);

  const { error } = await db
    .from("shortlist_people")
    .upsert({ shortlist_id: id, candidate_id: personId }, { onConflict: "shortlist_id,candidate_id", ignoreDuplicates: true });
  if (error) {
    if (error.code === "23503") throw new HttpError(404, "Candidate not found");
    throw fromPostgrest(error);
  }
  return json({ shortlist_id: id, person_id: personId, on_shortlist: true });
});

/** DELETE — remove a candidate. Removing someone not on the list is a no-op. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { db } = await requireRecruiter(req);
  const { id, personId } = await ctx.params;
  await assertShortlist(db, id);

  const { error } = await db.from("shortlist_people").delete().eq("shortlist_id", id).eq("candidate_id", personId);
  if (error) throw fromPostgrest(error);
  return json({ shortlist_id: id, person_id: personId, on_shortlist: false });
});
