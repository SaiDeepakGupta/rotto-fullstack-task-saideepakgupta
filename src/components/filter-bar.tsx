"use client";

import { useEffect, useRef, useState } from "react";
import {
  FIELD_LABELS,
  LIST_FIELD_NAMES,
  LIST_FIELDS,
  valueLabel,
  yearsLabel,
  type Filters,
  type ListField,
} from "@/lib/filters";
import { CheckIcon, PlusIcon, XIcon } from "./icons";

type Editable = ListField | "open_to_work" | "years";
type Editing = { field: Editable; anchor: string } | null;

const ADDABLE: Editable[] = [...LIST_FIELD_NAMES, "open_to_work", "years"];

/**
 * The filters the search understood, as chips. Remove one with ×, click one to
 * edit it, or add another; every change calls onChange, which re-runs the search.
 */
export function FilterBar({
  filters,
  onChange,
  disabled,
  onLocked,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  disabled?: boolean;
  /** Set when the plan has no searches left: chips stay clickable but explain how to upgrade instead of editing. */
  onLocked?: () => void;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const update = (patch: Partial<Filters>) => {
    setEditing(null);
    onChange({ ...filters, ...patch });
  };

  const chips: { key: string; field: Editable | "unsupported"; label: string; remove: () => void }[] = [];
  for (const field of LIST_FIELD_NAMES) {
    for (const v of filters[field] as string[]) {
      chips.push({
        key: `${field}:${v}`,
        field,
        label: valueLabel(v),
        remove: () => update({ [field]: (filters[field] as string[]).filter((x) => x !== v) }),
      });
    }
  }
  if (filters.open_to_work !== null) {
    chips.push({
      key: "open_to_work",
      field: "open_to_work",
      label: filters.open_to_work ? "Open to work" : "Not looking",
      remove: () => update({ open_to_work: null }),
    });
  }
  const years = yearsLabel(filters.min_years, filters.max_years);
  if (years) chips.push({ key: "years", field: "years", label: years, remove: () => update({ min_years: null, max_years: null }) });
  for (const u of filters.unsupported) {
    chips.push({
      key: `unsupported:${u}`,
      field: "unsupported",
      label: u,
      remove: () => update({ unsupported: filters.unsupported.filter((x) => x !== u) }),
    });
  }

  return (
    <div className="filters">
      <div className="filters-label">Filters we understood</div>
      <div className="chips">
        {chips.map((chip) => (
          <span key={chip.key} className={`chip ${chip.field === "unsupported" ? "warn" : ""}`}>
            <button
              className="chip-main"
              disabled={disabled || (chip.field === "unsupported" && !onLocked)}
              onClick={() => (onLocked ? onLocked() : chip.field !== "unsupported" && setEditing({ field: chip.field, anchor: chip.key }))}
              title={chip.field === "unsupported" ? "Profiles don't contain this, so no one can match it" : onLocked ? "Upgrade to edit filters" : "Edit"}
            >
              <span className="chip-key">{FIELD_LABELS[chip.field]}</span>
              <span className="chip-value">{chip.label}</span>
            </button>
            <button className="chip-x" disabled={disabled} onClick={onLocked ?? chip.remove} aria-label={`Remove ${FIELD_LABELS[chip.field]} ${chip.label}`}>
              <XIcon width={13} height={13} />
            </button>
            {editing?.anchor === chip.key && chip.field !== "unsupported" && (
              <Editor field={chip.field} filters={filters} onApply={update} onClose={() => setEditing(null)} />
            )}
          </span>
        ))}
        <span style={{ position: "relative" }}>
          <button className="chip-add" disabled={disabled} onClick={() => onLocked ? onLocked() : setEditing(editing?.anchor === "add" ? null : { field: "roles", anchor: "add" })}>
            <PlusIcon width={13} height={13} /> Add filter
          </button>
          {editing?.anchor === "add" && <AddMenu filters={filters} onApply={update} onClose={() => setEditing(null)} />}
        </span>
      </div>
      {filters.unsupported.length > 0 && (
        <p className="filters-note">
          Profiles don&apos;t include the highlighted requirement, so nobody can be matched on it. {onLocked ? "Upgrade to remove it and search on the rest." : "Remove it to search on the rest."}
        </p>
      )}
    </div>
  );
}

function useDismiss(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const click = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const id = setTimeout(() => document.addEventListener("mousedown", click));
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return ref;
}

function AddMenu({ filters, onApply, onClose }: { filters: Filters; onApply: (p: Partial<Filters>) => void; onClose: () => void }) {
  const [field, setField] = useState<Editable | null>(null);
  const ref = useDismiss(onClose);
  if (field) return <Editor field={field} filters={filters} onApply={onApply} onClose={onClose} />;
  return (
    <div className="popover" ref={ref} role="menu">
      <div className="popover-head">Filter by</div>
      <div className="popover-list">
        {ADDABLE.map((f) => (
          <button key={f} className="option" role="menuitem" onClick={() => setField(f)}>
            {FIELD_LABELS[f]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Editor({
  field,
  filters,
  onApply,
  onClose,
}: {
  field: Editable;
  filters: Filters;
  onApply: (p: Partial<Filters>) => void;
  onClose: () => void;
}) {
  const ref = useDismiss(onClose);
  return (
    <div className="popover" ref={ref} role="dialog" aria-label={`Edit ${FIELD_LABELS[field]}`}>
      <div className="popover-head">{FIELD_LABELS[field]}</div>
      {field === "years" ? (
        <YearsEditor filters={filters} onApply={onApply} onClose={onClose} />
      ) : field === "open_to_work" ? (
        <AvailabilityEditor filters={filters} onApply={onApply} />
      ) : (
        <ListEditor field={field} filters={filters} onApply={onApply} onClose={onClose} />
      )}
    </div>
  );
}

function ListEditor({ field, filters, onApply, onClose }: { field: ListField; filters: Filters; onApply: (p: Partial<Filters>) => void; onClose: () => void }) {
  const options: readonly string[] = LIST_FIELDS[field];
  const [selected, setSelected] = useState<string[]>(filters[field] as string[]);
  const [query, setQuery] = useState("");
  const shown = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));
  const toggle = (v: string) => setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  return (
    <>
      {options.length > 8 && (
        <div className="popover-search">
          <input className="input" autoFocus placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      <div className="popover-list">
        {shown.map((o) => (
          <button key={o} className="option" role="menuitemcheckbox" aria-checked={selected.includes(o)} onClick={() => toggle(o)}>
            <span className="check">{selected.includes(o) && <CheckIcon width={12} height={12} strokeWidth={3} />}</span>
            {valueLabel(o)}
          </button>
        ))}
        {shown.length === 0 && <p className="row-sub" style={{ padding: 8 }}>Profiles don&apos;t include “{query}”.</p>}
      </div>
      <div className="popover-foot">
        <button className="btn btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-sm btn-primary" onClick={() => onApply({ [field]: options.filter((o) => selected.includes(o)) })}>
          Apply
        </button>
      </div>
      {field === "skills" && <p className="row-sub" style={{ padding: "0 12px 10px" }}>Candidates must have every selected skill.</p>}
    </>
  );
}

function AvailabilityEditor({ filters, onApply }: { filters: Filters; onApply: (p: Partial<Filters>) => void }) {
  const choices: [boolean | null, string][] = [[true, "Open to work"], [false, "Not looking"], [null, "Anyone"]];
  return (
    <div className="popover-list">
      {choices.map(([value, label]) => (
        <button key={label} className="option" role="menuitemradio" aria-checked={filters.open_to_work === value} onClick={() => onApply({ open_to_work: value })}>
          <span className="check" style={{ borderRadius: "50%" }}>{filters.open_to_work === value && <CheckIcon width={12} height={12} strokeWidth={3} />}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

function YearsEditor({ filters, onApply, onClose }: { filters: Filters; onApply: (p: Partial<Filters>) => void; onClose: () => void }) {
  const [min, setMin] = useState(filters.min_years?.toString() ?? "");
  const [max, setMax] = useState(filters.max_years?.toString() ?? "");
  const parse = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.min(50, Math.round(Number(v)) || 0)));
  return (
    <>
      <div className="years-row">
        <input className="input" inputMode="numeric" placeholder="Min" aria-label="Minimum years" value={min} onChange={(e) => setMin(e.target.value)} autoFocus />
        <span className="row-sub">to</span>
        <input className="input" inputMode="numeric" placeholder="Max" aria-label="Maximum years" value={max} onChange={(e) => setMax(e.target.value)} />
        <span className="row-sub">years</span>
      </div>
      <div className="popover-foot">
        <button className="btn btn-sm" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => {
            let [lo, hi] = [parse(min), parse(max)];
            if (lo !== null && hi !== null && lo > hi) [lo, hi] = [hi, lo];
            onApply({ min_years: lo, max_years: hi });
          }}
        >
          Apply
        </button>
      </div>
    </>
  );
}
