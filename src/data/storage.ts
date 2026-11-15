import { normalizeAttempt, unwrapAttempts, type RawAttempt } from '../core/attempt';
import type { Attempt, Outcome } from '../core/types';

const ATTEMPTS_KEY = 'climb_attempts_history';
const OUTCOMES_KEY = 'climb_outcomes_registry';

/** Reads saved data. Unreadable data loads as empty rather than failing. */
export function loadData(): { attempts: Attempt[]; outcomes: Outcome[] } {
  let attempts: Attempt[] = [];
  let outcomes: Outcome[] = [];

  const attemptsJson = localStorage.getItem(ATTEMPTS_KEY);
  if (attemptsJson) {
    try {
      attempts = unwrapAttempts(JSON.parse(attemptsJson)).map((raw) =>
        normalizeAttempt(raw as RawAttempt),
      );
    } catch {
      attempts = [];
    }
  }

  const outcomesJson = localStorage.getItem(OUTCOMES_KEY);
  if (outcomesJson) {
    try {
      outcomes = JSON.parse(outcomesJson);
    } catch {
      outcomes = [];
    }
  }

  return { attempts, outcomes };
}

export function saveData(attempts: Attempt[], outcomes: Outcome[]): void {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
  localStorage.setItem(OUTCOMES_KEY, JSON.stringify(outcomes));
}
