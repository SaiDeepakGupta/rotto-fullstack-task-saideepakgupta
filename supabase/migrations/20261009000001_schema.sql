-- HireFast schema: shared candidates, company-scoped recruiter data, billing state.

-- ───────────────────────── Companies & recruiters ─────────────────────────

create table public.companies (
  id                     text primary key,               -- 'acme', 'globex'
  name                   text not null,
  plan                   text not null default 'free' check (plan in ('free', 'paid')),
  searches_used          integer not null default 0 check (searches_used >= 0),
  subscription_status    text,
  -- `created` of the newest Stripe event applied; older events are ignored.
  billing_event_created  bigint
);

create table public.recruiters (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  company_id  text not null references public.companies (id),
  email       text not null
);
create index recruiters_company_idx on public.recruiters (company_id);

-- The calling recruiter's company. SECURITY DEFINER so RLS policies can use it
-- without granting read access to every recruiter row.
create function public.current_company_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select company_id from public.recruiters where user_id = auth.uid()
$$;

-- ───────────────────────── Candidates (shared) ─────────────────────────

create table public.candidates (
  id                        text primary key,
  full_name                 text not null,
  avatar_url                text,
  headline                  text,
  current_title             text,
  current_company           text,
  current_company_logo_url  text,
  role                      text not null,
  seniority                 text not null,
  years_experience          integer not null,
  city                      text not null,
  state                     text,
  country                   text,
  open_to_work              boolean not null,
  skills                    text[] not null default '{}',
  experiences               jsonb not null default '[]',
  education                 jsonb not null default '[]',
  -- Denormalised arrays from experiences/education so every filter is an
  -- indexable array operator instead of a JSON scan.
  company_types             text[] not null default '{}',
  companies                 text[] not null default '{}',
  schools                   text[] not null default '{}',
  degrees                   text[] not null default '{}',
  fields                    text[] not null default '{}'
);

create index candidates_role_idx       on public.candidates (role);
create index candidates_city_idx       on public.candidates (city);
create index candidates_seniority_idx  on public.candidates (seniority);
create index candidates_skills_idx     on public.candidates using gin (skills);
create index candidates_ctypes_idx     on public.candidates using gin (company_types);
create index candidates_companies_idx  on public.candidates using gin (companies);
create index candidates_schools_idx    on public.candidates using gin (schools);
create index candidates_degrees_idx    on public.candidates using gin (degrees);
create index candidates_fields_idx     on public.candidates using gin (fields);

-- ───────────────────────── Searches ─────────────────────────

create table public.searches (
  id            uuid primary key default gen_random_uuid(),
  company_id    text not null references public.companies (id),
  recruiter_id  uuid not null references auth.users (id),
  brief         text not null,
  filters       jsonb not null,
  total         integer not null,
  created_at    timestamptz not null default now()
);
create index searches_company_idx on public.searches (company_id, created_at desc);

-- The ranked result set is persisted once, so paging is a primary-key range read.
create table public.search_results (
  search_id     uuid not null references public.searches (id) on delete cascade,
  rank          integer not null,
  candidate_id  text not null references public.candidates (id),
  primary key (search_id, rank)
);

-- ───────────────────────── Shortlists & saved briefs ─────────────────────────

create table public.shortlists (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null default public.current_company_id() references public.companies (id),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  created_by  uuid default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now()
);
create index shortlists_company_idx on public.shortlists (company_id, created_at desc);

create table public.shortlist_people (
  shortlist_id  uuid not null references public.shortlists (id) on delete cascade,
  candidate_id  text not null references public.candidates (id),
  added_at      timestamptz not null default now(),
  primary key (shortlist_id, candidate_id)
);

create table public.saved_briefs (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null default public.current_company_id() references public.companies (id),
  brief       text not null check (char_length(brief) between 1 and 500),
  filters     jsonb not null,
  created_by  uuid default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now()
);
create index saved_briefs_company_idx on public.saved_briefs (company_id, created_at desc);

-- ───────────────────────── Billing ─────────────────────────

create table public.billing_events (
  id           text primary key,          -- Stripe event id; makes processing idempotent
  company_id   text,
  type         text not null,
  created      bigint not null,
  status       text,
  applied      boolean not null,
  received_at  timestamptz not null default now()
);
