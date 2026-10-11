"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Person } from "@/lib/types";
import { useApp } from "./app-context";
import { Avatar, Logo } from "./avatar";
import { AlertIcon, BriefcaseIcon, PinIcon, XIcon } from "./icons";
import { seniorityLabel, yearsText } from "./person-card";
import { ShortlistButton } from "./shortlist-button";

/** Candidate profile in a side panel (full screen on phones). */
export function PersonDrawer() {
  const { personId, openPerson } = useApp();
  const [person, setPerson] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    setPerson(null);
    setError(null);
    api<Person>(`/api/people/${encodeURIComponent(personId)}`)
      .then((p) => !cancelled && setPerson(p))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Couldn't load this profile."));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openPerson(null);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
    };
  }, [personId, openPerson]);

  if (!personId) return null;

  return (
    <>
      <div className="scrim" onClick={() => openPerson(null)} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Candidate profile">
        <div className="drawer-bar">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openPerson(null)} aria-label="Close">
            <XIcon />
          </button>
          <span style={{ flex: 1 }} />
          {person && <ShortlistButton personId={person.id} />}
        </div>
        <div className="drawer-body">
          {error && (
            <div className="alert error">
              <AlertIcon /> {error}
            </div>
          )}
          {!person && !error && <DrawerSkeleton />}
          {person && <Profile person={person} />}
        </div>
      </aside>
    </>
  );
}

function Profile({ person }: { person: Person }) {
  return (
    <>
      <div className="profile-head">
        <Avatar src={person.avatar_url} name={person.full_name} large />
        <div>
          <h2>{person.full_name}</h2>
          <div className="card-sub">{person.headline}</div>
          <div className="meta">
            <span>
              <PinIcon width={13} height={13} /> {person.location.city}, {person.location.state}
            </span>
            <span>
              <BriefcaseIcon width={13} height={13} /> {seniorityLabel(person.seniority)} {person.role} · {yearsText(person.years_experience)}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            {person.open_to_work ? <span className="badge open">Open to work</span> : <span className="badge muted">Not looking</span>}
          </div>
        </div>
      </div>

      <section className="section">
        <h3>Skills</h3>
        <div className="skills">
          {person.skills.map((s) => (
            <span key={s} className="skill">
              {s}
            </span>
          ))}
        </div>
      </section>

      <section className="section">
        <h3>Experience</h3>
        <div className="timeline">
          {person.experiences.map((e, i) => (
            <div key={i} className="tl-item">
              <Logo src={e.company_logo_url} size="md" />
              <div>
                <div className="tl-title">{e.title}</div>
                <div className="tl-sub">
                  {e.company} <span className="mini-chip">{e.company_type === "startup" ? "Startup" : "Enterprise"}</span>
                  <span>
                    {e.start_year} – {e.end_year ?? "Present"}
                  </span>
                </div>
                <p className="tl-desc">{e.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h3>Education</h3>
        <div className="timeline">
          {person.education.map((e, i) => (
            <div key={i}>
              <div className="tl-title">{e.school}</div>
              <div className="tl-sub">
                {e.degree}, {e.field} · {e.graduation_year}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function DrawerSkeleton() {
  return (
    <div style={{ display: "grid", gap: 12 }} aria-label="Loading profile">
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div className="skeleton" style={{ width: 72, height: 72, borderRadius: "50%" }} />
        <div style={{ flex: 1, display: "grid", gap: 8 }}>
          <div className="skeleton" style={{ height: 18, width: "50%" }} />
          <div className="skeleton" style={{ height: 12, width: "70%" }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 80, marginTop: 16 }} />
      <div className="skeleton" style={{ height: 120 }} />
    </div>
  );
}
