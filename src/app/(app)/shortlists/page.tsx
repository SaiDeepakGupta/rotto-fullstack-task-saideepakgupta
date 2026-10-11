"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { useApp } from "@/components/app-context";
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "@/components/icons";

export default function ShortlistsPage() {
  const { shortlists, refreshShortlists, toast } = useApp();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    refreshShortlists().finally(() => setLoaded(true));
  }, [refreshShortlists]);

  async function mutate(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      await refreshShortlists();
      toast(done);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Shortlists</h1>
          <p className="page-sub">Shared with everyone at your company.</p>
        </div>
      </div>

      <form
        className="create-row"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (n) mutate(() => api("/api/shortlists", { body: { name: n } }), `Created “${n}”`).then(() => setName(""));
        }}
      >
        <input className="input" placeholder="New shortlist name, e.g. Frontend hires Q4" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="New shortlist name" />
        <button className="btn btn-primary" style={{ height: 40 }} disabled={!name.trim()}>
          <PlusIcon /> Create
        </button>
      </form>

      {loaded && shortlists.length === 0 ? (
        <div className="state">
          <h3>No shortlists yet</h3>
          <p>Create one here, or use the Shortlist button on any candidate in your search results.</p>
        </div>
      ) : (
        <div className="list">
          {shortlists.map((s) => (
            <div key={s.id} className="row">
              {renaming?.id === s.id ? (
                <form
                  className="row-main"
                  style={{ display: "flex", gap: 8 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = renaming.name.trim();
                    if (n) mutate(() => api(`/api/shortlists/${s.id}`, { method: "PATCH", body: { name: n } }), "Renamed").then(() => setRenaming(null));
                  }}
                >
                  <input className="input" autoFocus value={renaming.name} maxLength={80} onChange={(e) => setRenaming({ id: s.id, name: e.target.value })} aria-label="Shortlist name" />
                  <button className="btn btn-icon" aria-label="Save name"><CheckIcon /></button>
                  <button type="button" className="btn btn-icon btn-ghost" aria-label="Cancel" onClick={() => setRenaming(null)}><XIcon /></button>
                </form>
              ) : (
                <>
                  <Link href={`/shortlists/${s.id}`} className="row-main">
                    <div className="row-title">{s.name}</div>
                    <div className="row-sub">
                      {s.count} {s.count === 1 ? "candidate" : "candidates"}
                    </div>
                  </Link>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Rename ${s.name}`} onClick={() => setRenaming({ id: s.id, name: s.name })}>
                      <PencilIcon />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm btn-danger"
                      aria-label={`Delete ${s.name}`}
                      onClick={() => confirm(`Delete “${s.name}”? The candidates stay in search.`) && mutate(() => api(`/api/shortlists/${s.id}`, { method: "DELETE" }), "Shortlist deleted")}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
