import { requireRecruiter } from "@/lib/server/auth";
import { fromPostgrest, handle, HttpError, json } from "@/lib/server/http";

/** DELETE /api/saved-briefs/{id} */
export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { db } = await requireRecruiter(req);
  const { id } = await ctx.params;
  const { data, error } = await db.from("saved_briefs").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw new HttpError(404, "Saved search not found");
  return json({ deleted: true, id });
});
