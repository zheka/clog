import { KINDS, type Attempt, type Outcome } from './types';

const STORAGE_KEY = 'climb_attempts_history';
const OUTCOMES_KEY = 'climb_outcomes_registry';
export const CURRENT_VERSION = '1.2.0';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

export function loadData(): { history: Attempt[]; outcomes: Outcome[] } {
  let history: Attempt[] = [];
  let outcomes: Outcome[] = [];

  // Load history
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      const rawAttempts = Array.isArray(parsed) ? parsed : (parsed.attempts || parsed.entries || []);
      history = rawAttempts.map(item => {
        const entry: Attempt = {
          id: item.id || generateId(),
          loggedAt: item.loggedAt || item.timestamp || new Date().toISOString(),
          kind: KINDS.includes(item.kind) ? item.kind : 'bouldering',
          location: String(item.location || 'Unknown').trim(),
          grade: String(item.grade || '').trim(),
          outcome: String(item.outcome || '').trim()
        };
        if (entry.kind === 'kilterboard' && item.boardAngle !== undefined && item.boardAngle !== null && item.boardAngle !== '') {
          entry.boardAngle = Number(item.boardAngle);
        }
        return entry;
      });
    } catch {
      history = [];
    }
  }

  // Load outcomes registry
  const outcomesData = localStorage.getItem(OUTCOMES_KEY);
  if (outcomesData) {
    try {
      outcomes = JSON.parse(outcomesData);
    } catch {
      outcomes = [];
    }
  }

  return { history, outcomes };
}

export function saveData(history: Attempt[], outcomes: Outcome[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  localStorage.setItem(OUTCOMES_KEY, JSON.stringify(outcomes));
}

/** Downloads a JSON backup. Returns false if there was nothing to export. */
export function exportToJSON(history: Attempt[], outcomes: Outcome[]): boolean {
  if (history.length === 0) {
    alert('No attempts to export.');
    return false;
  }
  const cleanAttempts = history.map(item => {
    const attempt: Attempt = {
      id: item.id,
      loggedAt: item.loggedAt,
      kind: item.kind,
      location: item.location,
      grade: item.grade,
      outcome: item.outcome
    };
    if (item.kind === 'kilterboard' && item.boardAngle !== undefined && item.boardAngle !== null && !isNaN(item.boardAngle)) {
      attempt.boardAngle = Number(item.boardAngle);
    }
    return attempt;
  });

  const sortedOutcomes = [...outcomes].sort((a, b) => a.name.localeCompare(b.name));
  const backupPayload = {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    outcomes: sortedOutcomes,
    attempts: cleanAttempts
  };

  const jsonContent = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `clog_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Parses a backup file (current or legacy format).
 * Returns the valid attempts, sorted oldest first, and the outcomes registry if the file has one.
 * Throws if the text is not valid JSON.
 */
export function parseBackup(text: string): { attempts: Attempt[]; outcomes: Outcome[] | null } {
  const parsed = JSON.parse(text);
  const importedAttempts = Array.isArray(parsed) ? parsed : (parsed.attempts || parsed.entries || []);
  const validAttempts = importedAttempts.filter(item => {
    return item && (item.loggedAt || item.timestamp) && item.location && item.grade && item.outcome;
  });

  let outcomes: Outcome[] | null = null;
  if (parsed.outcomes && Array.isArray(parsed.outcomes)) {
    outcomes = parsed.outcomes;
  } else if (parsed.customOutcomes && Array.isArray(parsed.customOutcomes)) {
    outcomes = parsed.customOutcomes;
  }

  const seenIds = new Set<string>();
  const attempts: Attempt[] = validAttempts.map(entry => {
    let id = entry.id;
    if (!id || seenIds.has(String(id))) {
      id = generateId();
    }
    seenIds.add(String(id));
    const mapped: Attempt = {
      id: id,
      loggedAt: entry.loggedAt || entry.timestamp,
      kind: KINDS.includes(entry.kind) ? entry.kind : 'bouldering',
      location: String(entry.location).trim(),
      grade: String(entry.grade).trim(),
      outcome: String(entry.outcome).trim()
    };
    if (mapped.kind === 'kilterboard' && entry.boardAngle !== undefined && entry.boardAngle !== null && entry.boardAngle !== '') {
      mapped.boardAngle = Number(entry.boardAngle);
    }
    return mapped;
  });

  attempts.sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
  return { attempts, outcomes };
}
