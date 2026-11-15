import {
  generateId,
  isCompleteAttempt,
  normalizeAttempt,
  sortByTime,
  unwrapAttempts,
} from '../core/attempt';
import { sortByName } from '../core/outcomes';
import type { Attempt, Outcome } from '../core/types';

export const BACKUP_VERSION = '1.2.0';

export interface Backup {
  version: string;
  exportedAt: string;
  outcomes: Outcome[];
  attempts: Attempt[];
}

function toBackupAttempt(item: Attempt): Attempt {
  const attempt: Attempt = {
    id: item.id,
    loggedAt: item.loggedAt,
    kind: item.kind,
    location: item.location,
    grade: item.grade,
    outcome: item.outcome,
  };
  if (
    item.kind === 'kilterboard' &&
    item.boardAngle !== undefined &&
    item.boardAngle !== null &&
    !isNaN(item.boardAngle)
  ) {
    attempt.boardAngle = Number(item.boardAngle);
  }
  return attempt;
}

export function createBackup(attempts: Attempt[], outcomes: Outcome[], now = new Date()): Backup {
  return {
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    outcomes: sortByName(outcomes),
    attempts: attempts.map(toBackupAttempt),
  };
}

export function backupFileName(now = new Date()): string {
  return `clog_backup_${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Parses a backup file (current or legacy format).
 * Returns the complete attempts, sorted oldest first, with missing or duplicate ids replaced,
 * and the outcomes registry if the file has one (`outcomes`, or legacy `customOutcomes`).
 * Throws if the text is not valid JSON.
 */
export function parseBackup(text: string): { attempts: Attempt[]; outcomes: Outcome[] | null } {
  const parsed = JSON.parse(text);
  const rawAttempts = unwrapAttempts(parsed);

  let outcomes: Outcome[] | null = null;
  if (parsed.outcomes && Array.isArray(parsed.outcomes)) {
    outcomes = parsed.outcomes;
  } else if (parsed.customOutcomes && Array.isArray(parsed.customOutcomes)) {
    outcomes = parsed.customOutcomes;
  }

  const seenIds = new Set<string>();
  const attempts = rawAttempts.filter(isCompleteAttempt).map((raw) => {
    const attempt = normalizeAttempt(raw);
    if (seenIds.has(String(attempt.id))) attempt.id = generateId();
    seenIds.add(String(attempt.id));
    return attempt;
  });

  return { attempts: sortByTime(attempts), outcomes };
}
