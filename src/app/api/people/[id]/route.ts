import { requireRecruiter } from "@/lib/server/auth";
import { CANDIDATE_DETAIL_COLUMNS, toPerson } from "@/lib/server/candidates";
import { fromPostgrest, handle, HttpError, json } from "@/lib/server/http";

/** GET /api/people/{id} — one candidate with experience, education and skills. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { db } = await requireRecruiter(req);
  const { id } = await ctx.params;

  const { data, error } = await db.from("candidates").select(CANDIDATE_DETAIL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw new HttpError(404, "Candidate not found");
  return json(toPerson(data));
});
