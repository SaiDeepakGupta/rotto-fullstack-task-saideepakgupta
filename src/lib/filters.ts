import { z } from "zod";
import {
  CITIES,
  COMPANIES,
  COMPANY_TYPES,
  DEGREES,
  FIELDS,
  ROLES,
  SCHOOLS,
  SENIORITIES,
  SKILLS,
} from "./vocabulary";

/**
 * The structured filters a brief is turned into. Shared by the server (LLM
 * output validation, SQL) and the UI (filter chips). Every list field is
 * OR-within-the-list except `skills`, which requires all of them.
 */
export const LIST_FIELDS = {
  roles: ROLES,
  seniorities: SENIORITIES,
  cities: CITIES,
  skills: SKILLS,
  company_types: COMPANY_TYPES,
  companies: COMPANIES,
  schools: SCHOOLS,
  degrees: DEGREES,
  fields: FIELDS,
} as const;

export type ListField = keyof typeof LIST_FIELDS;
export const LIST_FIELD_NAMES = Object.keys(LIST_FIELDS) as ListField[];

const MAX_YEARS = 50;

export const FiltersSchema = z
  .object({
    roles: z.array(z.enum(ROLES)).max(ROLES.length),
    seniorities: z.array(z.enum(SENIORITIES)).max(SENIORITIES.length),
    cities: z.array(z.enum(CITIES)).max(CITIES.length),
    skills: z.array(z.enum(SKILLS)).max(20),
    company_types: z.array(z.enum(COMPANY_TYPES)).max(COMPANY_TYPES.length),
    companies: z.array(z.enum(COMPANIES)).max(COMPANIES.length),
    schools: z.array(z.enum(SCHOOLS)).max(SCHOOLS.length),
    degrees: z.array(z.enum(DEGREES)).max(DEGREES.length),
    fields: z.array(z.enum(FIELDS)).max(FIELDS.length),
    open_to_work: z.boolean().nullable(),
    min_years: z.number().int().min(0).max(MAX_YEARS).nullable(),
    max_years: z.number().int().min(0).max(MAX_YEARS).nullable(),
    // Requirements from the brief that no filter can express. Any entry here
    // means the search returns nobody rather than people who don't fit.
    unsupported: z.array(z.string().trim().min(1).max(120)).max(10),
  })
  .strict();

export type Filters = z.infer<typeof FiltersSchema>;

export const EMPTY_FILTERS: Filters = {
  roles: [],
  seniorities: [],
  cities: [],
  skills: [],
  company_types: [],
  companies: [],
  schools: [],
  degrees: [],
  fields: [],
  open_to_work: null,
  min_years: null,
  max_years: null,
  unsupported: [],
};

export function hasAnyFilter(f: Filters): boolean {
  return (
    LIST_FIELD_NAMES.some((k) => f[k].length > 0) ||
    f.open_to_work !== null ||
    f.min_years !== null ||
    f.max_years !== null
  );
}

/** A search matches people only when every requirement is expressible and at least one exists. */
export function isMatchable(f: Filters): boolean {
  return f.unsupported.length === 0 && hasAnyFilter(f);
}

/**
 * Coerce untrusted model output into valid Filters. Values outside the
 * vocabulary are never dropped silently: they move to `unsupported`, so a
 * hallucinated filter makes the search return nothing instead of everyone.
 */
export function sanitizeModelFilters(raw: unknown): Filters {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Filters = structuredClone(EMPTY_FILTERS);

  for (const key of LIST_FIELD_NAMES) {
    const allowed: readonly string[] = LIST_FIELDS[key];
    const values = Array.isArray(obj[key]) ? (obj[key] as unknown[]) : [];
    for (const v of values) {
      if (typeof v !== "string") continue;
      if (allowed.includes(v)) {
        if (!(out[key] as string[]).includes(v)) (out[key] as string[]).push(v);
      } else {
        out.unsupported.push(v.slice(0, 120));
      }
    }
  }

  if (typeof obj.open_to_work === "boolean") out.open_to_work = obj.open_to_work;
  for (const key of ["min_years", "max_years"] as const) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = Math.min(MAX_YEARS, Math.max(0, Math.round(v)));
    }
  }
  if (out.min_years !== null && out.max_years !== null && out.min_years > out.max_years) {
    [out.min_years, out.max_years] = [out.max_years, out.min_years];
  }

  if (Array.isArray(obj.unsupported)) {
    for (const v of obj.unsupported) {
      if (typeof v === "string" && v.trim()) out.unsupported.push(v.trim().slice(0, 120));
    }
  }
  out.unsupported = [...new Set(out.unsupported)].slice(0, 10);
  return out;
}

/** JSON Schema handed to the model as its structured output format. */
export function filtersJsonSchema() {
  const list = (values: readonly string[], description: string) => ({
    type: "array",
    items: { type: "string", enum: [...values] },
    description,
  });
  const nullableInt = (description: string) => ({
    anyOf: [{ type: "integer" }, { type: "null" }],
    description,
  });
  return {
    type: "object",
    additionalProperties: false,
    required: [...LIST_FIELD_NAMES, "open_to_work", "min_years", "max_years", "unsupported"],
    properties: {
      roles: list(ROLES, "Job functions named in the brief (any of)."),
      seniorities: list(SENIORITIES, "Seniority levels named in the brief (any of)."),
      cities: list(CITIES, "Locations (any of). A state or region means every listed city in it."),
      skills: list(SKILLS, "Skills or technologies the candidate must have (all of)."),
      company_types: list(COMPANY_TYPES, "Has worked at this kind of company (any of)."),
      companies: list(COMPANIES, "Has worked at one of these employers."),
      schools: list(SCHOOLS, "Studied at one of these schools."),
      degrees: list(DEGREES, "Holds one of these degrees."),
      fields: list(FIELDS, "Studied one of these fields."),
      open_to_work: {
        anyOf: [{ type: "boolean" }, { type: "null" }],
        description: "true only when the brief asks for people open to work; otherwise null.",
      },
      min_years: nullableInt("Minimum years of experience, only if stated."),
      max_years: nullableInt("Maximum years of experience, only if stated."),
      unsupported: {
        type: "array",
        items: { type: "string" },
        description: "Each requirement in the brief that the fields above cannot express, in a few words.",
      },
    },
  };
}

// ───────────── Display helpers (used by the filter chips) ─────────────

export const FIELD_LABELS: Record<ListField | "open_to_work" | "years" | "unsupported", string> = {
  roles: "Role",
  seniorities: "Seniority",
  cities: "Location",
  skills: "Skill",
  company_types: "Worked at",
  companies: "Company",
  schools: "School",
  degrees: "Degree",
  fields: "Studied",
  open_to_work: "Availability",
  years: "Experience",
  unsupported: "Can't filter on",
};

const VALUE_LABELS: Record<string, string> = {
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  staff: "Staff",
  startup: "a startup",
  enterprise: "an enterprise",
};

export function valueLabel(value: string): string {
  return VALUE_LABELS[value] ?? value;
}

export function yearsLabel(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return min === max ? `${min} years` : `${min}–${max} years`;
  if (min !== null) return `${min}+ years`;
  if (max !== null) return `Up to ${max} years`;
  return null;
}

/** Validate filters sent by a client (a filter edit or a saved search). Missing fields default to empty. */
export function parseClientFilters(input: unknown): Filters | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const result = FiltersSchema.safeParse({ ...EMPTY_FILTERS, ...(input as object) });
  return result.success ? result.data : null;
}
