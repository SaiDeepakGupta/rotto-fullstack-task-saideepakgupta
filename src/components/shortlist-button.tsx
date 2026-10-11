"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { useApp } from "./app-context";
import { BookmarkIcon, CheckIcon, PlusIcon } from "./icons";

/** "Shortlist" button with a menu of the company's lists; tick to add, untick to remove. */
export function ShortlistButton({ personId, align = "right" }: { personId: string; align?: "left" | "right" }) {
  const { shortlists, refreshShortlists, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const onLists = shortlists.filter((s) => s.person_ids.includes(personId));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function toggle(listId: string, name: string, on: boolean) {
    setBusy(true);
    try {
      await api(`/api/shortlists/${listId}/people/${personId}`, { method: on ? "DELETE" : "POST" });
      await refreshShortlists();
      toast(on ? `Removed from ${name}` : `Added to ${name}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't update the shortlist");
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/shortlists", { body: { name } });
      await api(`/api/shortlists/${id}/people/${personId}`, { method: "POST" });
      await refreshShortlists();
      setNewName("");
      toast(`Added to ${name}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't create the shortlist");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-actions" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        className={`btn btn-sm ${onLists.length ? "is-on" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <BookmarkIcon fill={onLists.length ? "currentColor" : "none"} />
        {onLists.length ? (onLists.length === 1 ? onLists[0].name : `${onLists.length} lists`) : "Shortlist"}
      </button>
      {open && (
        <div className={`popover ${align}`} role="menu">
          <div className="popover-head">Add to shortlist</div>
          <div className="popover-list">
            {shortlists.length === 0 && <p className="row-sub" style={{ padding: "0 8px 8px" }}>No shortlists yet. Name your first one below.</p>}
            {shortlists.map((s) => {
              const on = s.person_ids.includes(personId);
              return (
                <button
                  key={s.id}
                  className="option"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  disabled={busy}
                  onClick={() => toggle(s.id, s.name, on)}
                >
                  <span className="check">{on && <CheckIcon width={12} height={12} strokeWidth={3} />}</span>
                  <span style={{ flex: 1 }}>{s.name}</span>
                  <span className="row-sub">{s.count}</span>
                </button>
              );
            })}
          </div>
          <form className="popover-foot" onSubmit={createAndAdd}>
            <input
              className="input"
              style={{ height: 32 }}
              placeholder="New shortlist"
              value={newName}
              maxLength={80}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="New shortlist name"
            />
            <button className="btn btn-sm btn-icon" style={{ flex: "none" }} disabled={busy || !newName.trim()} aria-label="Create and add">
              <PlusIcon />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
