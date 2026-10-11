import type { Filters } from "./filters";
import type { Plan } from "./plan";

export type PersonSummary = {
  id: string;
  rank?: number;
  full_name: string;
  avatar_url: string;
  headline: string;
  current_title: string;
  current_company: string;
  current_company_logo_url: string;
  role: string;
  seniority: string;
  years_experience: number;
  city: string;
  state: string;
  open_to_work: boolean;
  skills: string[];
};

export type Experience = {
  title: string;
  company: string;
  company_logo_url: string;
  company_type: string;
  start_year: number;
  end_year: number | null;
  description: string;
};

export type Education = { school: string; degree: string; field: string; graduation_year: number };

export type Person = Omit<PersonSummary, "city" | "state" | "rank"> & {
  location: { city: string; state: string; country: string };
  experiences: Experience[];
  education: Education[];
};

export type SearchPage = {
  search_id: string;
  brief: string;
  filters: Filters;
  total: number;
  total_pages: number;
  page: number;
  results: PersonSummary[];
};

export type SearchCreated = {
  search_id: string;
  brief: string;
  filters: Filters;
  total: number;
  results: PersonSummary[];
  searches_remaining: number | null;
};

export type PlanInfo = { plan: Plan; searches_remaining: number | null; company: { id: string; name: string } };

export type Shortlist = { id: string; name: string; created_at: string; person_ids: string[]; count: number };
export type ShortlistDetail = { id: string; name: string; created_at: string; people: PersonSummary[] };
export type SavedBrief = { id: string; brief: string; filters: Filters; created_at: string };
