-- Row level security, grants, and the server-side functions for search and billing.
--
-- Tenant isolation lives here, not in the API: a recruiter's Supabase token can
-- only ever see or change rows that belong to their own company.

-- ───────────────────────── Grants ─────────────────────────
-- Supabase grants everything to anon/authenticated by default; start from zero.

revoke all on all tables    in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

grant select on public.companies, public.recruiters, public.candidates,
                public.searches, public.search_results          to authenticated;
grant select, insert, delete on public.shortlists, public.shortlist_people,
                                public.saved_briefs             to authenticated;
grant update (name) on public.shortlists                        to authenticated;
-- billing_events: no access for recruiters at all.

-- ───────────────────────── RLS ─────────────────────────

alter table public.companies        enable row level security;
alter table public.recruiters       enable row level security;
alter table public.candidates       enable row level security;
alter table public.searches         enable row level security;
alter table public.search_results   enable row level security;
alter table public.shortlists       enable row level security;
alter table public.shortlist_people enable row level security;
alter table public.saved_briefs     enable row level security;
alter table public.billing_events   enable row level security;

create policy "own company" on public.companies
  for select to authenticated using (id = public.current_company_id());

create policy "own company" on public.recruiters
  for select to authenticated using (company_id = public.current_company_id());

-- Candidates are shared by every recruiter.
create policy "any recruiter" on public.candidates
  for select to authenticated using (public.current_company_id() is not null);

-- Searches are written only by run_search(); recruiters can read their company's.
create policy "own company" on public.searches
  for select to authenticated using (company_id = public.current_company_id());

create policy "own company" on public.search_results
  for select to authenticated using (
    exists (select 1 from public.searches s
            where s.id = search_id and s.company_id = public.current_company_id()));

create policy "own company read" on public.shortlists
  for select to authenticated using (company_id = public.current_company_id());
create policy "own company insert" on public.shortlists
  for insert to authenticated with check (company_id = public.current_company_id());
create policy "own company update" on public.shortlists
  for update to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "own company delete" on public.shortlists
  for delete to authenticated using (company_id = public.current_company_id());

create policy "own company read" on public.shortlist_people
  for select to authenticated using (
    exists (select 1 from public.shortlists s
            where s.id = shortlist_id and s.company_id = public.current_company_id()));
create policy "own company insert" on public.shortlist_people
  for insert to authenticated with check (
    exists (select 1 from public.shortlists s
            where s.id = shortlist_id and s.company_id = public.current_company_id()));
create policy "own company delete" on public.shortlist_people
  for delete to authenticated using (
    exists (select 1 from public.shortlists s
            where s.id = shortlist_id and s.company_id = public.current_company_id()));

create policy "own company read" on public.saved_briefs
  for select to authenticated using (company_id = public.current_company_id());
create policy "own company insert" on public.saved_briefs
  for insert to authenticated with check (company_id = public.current_company_id());
create policy "own company delete" on public.saved_briefs
  for delete to authenticated using (company_id = public.current_company_id());

-- ───────────────────────── Helpers ─────────────────────────

create function public.free_search_limit() returns integer
language sql immutable as $$ select 1 $$;

-- jsonb array of strings -> text[]; anything else -> empty array.
create function public.jsonb_text_array(j jsonb) returns text[]
language sql immutable as $$
  select case when jsonb_typeof(j) = 'array'
              then coalesce(array(select jsonb_array_elements_text(j)), '{}')
              else '{}'::text[] end
$$;

create function public.searches_remaining(p_plan text, p_used integer) returns integer
language sql immutable as $$
  select case when p_plan = 'paid' then null
              else greatest(0, public.free_search_limit() - p_used) end
$$;

-- ───────────────────────── Search ─────────────────────────
-- Charges the company one search (atomically), matches and ranks candidates
-- from validated filters, and persists the ordered result set.
--
-- Filter values are only ever compared as data (=, = any, @>, &&); there is
-- no dynamic SQL, so a hostile filter value cannot change the query.
create function public.run_search(p_brief text, p_filters jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company   text := public.current_company_id();
  v_plan      text;
  v_used      integer;
  v_search    uuid;
  v_total     integer;
  v_roles     text[] := public.jsonb_text_array(p_filters -> 'roles');
  v_senior    text[] := public.jsonb_text_array(p_filters -> 'seniorities');
  v_cities    text[] := public.jsonb_text_array(p_filters -> 'cities');
  v_skills    text[] := public.jsonb_text_array(p_filters -> 'skills');
  v_ctypes    text[] := public.jsonb_text_array(p_filters -> 'company_types');
  v_companies text[] := public.jsonb_text_array(p_filters -> 'companies');
  v_schools   text[] := public.jsonb_text_array(p_filters -> 'schools');
  v_degrees   text[] := public.jsonb_text_array(p_filters -> 'degrees');
  v_fields    text[] := public.jsonb_text_array(p_filters -> 'fields');
  v_unsup     text[] := public.jsonb_text_array(p_filters -> 'unsupported');
  v_open      boolean := case jsonb_typeof(p_filters -> 'open_to_work')
                           when 'boolean' then (p_filters ->> 'open_to_work')::boolean end;
  v_min_years integer := case jsonb_typeof(p_filters -> 'min_years')
                           when 'number' then (p_filters ->> 'min_years')::numeric::integer end;
  v_max_years integer := case jsonb_typeof(p_filters -> 'max_years')
                           when 'number' then (p_filters ->> 'max_years')::numeric::integer end;
  v_matchable boolean;
begin
  if v_company is null then
    raise exception 'Not a recruiter' using errcode = 'PT403';
  end if;
  if p_brief is null or char_length(p_brief) > 500 then
    raise exception 'Invalid brief' using errcode = 'PT400';
  end if;

  -- The free-plan check and the charge are one conditional UPDATE: concurrent
  -- requests serialise on the company row, and only one can pass the limit.
  update public.companies
     set searches_used = searches_used + 1
   where id = v_company
     and (plan = 'paid' or searches_used < public.free_search_limit())
  returning plan, searches_used into v_plan, v_used;

  if not found then
    raise exception 'No searches left on the free plan' using errcode = 'PT402';
  end if;

  -- A brief with a requirement the data cannot express, or with no usable
  -- requirement at all, matches nobody rather than the wrong people.
  v_matchable := cardinality(v_unsup) = 0 and (
       cardinality(v_roles) + cardinality(v_senior) + cardinality(v_cities)
     + cardinality(v_skills) + cardinality(v_ctypes) + cardinality(v_companies)
     + cardinality(v_schools) + cardinality(v_degrees) + cardinality(v_fields) > 0
     or v_open is not null or v_min_years is not null or v_max_years is not null);

  insert into public.searches (company_id, recruiter_id, brief, filters, total)
  values (v_company, auth.uid(), p_brief, p_filters, 0)
  returning id into v_search;

  insert into public.search_results (search_id, rank, candidate_id)
  select v_search,
         row_number() over (order by c.open_to_work desc, c.years_experience desc, c.id),
         c.id
    from public.candidates c
   where v_matchable
     and (cardinality(v_roles)     = 0 or c.role      = any (v_roles))
     and (cardinality(v_senior)    = 0 or c.seniority = any (v_senior))
     and (cardinality(v_cities)    = 0 or c.city      = any (v_cities))
     and (cardinality(v_skills)    = 0 or c.skills        @> v_skills)
     and (cardinality(v_ctypes)    = 0 or c.company_types && v_ctypes)
     and (cardinality(v_companies) = 0 or c.companies     && v_companies)
     and (cardinality(v_schools)   = 0 or c.schools       && v_schools)
     and (cardinality(v_degrees)   = 0 or c.degrees       && v_degrees)
     and (cardinality(v_fields)    = 0 or c.fields        && v_fields)
     and (v_open      is null or c.open_to_work     = v_open)
     and (v_min_years is null or c.years_experience >= v_min_years)
     and (v_max_years is null or c.years_experience <= v_max_years);

  get diagnostics v_total = row_count;
  update public.searches set total = v_total where id = v_search;

  return jsonb_build_object(
    'search_id', v_search,
    'total', v_total,
    'searches_remaining', public.searches_remaining(v_plan, v_used));
end;
$$;


-- One page of a search, read with the caller's own rights (RLS applies).
create function public.search_page(p_search_id uuid, p_page integer, p_page_size integer default 20)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when s.id is null then null else jsonb_build_object(
    'search_id', s.id,
    'brief', s.brief,
    'filters', s.filters,
    'total', s.total,
    'page', p_page,
    'page_size', p_page_size,
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'rank', r.rank, 'full_name', c.full_name,
               'avatar_url', c.avatar_url, 'headline', c.headline,
               'current_title', c.current_title, 'current_company', c.current_company,
               'current_company_logo_url', c.current_company_logo_url,
               'role', c.role, 'seniority', c.seniority,
               'years_experience', c.years_experience, 'city', c.city, 'state', c.state,
               'open_to_work', c.open_to_work, 'skills', c.skills) order by r.rank)
        from public.search_results r
        join public.candidates c on c.id = r.candidate_id
       where r.search_id = s.id
         and r.rank >  (p_page - 1) * p_page_size
         and r.rank <=  p_page      * p_page_size), '[]'::jsonb)) end
  from (select 1) one
  left join public.searches s on s.id = p_search_id
$$;


-- ───────────────────────── Billing ─────────────────────────
-- Applies a verified Stripe subscription event. Idempotent on the event id and
-- ordered by the event's `created` time, so a late, older event never
-- overwrites newer state. Callable only with the service role.
create function public.apply_billing_event(
  p_event_id text, p_type text, p_created bigint, p_company text, p_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid boolean := p_type <> 'customer.subscription.deleted'
                    and p_status in ('active', 'trialing');
begin
  insert into public.billing_events (id, company_id, type, created, status, applied)
  values (p_event_id, p_company, p_type, p_created, p_status, false)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  update public.companies
     set plan = case when v_paid then 'paid' else 'free' end,
         subscription_status = p_status,
         billing_event_created = p_created
   where id = p_company
     and (billing_event_created is null or billing_event_created <= p_created);

  if not found then
    return case when exists (select 1 from public.companies where id = p_company)
                then 'stale' else 'unknown_company' end;
  end if;

  update public.billing_events set applied = true where id = p_event_id;
  return 'applied';
end;
$$;


-- ───────────────────────── Function privileges ─────────────────────────
-- Postgres lets PUBLIC execute new functions by default, so revoke explicitly
-- and grant back only what each role needs.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.current_company_id()                       to authenticated;
grant execute on function public.free_search_limit()                        to authenticated;
grant execute on function public.jsonb_text_array(jsonb)                    to authenticated;
grant execute on function public.searches_remaining(text, integer)          to authenticated;
grant execute on function public.run_search(text, jsonb)                    to authenticated;
grant execute on function public.search_page(uuid, integer, integer)        to authenticated;
grant execute on function public.apply_billing_event(text, text, bigint, text, text) to service_role;
