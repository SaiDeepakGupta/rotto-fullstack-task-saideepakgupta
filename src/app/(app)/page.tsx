"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { isMatchable, type Filters } from "@/lib/filters";
import type { SearchCreated, SearchPage } from "@/lib/types";
import { useApp } from "@/components/app-context";
import { FilterBar } from "@/components/filter-bar";
import { AlertIcon, ArrowRight, BookmarkIcon, CheckIcon, ChevronLeft, ChevronRight } from "@/components/icons";
import { CardSkeletons, PersonCard } from "@/components/person-card";
import { UpgradeCard } from "@/components/upgrade";

const PAGE_SIZE = 20;
const EXAMPLES = [
  "Senior React engineers in New York who have worked at a startup",
  "Data scientists with a PhD",
  "Backend engineers in Austin who know Go and Kubernetes",
  "Product designers in San Francisco open to work",
];

type Current = { searchId: string; brief: string; filters: Filters; total: number; page: number; results: SearchPage["results"] };
type Status = "idle" | "searching" | "paging" | "error";

export default function SearchRoute() {
  return (
    <Suspense>
      <SearchPageView />
    </Suspense>
  );
}

function SearchPageView() {
  const { plan, refreshPlan, toast, setUpgradeOpen, setLastSearchHref } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const urlSearch = params.get("search");
  const urlPage = Math.max(1, Number(params.get("page")) || 1);

  const [brief, setBrief] = useState("");
  const [current, setCurrent] = useState<Current | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [pending, setPending] = useState<"brief" | "filters">("brief");
  const [error, setError] = useState<ApiError | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const lastRun = useRef<{ brief: string; filters?: Filters } | null>(null);
  const resultsTop = useRef<HTMLDivElement>(null);

  const outOfSearches = plan?.plan === "free" && plan.searches_remaining === 0;

  // Remember the search on screen so the Search tab brings the recruiter back to it.
  useEffect(() => {
    setLastSearchHref(urlSearch ? `/?search=${urlSearch}${urlPage > 1 ? `&page=${urlPage}` : ""}` : "/");
  }, [urlSearch, urlPage, setLastSearchHref]);

  // Load whichever search/page the URL points at (deep links, back/forward, reloads).
  useEffect(() => {
    if (!urlSearch) {
      setCurrent(null);
      return;
    }
    if (current?.searchId === urlSearch && current.page === urlPage) return;
    let cancelled = false;
    lastRun.current = null;
    setError(null);
    setStatus("paging");
    api<SearchPage>(`/api/search/${urlSearch}?page=${urlPage}`)
      .then((p) => {
        if (cancelled) return;
        setCurrent({ searchId: p.search_id, brief: p.brief, filters: p.filters, total: p.total, page: p.page, results: p.results });
        setBrief((b) => b || p.brief);
        setStatus("idle");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch, urlPage, reloadKey]);

  const run = useCallback(
    async (text: string, filters?: Filters) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      lastRun.current = { brief: trimmed, filters };
      setPending(filters ? "filters" : "brief");
      setStatus("searching");
      setError(null);
      try {
        const res = await api<SearchCreated>("/api/search", { body: filters ? { brief: trimmed, filters } : { brief: trimmed } });
        setCurrent({ searchId: res.search_id, brief: res.brief, filters: res.filters, total: res.total, page: 1, results: res.results });
        setStatus("idle");
        router.push(`/?search=${res.search_id}`, { scroll: false });
      } catch (err) {
        setError(err instanceof ApiError ? err : new ApiError(500, "Something went wrong."));
        setStatus("error");
      } finally {
        refreshPlan();
      }
    },
    [router, refreshPlan],
  );

  function goToPage(page: number) {
    if (!current) return;
    router.push(`/?search=${current.searchId}&page=${page}`, { scroll: false });
    resultsTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveSearch() {
    if (!current) return;
    try {
      await api("/api/saved-briefs", { body: { brief: current.brief, filters: current.filters } });
      setSavedKey(current.searchId);
      toast("Search saved");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't save the search");
    }
  }

  const totalPages = current ? Math.max(1, Math.ceil(current.total / PAGE_SIZE)) : 0;
  const busy = status === "searching";

  return (
    <main className={`page ${current || busy ? "compact" : ""}`}>
      <section className="search-hero">
        <h1>Who are you looking for?</h1>
        <p>Describe the person in plain English. We&apos;ll turn it into filters you can adjust.</p>
        <form
          className="brief-box"
          onSubmit={(e) => {
            e.preventDefault();
            run(brief);
          }}
        >
          <label htmlFor="brief" className="sr-only">Search brief</label>
          <textarea
            id="brief"
            rows={2}
            maxLength={500}
            value={brief}
            placeholder="e.g. Senior React engineers in New York who have worked at a startup"
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!outOfSearches) run(brief);
              }
            }}
          />
          <div className="brief-actions">
            <span className="brief-hint">
              {plan?.plan === "free" ? (
                <>
                  <strong>Free plan:</strong> {plan.searches_remaining} {plan.searches_remaining === 1 ? "search" : "searches"} left · paging through results is free
                </>
              ) : (
                <>Press Enter to search</>
              )}
            </span>
            <button className="btn btn-primary" disabled={busy || !brief.trim() || outOfSearches} title={outOfSearches ? "Upgrade to run another search" : undefined}>
              {busy && pending === "brief" ? <span className="spinner" /> : null}
              Search <ArrowRight />
            </button>
          </div>
        </form>
        {!current && !busy && !outOfSearches && (
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="example" onClick={() => setBrief(ex)}>
                {ex}
              </button>
            ))}
          </div>
        )}
      </section>

      {((outOfSearches && !busy) || error?.status === 402) && <UpgradeCard />}

      {current && (
        <FilterBar
          filters={current.filters}
          disabled={busy}
          onLocked={outOfSearches ? () => setUpgradeOpen(true) : undefined}
          onChange={(next) => run(current.brief, next)}
        />
      )}
      {current && plan?.plan === "free" && (
        <p className="filters-note">
          {outOfSearches ? "Changing a filter runs a new search. Upgrade to edit filters." : "Changing a filter runs a new search."}
        </p>
      )}

      <div ref={resultsTop} style={{ scrollMarginTop: 72 }} />

      {status === "error" && error && error.status !== 402 && (
        <div className="alert error" role="alert">
          <AlertIcon /> <span>{error.message}</span>
          {error.status !== 400 && (
            <button
              className="btn btn-sm"
              onClick={() => (lastRun.current ? run(lastRun.current.brief, lastRun.current.filters) : setReloadKey((k) => k + 1))}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {busy && (
        <>
          <div className="thinking" role="status">
            <span className="spinner" /> {pending === "brief" ? "Reading your brief and finding matches…" : "Updating results…"}
          </div>
          <CardSkeletons />
        </>
      )}

      {!busy && current && (
        <>
          <div className="results-head">
            <div className="results-count">
              {current.total.toLocaleString()} {current.total === 1 ? "person" : "people"}
              {current.total > 1 && <span>Open to work first, then most experienced</span>}
            </div>
            {current.total > 0 && (
              <button className={`btn btn-sm ${savedKey === current.searchId ? "is-on" : ""}`} onClick={saveSearch} disabled={savedKey === current.searchId}>
                {savedKey === current.searchId ? <CheckIcon /> : <BookmarkIcon />}
                {savedKey === current.searchId ? "Saved" : "Save search"}
              </button>
            )}
          </div>

          {status === "paging" ? (
            <CardSkeletons />
          ) : current.total === 0 ? (
            <EmptyState filters={current.filters} locked={outOfSearches} />
          ) : (
            <div className="cards">
              {current.results.map((p) => (
                <PersonCard key={p.id} person={p} highlightSkills={current.filters.skills} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="pager" aria-label="Pages">
              <button className="btn btn-sm" disabled={current.page <= 1 || status === "paging"} onClick={() => goToPage(current.page - 1)}>
                <ChevronLeft /> Previous
              </button>
              <span>
                Page {current.page} of {totalPages}
              </span>
              <button className="btn btn-sm" disabled={current.page >= totalPages || status === "paging"} onClick={() => goToPage(current.page + 1)}>
                Next <ChevronRight />
              </button>
            </nav>
          )}
        </>
      )}

      {!busy && !current && status === "paging" && <CardSkeletons />}
    </main>
  );
}

function EmptyState({ filters, locked }: { filters: Filters; locked: boolean }) {
  if (filters.unsupported.length > 0) {
    return (
      <div className="state">
        <h3>No one can match this brief</h3>
        <p>
          Profiles don&apos;t record {filters.unsupported.map((u) => `“${u}”`).join(", ")}, so we won&apos;t guess.{" "}
          {locked ? "Upgrade to remove that filter and search on the rest." : "Remove that filter above to search on the rest."}
        </p>
      </div>
    );
  }
  if (!isMatchable(filters)) {
    return (
      <div className="state">
        <h3>Tell us a bit more</h3>
        <p>We couldn&apos;t find anything specific to search for. Try a role, location, skill, seniority or school.</p>
      </div>
    );
  }
  return (
    <div className="state">
      <h3>No one matches all of these filters</h3>
      <p>{locked ? "Upgrade to remove or loosen a filter and widen the search." : "Remove or loosen a filter above to widen the search."}</p>
    </div>
  );
}
