// Loads data/candidates.json and creates the two companies and their recruiters.
// Idempotent: safe to run again; it never resets a company's plan or usage.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Run `make setup` (needs .env.local with Supabase keys).");

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const COMPANIES = [
  { id: "acme", name: "Acme", email: "recruiter@acme.test" },
  { id: "globex", name: "Globex", email: "recruiter@globex.test" },
];
const PASSWORD = "rotto-assessment";

type Result = { data: unknown; error: unknown };

/** Throw on a Supabase error; otherwise return the success branch's data. */
function check<R extends Result>(result: R, what: string): Extract<R, { error: null }>["data"] {
  if (result.error) throw new Error(`${what}: ${JSON.stringify(result.error)}`);
  return result.data as Extract<R, { error: null }>["data"];
}

async function seedCompaniesAndRecruiters() {
  check(
    await db.from("companies").upsert(COMPANIES.map(({ id, name }) => ({ id, name })), { onConflict: "id", ignoreDuplicates: true }),
    "companies",
  );

  const existing = check(await db.auth.admin.listUsers({ perPage: 1000 }), "list users").users;
  for (const company of COMPANIES) {
    let user = existing.find((u) => u.email === company.email);
    if (user) {
      check(await db.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true }), "update user");
    } else {
      user = check(
        await db.auth.admin.createUser({ email: company.email, password: PASSWORD, email_confirm: true }),
        "create user",
      ).user;
    }
    check(
      await db.from("recruiters").upsert({ user_id: user.id, company_id: company.id, email: company.email }, { onConflict: "user_id" }),
      "recruiters",
    );
    console.log(`Recruiter ${company.email} → ${company.id}`);
  }
}

type Source = {
  id: string;
  full_name: string;
  avatar_url: string;
  headline: string;
  current_title: string;
  current_company: string;
  current_company_logo_url: string;
  role: string;
  seniority: string;
  years_experience: number;
  location: { city: string; state: string; country: string };
  open_to_work: boolean;
  skills: string[];
  experiences: { company: string; company_type: string }[];
  education: { school: string; degree: string; field: string }[];
};

const unique = (xs: string[]) => [...new Set(xs)];

function toRow(c: Source) {
  return {
    id: c.id,
    full_name: c.full_name,
    avatar_url: c.avatar_url,
    headline: c.headline,
    current_title: c.current_title,
    current_company: c.current_company,
    current_company_logo_url: c.current_company_logo_url,
    role: c.role,
    seniority: c.seniority,
    years_experience: c.years_experience,
    city: c.location.city,
    state: c.location.state,
    country: c.location.country,
    open_to_work: c.open_to_work,
    skills: c.skills,
    experiences: c.experiences,
    education: c.education,
    company_types: unique(c.experiences.map((e) => e.company_type)),
    companies: unique(c.experiences.map((e) => e.company)),
    schools: unique(c.education.map((e) => e.school)),
    degrees: unique(c.education.map((e) => e.degree)),
    fields: unique(c.education.map((e) => e.field)),
  };
}

async function seedCandidates() {
  const candidates: Source[] = JSON.parse(readFileSync(new URL("../data/candidates.json", import.meta.url), "utf8"));
  const rows = candidates.map(toRow);
  for (let i = 0; i < rows.length; i += 500) {
    check(await db.from("candidates").upsert(rows.slice(i, i + 500), { onConflict: "id" }), "candidates");
  }
  console.log(`Loaded ${rows.length} candidates`);
}

await seedCompaniesAndRecruiters();
await seedCandidates();
