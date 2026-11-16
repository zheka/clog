import type { Attempt, Outcome } from './types';

/** Where the form currently is: the selected activity and the typed location. */
export interface Scope {
  activity: string;
  location: string;
}

type Pool = (a: Attempt) => boolean;

/** Distinct values (exact, case kept) of a field, pool by pool, most recent first in each. */
function collect(attempts: Attempt[], field: string, pools: Pool[], excludeId: string | null) {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const inPool of pools) {
    for (let i = attempts.length - 1; i >= 0; i--) {
      const a = attempts[i];
      if (excludeId && a.id === excludeId) continue;
      const value = a[field];
      if (!value || seen.has(value) || !inPool(a)) continue;
      seen.add(value);
      values.push(value);
    }
  }
  return values;
}

/**
 * Candidate values for a text field, in priority order:
 * - `location`: same activity, then all activities;
 * - activity fields: same activity + location, then same activity, then all activities.
 */
export function fieldCandidates(
  attempts: Attempt[],
  field: string,
  scope: Scope,
  excludeId: string | null = null,
): string[] {
  const sameActivity: Pool = (a) => a.activity === scope.activity;
  const pools: Pool[] =
    field === 'location'
      ? [sameActivity, () => true]
      : [(a) => sameActivity(a) && a.location === scope.location, sameActivity, () => true];
  return collect(attempts, field, pools, excludeId);
}

/**
 * Orders values for typed text, ignoring case: values starting with it, then values containing
 * it, then the rest (backfill). Otherwise keeps the given order. No text keeps the order as is.
 */
export function rankByQuery(values: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return values;
  const starts: string[] = [];
  const contains: string[] = [];
  const rest: string[] = [];
  for (const v of values) {
    const lower = v.toLowerCase();
    if (lower.startsWith(q)) starts.push(v);
    else if (lower.includes(q)) contains.push(v);
    else rest.push(v);
  }
  return [...starts, ...contains, ...rest];
}

export function suggestValues(
  attempts: Attempt[],
  field: string,
  query: string,
  scope: Scope,
  excludeId: string | null = null,
  limit = 3,
): string[] {
  return rankByQuery(fieldCandidates(attempts, field, scope, excludeId), query).slice(0, limit);
}

/**
 * Outcome names for the chips, only from the outcome list: used with this activity (most
 * recent first), then used with any activity, then never used (in list order).
 */
export function outcomeCandidates(
  attempts: Attempt[],
  outcomes: Outcome[],
  activity: string,
): string[] {
  const defined = new Set(outcomes.map((o) => o.name));
  const used = collect(attempts, 'outcome', [(a) => a.activity === activity, () => true], null);
  const list = used.filter((name) => defined.has(name));
  for (const o of outcomes) if (!list.includes(o.name)) list.push(o.name);
  return list;
}

export function suggestOutcomes(
  attempts: Attempt[],
  outcomes: Outcome[],
  activity: string,
  query: string,
  limit = 8,
): string[] {
  return rankByQuery(outcomeCandidates(attempts, outcomes, activity), query).slice(0, limit);
}
