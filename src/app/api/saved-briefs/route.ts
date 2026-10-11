import { requireRecruiter } from "@/lib/server/auth";
import { fromPostgrest, handle, HttpError, json, readJson } from "@/lib/server/http";
import { parseBrief } from "@/lib/server/validate";
import { parseClientFilters } from "@/lib/filters";

/** GET /api/saved-briefs — the company's saved searches, newest first. */
export const GET = handle(async (req: Request) => {
  const { db } = await requireRecruiter(req);
  const { data, error } = await db
    .from("saved_briefs")
    .select("id, brief, filters, created_at")
    .order("created_at", { ascending: false });
  if (error) throw fromPostgrest(error);
  return json(data);
});

/** POST /api/saved-briefs { brief, filters } */
export const POST = handle(async (req: Request) => {
  const { db } = await requireRecruiter(req);
  const body = (await readJson(req)) as { brief?: unknown; filters?: unknown } | null;
  const brief = parseBrief(body);
  // Store the filters as given (any JSON object). They are validated again
  // whenever the saved search is re-run, so nothing unchecked reaches SQL.
  const raw = body?.filters ?? {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "filters must be an object");
  const filters = parseClientFilters(raw) ?? raw;
  if (JSON.stringify(filters).length > 10_000) throw new HttpError(400, "filters are too large");

  const { data, error } = await db.from("saved_briefs").insert({ brief, filters }).select("id, brief, filters, created_at").single();
  if (error) throw fromPostgrest(error);
  return json(data, 201);
});
