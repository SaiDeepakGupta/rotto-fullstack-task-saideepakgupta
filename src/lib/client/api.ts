"use client";
import { browserSupabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** Call our API as the signed-in recruiter. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await browserSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "Please sign in again.");

  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: { Authorization: `Bearer ${token}`, ...(init.body !== undefined ? { "content-type": "application/json" } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "You appear to be offline. Check your connection and try again.");
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) await browserSupabase().auth.signOut();
    throw new ApiError(res.status, json?.error ?? "Something went wrong. Please try again.", json?.code);
  }
  return json as T;
}
