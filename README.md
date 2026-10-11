# HireFast

Recruiters describe who they need in plain English. An LLM turns the brief into structured filters, Postgres finds and ranks the people, and every filter is shown back as a chip you can edit or remove.

```bash
make setup   # npm ci, start local Supabase, apply migrations, load 5,000 candidates, seed acme + globex
make dev     # http://localhost:3000  (needs ANTHROPIC_API_KEY and STRIPE_WEBHOOK_SECRET in the environment)
make test    # tenant isolation, billing webhook, free-plan race, hostile input (against the running app)
make eval    # precision/recall for data/queries.json if present (or QUERIES=path) + hostile briefs (uses the real model)
```

Sign in as `recruiter@acme.test` or `recruiter@globex.test`, password `rotto-assessment`. Requires Node 24, Docker Desktop; Supabase CLI 2.119.0 and Next.js 16 are pinned in `package-lock.json`.

## How search works

1. `POST /api/search` sends only the brief to the model, which must answer in a **fixed JSON schema**: `roles`, `seniorities`, `cities`, `skills` (all required), `company_types`, `companies`, `schools`, `degrees`, `fields`, `open_to_work`, `min_years`, `max_years`, plus `unsupported`.
2. The server validates the output (`src/lib/filters.ts`) and calls `run_search()` in Postgres, which charges the search, matches with array operators (`= any`, `@>`, `&&`) on denormalised, GIN-indexed columns, ranks (open to work first, then years of experience), and **persists the ordered result set** in `search_results`.
3. `GET /api/search/{id}?page=N` is a primary-key range read on `(search_id, rank)`: around 20–40 ms locally. Paging never charges.

Candidates are never sent to the model. Editing a chip re-runs the search with the edited filters and skips the model.

## Stopping the model from inventing filters

- Every list field is an `enum` generated from the data (`src/lib/vocabulary.ts`), enforced by structured outputs. The model cannot name a city, skill or school that doesn't exist.
- Anything the brief asks for that the schema can't express ("speaks Japanese", "remote", "London") goes in `unsupported`. Any unsupported requirement, or no requirement at all, returns **nobody**, and the UI says why. Values outside the vocabulary are moved to `unsupported`, never dropped silently.
- The brief is treated as data. The model has no tools and no write path. SQL is static with bound parameters, so filter values are only ever compared, never executed.

## Security

- **Tenant isolation is RLS, not API checks.** API routes query Supabase *as the recruiter* (their bearer token), so the same policies apply through the API and directly through PostgREST. Shortlists, members, saved briefs and searches are scoped by `current_company_id()`. `company_id` is defaulted, checked on write and not updatable. Billing tables and functions are service-role only. `make test` proves 25+ cross-tenant attempts fail.
- The service-role key is only read in server modules (`import "server-only"`). Only the public anon key reaches the browser.

## Billing and the free plan

- `POST /api/billing/events` verifies the HMAC signature on the raw body (400 if bad). It records the event id first (repeats return 200 and change nothing). It applies the event only if its `created` is newer than the company's stored one, so late events can't overwrite newer state. `active`/`trialing` → paid; deleted or any other status → free.
- The free limit is one conditional `UPDATE … WHERE plan = 'paid' OR searches_used < 1`. Concurrent requests serialise on the row lock (10 parallel requests → one 200, nine 402).

## Model and cost

**Claude Haiku 5.5** (`claude-haiku-5-5`) with thinking off: it's the fastest current Claude model, and mapping a sentence onto a fixed schema doesn't need more. A call is about 2.5K input tokens (prompt + enum schema) and about 100 output tokens. At $0.10 / $0.50 per million tokens that is roughly **$0.0003 per search**. This is an estimate; it hasn't been measured against the live API yet.

## Tradeoffs

- **Exact matching over fuzzy scoring.** It gives high precision and is explainable, but a near miss (4.5 years for "5+") is excluded. Ranking inside a match set is simple, not learned.
- **Strict about unsupported requirements.** A brief with one unanswerable clause returns nothing until the user removes that chip. That's safer than returning wrong people, but it's one extra click.
- **Editing a filter counts as a new search**, which is harsh on the free plan; the UI warns before it happens.
- Two billing events for the same company with the same `created` second: the one that arrives last wins (Stripe timestamps are in seconds, so this is rare).
- No timestamp tolerance on webhook signatures. Replays are harmless because processing is idempotent and ordered, and it lets the sample events be replayed.

## With another week

- A larger eval set (paraphrases, typos, adversarial briefs) run in CI, plus prompt caching on the schema.
- Soft ranking signals (skill overlap, recency at matching companies), and "did you mean" suggestions when a search is empty.
- Playwright tests for the UI, pgTAP tests for RLS, and a streaming "understood filters" preview while results load.
