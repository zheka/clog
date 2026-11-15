import type { Category, Outcome } from './types';

/** Category of an outcome by name (case-insensitive). Unregistered outcomes count as failures. */
export function getCategory(outcomes: Outcome[], name: string): Category {
  const lower = name.toLowerCase().trim();
  const found = outcomes.find((o) => o.name.toLowerCase() === lower);
  return found ? found.category : 'failure';
}

export function sortByName(outcomes: Outcome[]): Outcome[] {
  return [...outcomes].sort((a, b) => a.name.localeCompare(b.name));
}
