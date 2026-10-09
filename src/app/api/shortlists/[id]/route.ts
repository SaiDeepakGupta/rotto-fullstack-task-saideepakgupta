import { requireRecruiter } from "@/lib/server/auth";
import { CANDIDATE_SUMMARY_COLUMNS } from "@/lib/server/candidates";
import { fromPostgrest, handle, HttpError, json, readJson } from "@/lib/server/http";
import { parseShortlistName } from "@/lib/server/validate";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/shortlists/{id} — one shortlist with its candidates. */
export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { db } = await requireRecruiter(req);
  const { id } = await ctx.params;
  const { data, error } = await db
    .from("shortlists")
    .select(`id, name, created_at, shortlist_people(added_at, candidates(${CANDIDATE_SUMMARY_COLUMNS}))`)
    .eq("id", id)
    .order("added_at", { referencedTable: "shortlist_people", ascending: false })
    .maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw new HttpError(404, "Shortlist not found");

  const { shortlist_people, ...shortlist } = data;
  return json({ ...shortlist, people: shortlist_people.map((p) => p.candidates) });
});

/** PATCH /api/shortlists/{id} { name } — rename. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { db } = await requireRecruiter(req);
  const { id } = await ctx.params;
  const name = parseShortlistName(await readJson(req));
  const { data, error } = await db.from("shortlists").update({ name }).eq("id", id).select("id, name").maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw new HttpError(404, "Shortlist not found");
  return json(data);
});

/** DELETE /api/shortlists/{id} */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { db } = await requireRecruiter(req);
  const { id } = await ctx.params;
  const { data, error } = await db.from("shortlists").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw new HttpError(404, "Shortlist not found");
  return json({ deleted: true, id });
});
