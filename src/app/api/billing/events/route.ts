import { env } from "@/lib/server/env";
import { handle, json } from "@/lib/server/http";
import { parseSubscriptionEvent, verifyStripeSignature } from "@/lib/server/stripe";
import { adminClient } from "@/lib/server/supabase";

/**
 * POST /api/billing/events — Stripe webhook. No recruiter token: the signature
 * is the authentication. 400 on a bad signature, 200 otherwise (repeats too).
 */
export const POST = handle(async (req: Request) => {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), env.stripeWebhookSecret())) {
    return json({ error: "Invalid signature" }, 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid payload" }, 400);
  }

  const event = parseSubscriptionEvent(body);
  if (!event || !event.company) return json({ received: true, result: "ignored" });

  const { data, error } = await adminClient().rpc("apply_billing_event", {
    p_event_id: event.id,
    p_type: event.type,
    p_created: event.created,
    p_company: event.company,
    p_status: event.status,
  });
  // A 5xx makes Stripe retry later; the event id keeps the retry idempotent.
  if (error) {
    console.error("Billing event failed", error);
    return json({ error: "Could not record event" }, 500);
  }
  return json({ received: true, result: data });
});
