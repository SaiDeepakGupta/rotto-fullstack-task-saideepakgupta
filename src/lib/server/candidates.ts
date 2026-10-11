import "server-only";

/** Columns returned for a candidate in result lists and shortlists. */
export const CANDIDATE_SUMMARY_COLUMNS =
  "id, full_name, avatar_url, headline, current_title, current_company, current_company_logo_url, role, seniority, years_experience, city, state, open_to_work, skills";

/** Columns for the full candidate profile. */
export const CANDIDATE_DETAIL_COLUMNS = `${CANDIDATE_SUMMARY_COLUMNS}, country, experiences, education`;

/** Shape a full candidates row like the source data, with a nested location. */
export function toPerson({ city, state, country, ...rest }: Record<string, unknown>) {
  return { ...rest, location: { city, state, country } };
}
