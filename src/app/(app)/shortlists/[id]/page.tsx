"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { ShortlistDetail } from "@/lib/types";
import { useApp } from "@/components/app-context";
import { AlertIcon, ChevronLeft, XIcon } from "@/components/icons";
import { CardSkeletons, PersonCard } from "@/components/person-card";

export default function ShortlistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { shortlists, refreshShortlists, toast } = useApp();
  const [list, setList] = useState<ShortlistDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<ShortlistDetail>(`/api/shortlists/${id}`)
      .then(setList)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this shortlist."));
  }, [id]);

  // Reload when membership changes anywhere (e.g. from the profile drawer).
  const count = shortlists.find((s) => s.id === id)?.count;
  useEffect(load, [load, count]);

  async function remove(personId: string, name: string) {
    try {
      await api(`/api/shortlists/${id}/people/${personId}`, { method: "DELETE" });
      await refreshShortlists();
      toast(`Removed ${name}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't remove");
    }
  }

  return (
    <main className="page">
      <Link href="/shortlists" className="back">
        <ChevronLeft /> Shortlists
      </Link>
      {error ? (
        <div className="alert error" role="alert">
          <AlertIcon /> {error}
        </div>
      ) : !list ? (
        <CardSkeletons count={3} />
      ) : (
        <>
          <div className="page-head">
            <div>
              <h1 className="page-title">{list.name}</h1>
              <p className="page-sub">
                {list.people.length} {list.people.length === 1 ? "candidate" : "candidates"}
              </p>
            </div>
          </div>
          {list.people.length === 0 ? (
            <div className="state">
              <h3>This shortlist is empty</h3>
              <p>Run a search and use the Shortlist button on a candidate to add them here.</p>
              <Link href="/" className="btn btn-primary">Search candidates</Link>
            </div>
          ) : (
            <div className="cards">
              {list.people.map((p) => (
                <PersonCard
                  key={p.id}
                  person={p}
                  action={
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(p.id, p.full_name);
                      }}
                    >
                      <XIcon /> Remove
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
