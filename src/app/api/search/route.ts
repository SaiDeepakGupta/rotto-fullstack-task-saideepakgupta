import { requireRecruiter } from "@/lib/server/auth";
import { fromPostgrest, handle, HttpError, json, readJson } from "@/lib/server/http";
import { briefToFilters } from "@/lib/server/llm";
import { parseBrief } from "@/lib/server/validate";
import { parseClientFilters } from "@/lib/filters";
import { searchesRemaining } from "@/lib/plan";

/**
 * POST /api/search  { brief, filters? }
 * Turns the brief into filters (or takes edited filters as given), charges one
 * search, and returns the first page. 402 once a free company has used its search.
 */
export const POST = handle(async (req: Request) => {
  const { db } = await requireRecruiter(req);
  const body = (await readJson(req)) as { brief?: unknown; filters?: unknown } | null;

  const brief = parseBrief(body);

  // Fail fast before paying for an LLM call. run_search re-checks atomically.
  const { data: company, error: planError } = await db
    .from("companies")
    .select("plan, searches_used")
    .maybeSingle();
  if (planError) throw fromPostgrest(planError);
  if (!company) throw new HttpError(403, "Not a recruiter");
  if (searchesRemaining(company.plan, company.searches_used) === 0) {
    throw new HttpError(402, "Your free search has been used. Upgrade to keep searching.", "search_limit");
  }

  let filters;
  if (body?.filters !== undefined) {
    filters = parseClientFilters(body.filters);
    if (!filters) throw new HttpError(400, "Invalid filters");
  } else {
    filters = await briefToFilters(brief);
  }

  const { data: run, error: runError } = await db.rpc("run_search", { p_brief: brief, p_filters: filters });
  if (runError) throw fromPostgrest(runError);

  const { data: page, error: pageError } = await db.rpc("search_page", { p_search_id: run.search_id, p_page: 1 });
  if (pageError) throw fromPostgrest(pageError);

  return json({
    search_id: run.search_id,
    brief,
    filters,
    total: run.total,
    results: page.results,
    searches_remaining: run.searches_remaining,
  });
});
