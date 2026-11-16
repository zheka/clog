import { config, findActivity, type AppConfig } from '../config';
import { sortByTime } from '../core/attempt';
import { sortByName } from '../core/outcomes';
import { cleanText, normalizeName } from '../core/text';
import { CATEGORIES, FIXED_KEYS, type Attempt, type Category, type Outcome } from '../core/types';

/** Schema version of backups and saved data (see "Versioning" in docs/design.md). */
export const SCHEMA_VERSION = '0.1.0';
export const VERSION_TAG = `clog ${SCHEMA_VERSION}`;

export interface Backup {
  version: string;
  exportedAt: string;
  outcomes: Outcome[];
  attempts: Attempt[];
}

export function createBackup(attempts: Attempt[], outcomes: Outcome[], now = new Date()): Backup {
  return {
    version: VERSION_TAG,
    exportedAt: now.toISOString(),
    outcomes: sortByName(outcomes),
    attempts,
  };
}

export function backupFileName(now = new Date()): string {
  return `clog_backup_${now.toISOString().slice(0, 10)}.json`;
}

/** An import refused because the file has problems; `message` lists them. */
export class BackupError extends Error {
  constructor(readonly problems: string[]) {
    const shown = problems.slice(0, 10).map((p) => `  ${p}`);
    if (problems.length > 10) shown.push(`  …and ${problems.length - 10} more`);
    const count = problems.length === 1 ? '1 problem' : `${problems.length} problems`;
    super(`Import refused: ${count}\n${shown.join('\n')}`);
    this.name = 'BackupError';
  }
}

const VERSION_PATTERN = /^clog (\d+)\.(\d+)\.(\d+)$/;

/** Why a version can't be read by this app, or null if it can. */
export function versionProblem(version: unknown): string | null {
  const ours = SCHEMA_VERSION.split('.').map(Number);
  const match = typeof version === 'string' ? VERSION_PATTERN.exec(version) : null;
  if (!match) {
    return `version ${JSON.stringify(version)} is not a clog backup version (expected "${VERSION_TAG}"); convert old files first`;
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  const newer =
    major > ours[0] ||
    (major === ours[0] && minor > ours[1]) ||
    (major === ours[0] && minor === ours[1] && patch > ours[2]);
  if (newer) return `version "${version}" is newer than this app (${VERSION_TAG}); update the app`;
  if (major !== ours[0] || minor !== ours[1]) {
    return `version "${version}" is older than this app (${VERSION_TAG}); upgrade the file first`;
  }
  return null;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every problem in parsed backup data, checked against the current config; empty when valid. */
export function validateBackup(data: unknown, cfg: AppConfig = config): string[] {
  if (!isObject(data)) return ['the file is not a clog backup (expected a JSON object)'];
  const problems: string[] = [];
  const versionError = versionProblem(data.version);
  if (versionError) return [versionError];

  const outcomeNames = new Set<string>();
  if (!Array.isArray(data.outcomes)) {
    problems.push('"outcomes" must be a list');
  } else {
    data.outcomes.forEach((o, i) => {
      const label = `outcome #${i + 1}`;
      if (!isObject(o) || typeof o.name !== 'string') {
        problems.push(`${label}: needs a "name"`);
        return;
      }
      if (!o.name || normalizeName(o.name) !== o.name) {
        problems.push(
          `${label}: name "${o.name}" is not normalised (expected "${normalizeName(o.name)}")`,
        );
      }
      if (outcomeNames.has(o.name)) problems.push(`${label}: "${o.name}" is defined twice`);
      outcomeNames.add(o.name);
      if (!CATEGORIES.includes(o.category as Category)) {
        problems.push(
          `${label} "${o.name}": category must be one of ${CATEGORIES.join(', ')} (got ${JSON.stringify(o.category)})`,
        );
      }
    });
  }

  if (!Array.isArray(data.attempts)) {
    problems.push('"attempts" must be a list');
    return problems;
  }
  const ids = new Set<string>();
  data.attempts.forEach((a, i) => {
    if (!isObject(a)) {
      problems.push(`attempt #${i + 1}: not an object`);
      return;
    }
    const label = `attempt #${i + 1}${typeof a.id === 'string' && a.id ? ` (id ${a.id.slice(0, 8)}…)` : ''}`;
    for (const key of FIXED_KEYS) {
      if (typeof a[key] !== 'string' || a[key] === '') problems.push(`${label}: missing ${key}`);
    }
    for (const [key, value] of Object.entries(a)) {
      if (typeof value !== 'string') {
        problems.push(`${label}: ${key} must be text (got ${JSON.stringify(value)})`);
      } else if (key !== 'id' && key !== 'loggedAt' && cleanText(value) !== value) {
        problems.push(`${label}: ${key} "${value}" is not cleaned (extra spaces?)`);
      } else if (!(FIXED_KEYS as readonly string[]).includes(key) && !(key in cfg.fields)) {
        problems.push(`${label}: unknown field "${key}"`);
      }
    }
    if (typeof a.id === 'string' && a.id) {
      if (ids.has(a.id)) problems.push(`${label}: duplicate id`);
      ids.add(a.id);
    }
    if (typeof a.loggedAt === 'string' && Number.isNaN(Date.parse(a.loggedAt))) {
      problems.push(`${label}: loggedAt "${a.loggedAt}" is not a valid time`);
    }
    if (typeof a.activity === 'string' && a.activity && !findActivity(a.activity, cfg)) {
      problems.push(`${label}: unknown activity "${a.activity}"`);
    }
    if (typeof a.outcome === 'string' && a.outcome && !outcomeNames.has(a.outcome)) {
      problems.push(`${label}: outcome "${a.outcome}" is not defined`);
    }
  });
  return problems;
}

/**
 * Reads a backup file strictly: all-or-nothing, nothing is fixed silently.
 * Throws BackupError listing every problem (or a SyntaxError for invalid JSON).
 * Returns the attempts oldest first.
 */
export function parseBackup(text: string): { attempts: Attempt[]; outcomes: Outcome[] } {
  const data: unknown = JSON.parse(text);
  const problems = validateBackup(data);
  if (problems.length > 0) throw new BackupError(problems);
  const backup = data as Backup;
  return { attempts: sortByTime(backup.attempts), outcomes: backup.outcomes };
}
