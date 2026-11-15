import type { Attempt, Outcome } from './types';

type TextField = 'location' | 'grade';

const sameText = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Unique values of a field, most recent first (case-insensitive, trimmed). */
export function recentValues(
  attempts: Attempt[],
  field: TextField,
  excludeId: string | null = null,
): string[] {
  const recent: string[] = [];
  for (let i = attempts.length - 1; i >= 0; i--) {
    if (excludeId && attempts[i].id === excludeId) continue;
    const val = attempts[i][field];
    if (val && typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length > 0 && !recent.some((r) => sameText(r, trimmed))) {
        recent.push(trimmed);
      }
    }
  }
  return recent;
}

/**
 * Up to `limit` suggestions for a field: recent values containing the query first,
 * then topped up with the most recent values regardless of the query.
 */
export function suggestValues(
  attempts: Attempt[],
  field: TextField,
  query: string,
  excludeId: string | null = null,
  limit = 3,
): string[] {
  const q = query.trim().toLowerCase();
  const recent = recentValues(attempts, field, excludeId);
  const results = recent.filter((v) => q === '' || v.toLowerCase().includes(q));
  for (const item of recent) {
    if (results.length >= limit) break;
    if (!results.some((r) => sameText(r, item))) results.push(item);
  }
  return results.slice(0, limit);
}

/** If the typed value matches an earlier one ignoring case, returns the earlier spelling. */
export function matchExistingCasing(attempts: Attempt[], field: TextField, typed: string): string {
  const trimmed = typed.trim();
  if (!trimmed) return '';
  for (let i = attempts.length - 1; i >= 0; i--) {
    const val = attempts[i][field];
    if (val && typeof val === 'string' && sameText(val.trim(), trimmed)) {
      return val.trim();
    }
  }
  return trimmed;
}

/** Outcome names for the quick-pick chips: most recently used first, then unused registered ones. */
export function quickOutcomes(attempts: Attempt[], outcomes: Outcome[], limit = 8): string[] {
  const list: string[] = [];
  for (let i = attempts.length - 1; i >= 0; i--) {
    const out = attempts[i].outcome;
    if (out && !list.some((r) => sameText(r, out))) list.push(out);
  }
  for (const o of outcomes) {
    if (!list.some((r) => sameText(r, o.name))) list.push(o.name);
  }
  return list.slice(0, limit);
}
