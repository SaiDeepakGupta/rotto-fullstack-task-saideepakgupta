/** Searches a company on the free plan gets in total. Mirrors public.free_search_limit() in SQL. */
export const FREE_SEARCH_LIMIT = 1;

export type Plan = "free" | "paid";

export function searchesRemaining(plan: Plan, used: number): number | null {
  return plan === "paid" ? null : Math.max(0, FREE_SEARCH_LIMIT - used);
}
