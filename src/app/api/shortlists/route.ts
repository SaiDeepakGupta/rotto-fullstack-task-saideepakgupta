import { requireRecruiter } from "@/lib/server/auth";
import { fromPostgrest, handle, json, readJson } from "@/lib/server/http";
import { parseShortlistName } from "@/lib/server/validate";

/** GET /api/shortlists — the company's shortlists, newest first, with who is on each. */
export const GET = handle(async (req: Request) => {
  const { db } = await requireRecruiter(req);
  const { data, error } = await db
    .from("shortlists")
    .select("id, name, created_at, shortlist_people(candidate_id)")
    .order("created_at", { ascending: false });
  if (error) throw fromPostgrest(error);

  return json(
    data.map(({ shortlist_people, ...s }) => ({
      ...s,
      person_ids: shortlist_people.map((p) => p.candidate_id),
      count: shortlist_people.length,
    })),
  );
});

/** POST /api/shortlists { name } — create one for the caller's company. */
export const POST = handle(async (req: Request) => {
  const { db } = await requireRecruiter(req);
  const name = parseShortlistName(await readJson(req));
  const { data, error } = await db.from("shortlists").insert({ name }).select("id, name, created_at").single();
  if (error) throw fromPostgrest(error);
  return json(data, 201);
});
