import { requireRecruiter } from "@/lib/server/auth";
import { fromPostgrest, handle, HttpError, json } from "@/lib/server/http";
import { searchesRemaining } from "@/lib/plan";

/** GET /api/plan — { plan, searches_remaining } (null when unlimited). */
export const GET = handle(async (req: Request) => {
  const { db } = await requireRecruiter(req);
  const { data, error } = await db.from("companies").select("id, name, plan, searches_used").maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw new HttpError(403, "Not a recruiter");

  return json({
    plan: data.plan,
    searches_remaining: searchesRemaining(data.plan, data.searches_used),
    company: { id: data.id, name: data.name },
  });
});
