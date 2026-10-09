"use client";

import type { PersonSummary } from "@/lib/types";
import { useApp } from "./app-context";
import { Avatar, Logo } from "./avatar";
import { BriefcaseIcon, PinIcon } from "./icons";
import { ShortlistButton } from "./shortlist-button";

export function seniorityLabel(s: string) {
  return { junior: "Junior", mid: "Mid-level", senior: "Senior", staff: "Staff" }[s] ?? s;
}

export function yearsText(n: number) {
  return n === 0 ? "Under 1 year" : `${n} ${n === 1 ? "year" : "years"}`;
}

/** One candidate in a result list or shortlist. Click opens the profile. */
export function PersonCard({
  person,
  highlightSkills = [],
  action,
}: {
  person: PersonSummary;
  highlightSkills?: string[];
  action?: React.ReactNode;
}) {
  const { openPerson } = useApp();
  const skills = [...person.skills].sort((a, b) => Number(highlightSkills.includes(b)) - Number(highlightSkills.includes(a)));

  return (
    <article
      className="card"
      role="button"
      tabIndex={0}
      onClick={() => openPerson(person.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        openPerson(person.id);
      }}
      aria-label={`${person.full_name}, ${person.current_title}`}
    >
      <Avatar src={person.avatar_url} name={person.full_name} />
      <div style={{ minWidth: 0 }}>
        <div className="card-name">
          {person.full_name}
          {person.open_to_work && <span className="badge open">Open to work</span>}
        </div>
        <div className="card-sub">
          {person.current_title} at
          <Logo src={person.current_company_logo_url} />
          {person.current_company}
        </div>
        <div className="meta">
          <span>
            <PinIcon width={13} height={13} /> {person.city}, {person.state}
          </span>
          <span>
            <BriefcaseIcon width={13} height={13} /> {seniorityLabel(person.seniority)} · {yearsText(person.years_experience)}
          </span>
        </div>
        <div className="skills">
          {skills.map((s) => (
            <span key={s} className={`skill ${highlightSkills.includes(s) ? "hit" : ""}`}>
              {s}
            </span>
          ))}
        </div>
      </div>
      {action ?? <ShortlistButton personId={person.id} />}
    </article>
  );
}

export function CardSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="cards" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skel-card">
          <div className="skeleton" style={{ width: 52, height: 52, borderRadius: "50%" }} />
          <div style={{ display: "grid", gap: 8 }}>
            <div className="skeleton" style={{ height: 14, width: "40%" }} />
            <div className="skeleton" style={{ height: 12, width: "60%" }} />
            <div className="skeleton" style={{ height: 12, width: "75%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
