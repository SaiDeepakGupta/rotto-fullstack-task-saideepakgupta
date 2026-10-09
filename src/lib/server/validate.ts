import "server-only";
import { HttpError } from "./http";

export function parseShortlistName(body: unknown): string {
  const raw = (body as { name?: unknown } | null)?.name;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) throw new HttpError(400, "Give the shortlist a name.");
  if (name.length > 80) throw new HttpError(400, "Keep the name under 80 characters.");
  return name;
}

export function parseBrief(body: unknown): string {
  const raw = (body as { brief?: unknown } | null)?.brief;
  const brief = typeof raw === "string" ? raw.trim() : "";
  if (!brief) throw new HttpError(400, "Describe who you're looking for.");
  if (brief.length > 500) throw new HttpError(400, "Keep the brief under 500 characters.");
  return brief;
}
