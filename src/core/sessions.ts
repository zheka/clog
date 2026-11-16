import type { Attempt } from './types';

export interface Session {
  key: string;
  location: string;
  activity: string;
  /** Short local date, e.g. "Nov 15". */
  dateString: string;
  /** Newest first. */
  attempts: Attempt[];
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
    const location = attempt.location || 'Unknown Location';
    const activity = attempt.activity;
    const dateString = formatDay(attempt.loggedAt);
    const key = `${activity}___${location}___${dateString}`;

    if (!current || current.key !== key) {
      current = { key, activity, location, dateString, attempts: [] };
      sessions.push(current);
    }
    current.attempts.push(attempt);
  }
  return sessions;
}
