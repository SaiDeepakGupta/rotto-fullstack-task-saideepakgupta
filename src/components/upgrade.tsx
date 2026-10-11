"use client";

import { useEffect } from "react";
import { FREE_SEARCH_LIMIT } from "@/lib/plan";
import { useApp } from "./app-context";
import { SparkIcon } from "./icons";

/** Explains the free plan and how upgrading works (billing happens in Stripe, not in the app). */
export function UpgradeModal() {
  const { upgradeOpen, setUpgradeOpen, plan } = useApp();

  useEffect(() => {
    if (!upgradeOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setUpgradeOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [upgradeOpen, setUpgradeOpen]);

  if (!upgradeOpen) return null;
  const paid = plan?.plan === "paid";

  return (
    <>
      <div className="scrim" onClick={() => setUpgradeOpen(false)} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
        <h2 id="upgrade-title">{paid ? "You're on the Paid plan" : "Upgrade to search without limits"}</h2>
        <div className="plan-compare">
          <div className={`plan-box ${paid ? "" : "current"}`}>
            <strong>Free{paid ? "" : " · current"}</strong>
            {FREE_SEARCH_LIMIT} search in total. Paging through its results is always free.
          </div>
          <div className={`plan-box ${paid ? "current" : ""}`}>
            <strong>Paid{paid ? " · current" : ""}</strong>
            Unlimited searches, filter edits and re-runs of saved searches.
          </div>
        </div>
        {paid ? (
          <p>Your company has an active subscription. If it ends, you'll move back to the Free plan automatically.</p>
        ) : (
          <>
            <p>Upgrading is handled by your company's billing admin, outside HireFast:</p>
            <ol>
              <li>Your admin starts a HireFast subscription in Stripe for {plan?.company.name ?? "your company"}.</li>
              <li>As soon as Stripe confirms the subscription is active, this account switches to Paid. No sign-out needed.</li>
            </ol>
          </>
        )}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => setUpgradeOpen(false)}>
            Got it
          </button>
        </div>
      </div>
    </>
  );
}

/** Inline panel shown where a search would have run when the free search is used up. */
export function UpgradeCard() {
  const { setUpgradeOpen } = useApp();
  return (
    <div className="upgrade-card">
      <h3>You've used your free search</h3>
      <p>
        The Free plan includes {FREE_SEARCH_LIMIT} search. You can still page through its results, view candidates and
        manage shortlists. Upgrade to run new searches, edit filters and re-run saved searches.
      </p>
      <button className="btn btn-primary" onClick={() => setUpgradeOpen(true)}>
        <SparkIcon /> How to upgrade
      </button>
    </div>
  );
}
