import { requireRecruiter } from "@/lib/server/auth";
import { fromPostgrest, handle, HttpError, json } from "@/lib/server/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/search/{id}?page=N — a page of a stored result set. Never counts as a search. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { db } = await requireRecruiter(req);
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new HttpError(404, "Search not found");

  const raw = new URL(req.url).searchParams.get("page") ?? "1";
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1 || page > 10_000) throw new HttpError(400, "page must be a positive integer");

  const { data, error } = await db.rpc("search_page", { p_search_id: id, p_page: page });
  if (error) throw fromPostgrest(error);
  if (!data) throw new HttpError(404, "Search not found");

  return json({ ...data, total_pages: Math.ceil(data.total / data.page_size) });
});
