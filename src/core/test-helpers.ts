import type { Attempt } from './types';

let seq = 0;

/** A valid attempt with sensible defaults; ids and times increase with each call. */
export function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  seq++;
  return {
    id: `a${seq}`,
    loggedAt: new Date(Date.UTC(2026, 10, 14, 12, seq)).toISOString(),
    activity: 'boulder',
    location: 'BW Ost',
    grade: 'v4',
    outcome: 'flash',
    ...overrides,
  } as Attempt;
}
