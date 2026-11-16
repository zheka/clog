import { config, findActivity, type AppConfig } from '../config';
import { FIXED_KEYS, type Attempt } from './types';

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
 * The attempt with the form's values applied; id and time unchanged.
 * The form's activity fields replace those of the attempt's previous activity, so switching
 * from kilter to boulder drops the angle. Fields the previous activity didn't list (still
 * defined in the config, e.g. after a field was taken off an activity) are kept as they are.
 */
export function withChanges(
  attempt: Attempt,
  input: AttemptInput,
  cfg: AppConfig = config,
): Attempt {
  const previousFields = new Set(findActivity(attempt.activity, cfg)?.fields ?? []);
  // Key order as in the design: context, activity fields, outcome.
  const updated: Record<string, string> = {
    id: attempt.id,
    loggedAt: attempt.loggedAt,
    activity: input.activity,
    location: input.location,
  };
  for (const [field, value] of Object.entries(attempt)) {
    const fixed = (FIXED_KEYS as readonly string[]).includes(field);
    if (!fixed && !previousFields.has(field) && !(field in input.fields)) updated[field] = value;
  }
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
