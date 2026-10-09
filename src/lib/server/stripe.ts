import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a `Stripe-Signature` header (t=<timestamp>,v1=<hex hmac>[,v1=...]) the
 * way Stripe's libraries do: HMAC-SHA256 of `${t}.${rawBody}` with the endpoint
 * secret, compared in constant time.
 *
 * There is no timestamp tolerance: replaying an old, correctly signed event is
 * harmless because processing is idempotent on the event id and ordered by the
 * event's `created` time.
 */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t") timestamp = value;
    else if (key === "v1" && value) signatures.push(value);
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest();
  return signatures.some((sig) => {
    if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
    return timingSafeEqual(expected, Buffer.from(sig, "hex"));
  });
}

export type SubscriptionEvent = {
  id: string;
  type: string;
  created: number;
  company: string | null;
  status: string | null;
};

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

/** Pull the fields we act on out of a verified event; null for events we ignore. */
export function parseSubscriptionEvent(body: unknown): SubscriptionEvent | null {
  if (!body || typeof body !== "object") return null;
  const e = body as Record<string, any>;
  if (typeof e.id !== "string" || typeof e.type !== "string" || typeof e.created !== "number") return null;
  if (!SUBSCRIPTION_EVENTS.has(e.type)) return null;
  const sub = e.data?.object ?? {};
  const company = typeof sub.metadata?.company === "string" ? sub.metadata.company : null;
  const status = typeof sub.status === "string" ? sub.status : null;
  return { id: e.id, type: e.type, created: e.created, company, status };
}
