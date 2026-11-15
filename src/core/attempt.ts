import { KINDS, type Attempt, type Kind } from './types';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

/** Any object read from storage or a backup file; fields may be missing or of the wrong type. */
export type RawAttempt = Record<string, unknown>;

function isKind(value: unknown): value is Kind {
  return KINDS.includes(value as Kind);
}

/** True if a raw record has everything needed to be imported from a backup. */
export function isCompleteAttempt(raw: unknown): raw is RawAttempt {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as RawAttempt;
  return Boolean((r.loggedAt || r.timestamp) && r.location && r.grade && r.outcome);
}

/**
 * Turns a raw record (current or legacy shape) into an Attempt, filling in defaults:
 * `timestamp` → `loggedAt`, unknown kind → bouldering, trimmed text fields,
 * and a numeric `boardAngle` kept only for kilterboard.
 */
export function normalizeAttempt(raw: RawAttempt): Attempt {
  const attempt: Attempt = {
    id: (raw.id as string) || generateId(),
    loggedAt: (raw.loggedAt as string) || (raw.timestamp as string) || new Date().toISOString(),
    kind: isKind(raw.kind) ? raw.kind : 'bouldering',
    location: String(raw.location || 'Unknown').trim(),
    grade: String(raw.grade || '').trim(),
    outcome: String(raw.outcome || '').trim(),
  };
  if (
    attempt.kind === 'kilterboard' &&
    raw.boardAngle !== undefined &&
    raw.boardAngle !== null &&
    raw.boardAngle !== ''
  ) {
    attempt.boardAngle = Number(raw.boardAngle);
  }
  return attempt;
}

/** Oldest first. */
export function sortByTime(attempts: Attempt[]): Attempt[] {
  return [...attempts].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
  );
}

/**
 * The attempt list inside parsed storage/backup JSON: a bare array (oldest format),
 * or the `attempts` / `entries` property.
 */
export function unwrapAttempts(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  const obj = parsed as { attempts?: unknown[]; entries?: unknown[] };
  return obj.attempts || obj.entries || [];
}
