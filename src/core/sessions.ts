import type { Attempt, Kind } from './types';

export interface Session {
  key: string;
  location: string;
  kind: Kind;
  /** Short local date, e.g. "Nov 15". */
  dateString: string;
  /** Newest first. */
  entries: Attempt[];
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Groups attempts (stored oldest first) into sessions, newest first.
 * A session is a run of consecutive attempts with the same location, kind and local day;
 * interleaving another location or kind starts a new session.
 */
export function groupIntoSessions(attempts: Attempt[]): Session[] {
  const sessions: Session[] = [];
  let current: Session | null = null;

  for (const entry of [...attempts].reverse()) {
    const location = entry.location || 'Unknown Location';
    const kind = entry.kind || 'bouldering';
    const dateString = formatDay(entry.loggedAt);
    const key = `${location}___${kind}___${dateString}`;

    if (!current || current.key !== key) {
      current = { key, location, kind, dateString, entries: [] };
      sessions.push(current);
    }
    current.entries.push(entry);
  }
  return sessions;
}
