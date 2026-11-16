import type { Attempt } from './types';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

/** What the entry form provides when logging or editing an attempt (values already cleaned). */
export interface AttemptInput {
  activity: string;
  location: string;
  outcome: string;
  /** The activity's own fields; empty values are left out. */
  fields: Record<string, string>;
}

export function createAttempt(input: AttemptInput, now = new Date()): Attempt {
  return withChanges({ id: generateId(), loggedAt: now.toISOString() } as Attempt, input);
}

/**
 * The attempt with the form's values applied; id and time unchanged. Activity fields are
 * replaced by the form's, so switching activity drops fields the new activity doesn't have.
 */
export function withChanges(attempt: Attempt, input: AttemptInput): Attempt {
  // Key order as in the design: context, activity fields, outcome.
  const updated: Record<string, string> = {
    id: attempt.id,
    loggedAt: attempt.loggedAt,
    activity: input.activity,
    location: input.location,
  };
  for (const [field, value] of Object.entries(input.fields)) {
    if (value !== '') updated[field] = value;
  }
  updated.outcome = input.outcome;
  return updated as Attempt;
}

/** Oldest first. */
export function sortByTime(attempts: Attempt[]): Attempt[] {
  return [...attempts].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
  );
}
