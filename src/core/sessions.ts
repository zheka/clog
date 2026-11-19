import type { Attempt } from './types';

export interface Session {
  /** Activity, location and local date (with the year): what makes a session. */
  key: string;
  location: string;
  activity: string;
  /** Short local date for display, without the year, e.g. "Nov 15". */
  dateString: string;
  /** Newest first. */
  attempts: Attempt[];
}

/** Local calendar date with the year, e.g. "2026-11-15". */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Groups attempts (stored oldest first) into sessions, newest first.
 * A session is a run of consecutive attempts with the same activity, location and local day;
 * interleaving another activity or location starts a new session.
 */
export function groupIntoSessions(attempts: Attempt[]): Session[] {
  const sessions: Session[] = [];
  let current: Session | null = null;

  for (const attempt of [...attempts].reverse()) {
    const { activity, location, loggedAt } = attempt;
    const key = JSON.stringify([activity, location, localDay(loggedAt)]);

    if (!current || current.key !== key) {
      current = { key, activity, location, dateString: formatDay(loggedAt), attempts: [] };
      sessions.push(current);
    }
    current.attempts.push(attempt);
  }
  return sessions;
}
