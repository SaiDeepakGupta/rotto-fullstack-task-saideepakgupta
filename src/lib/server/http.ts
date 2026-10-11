import "server-only";
import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Map a PostgREST error to an HTTP error. `PTnnn` codes raised in SQL carry their status. */
export function fromPostgrest(error: PostgrestError): HttpError {
  const m = /^PT(\d{3})$/.exec(error.code ?? "");
  if (m) return new HttpError(Number(m[1]), error.message);
  if (error.code === "PGRST301" || error.code === "PGRST303") return new HttpError(401, "Invalid token");
  if (error.code === "23503") return new HttpError(404, "Not found");
  if (error.code === "22P02") return new HttpError(404, "Not found"); // malformed uuid
  console.error("Database error", error);
  return new HttpError(500, "Something went wrong");
}

/** Wrap a route handler so thrown HttpErrors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, ...(err.code ? { code: err.code } : {}) }, err.status);
      console.error(err);
      return json({ error: "Something went wrong" }, 500);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
}
