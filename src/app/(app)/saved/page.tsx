"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { FIELD_LABELS, LIST_FIELD_NAMES, valueLabel, yearsLabel, type Filters } from "@/lib/filters";
import type { SavedBrief, SearchCreated } from "@/lib/types";
import { useApp } from "@/components/app-context";
import { AlertIcon, ArrowRight, TrashIcon } from "@/components/icons";

function summary(f: Filters): string[] {
  const parts = LIST_FIELD_NAMES.flatMap((k) => (f[k] as string[]).map((v) => `${FIELD_LABELS[k]}: ${valueLabel(v)}`));
  if (f.open_to_work !== null) parts.push(f.open_to_work ? "Open to work" : "Not looking");
  const years = yearsLabel(f.min_years, f.max_years);
  if (years) parts.push(years);
  return parts;
}

export default function SavedPage() {
  const { plan, refreshPlan, setUpgradeOpen, toast } = useApp();
  const router = useRouter();
  const [saved, setSaved] = useState<SavedBrief[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const outOfSearches = plan?.plan === "free" && plan.searches_remaining === 0;

  useEffect(() => {
    api<SavedBrief[]>("/api/saved-briefs")
      .then(setSaved)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load saved searches."));
  }, []);

  async function rerun(s: SavedBrief) {
    if (outOfSearches) return setUpgradeOpen(true);
    setRunning(s.id);
    try {
      const res = await api<SearchCreated>("/api/search", { body: { brief: s.brief, filters: s.filters } });
      router.push(`/?search=${res.search_id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) setUpgradeOpen(true);
      else toast(err instanceof ApiError ? err.message : "Couldn't run the search");
      setRunning(null);
    } finally {
      refreshPlan();
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/saved-briefs/${id}`, { method: "DELETE" });
      setSaved((list) => list?.filter((s) => s.id !== id) ?? null);
      toast("Saved search deleted");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't delete");
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Saved searches</h1>
          <p className="page-sub">Run a saved search again to see who matches today.{outOfSearches ? " Re-running counts as a new search." : ""}</p>
        </div>
      </div>
      {error && (
        <div className="alert error" role="alert">
          <AlertIcon /> {error}
        </div>
      )}
      {saved && saved.length === 0 && (
        <div className="state">
          <h3>No saved searches yet</h3>
          <p>After a search, use “Save search” above the results to keep it here.</p>
          <Link href="/" className="btn btn-primary">Start a search</Link>
        </div>
      )}
      {saved && saved.length > 0 && (
        <div className="list">
          {saved.map((s) => (
            <div key={s.id} className="row">
              <div className="row-main">
                <div className="row-title">{s.brief}</div>
                <div className="mini-chips">
                  {summary(s.filters).map((t) => (
                    <span key={t} className="mini-chip">{t}</span>
                  ))}
                </div>
                <div className="row-sub">Saved {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
              </div>
              <div className="row-actions">
                <button className="btn btn-sm" onClick={() => rerun(s)} disabled={running !== null}>
                  {running === s.id ? <span className="spinner" /> : null} Run <ArrowRight />
                </button>
                <button className="btn btn-ghost btn-icon btn-sm btn-danger" aria-label="Delete saved search" onClick={() => remove(s.id)}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
