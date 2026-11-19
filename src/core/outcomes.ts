import type { Category, Outcome } from './types';

/**
 * Category of an outcome by name. Names are normalised and every outcome used is in the list
 * (imports and saved data are checked), so the neutral fallback is only a safety net.
 */
export function getCategory(outcomes: Outcome[], name: string): Category {
  return outcomes.find((o) => o.name === name)?.category ?? 'work';
}

export function sortByName(outcomes: Outcome[]): Outcome[] {
  return [...outcomes].sort((a, b) => a.name.localeCompare(b.name));
}
