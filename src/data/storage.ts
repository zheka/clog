import type { Attempt, Outcome } from '../core/types';
import { validateBackup, VERSION_TAG } from './backup';

/** All app data lives under one key, shaped like a backup (without `exportedAt`). */
const STORAGE_KEY = 'clog';
/** Keys of the app before clog 0.1.0; removed after the first successful import on a device. */
const LEGACY_KEYS = ['climb_attempts_history', 'climb_outcomes_registry'];

export type LoadResult =
  | { ok: true; attempts: Attempt[]; outcomes: Outcome[] }
  /** The saved data can't be used: `raw` is the saved text, unchanged. */
  | { ok: false; problems: string[]; raw: string };

/**
 * Reads saved data; starts empty when there is none. The data is checked like an import
 * (version, and consistency with the config); if it fails, nothing is loaded or changed.
 * (Future schema changes will migrate the data here, silently.)
 */
export function loadData(): LoadResult {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ok: true, attempts: [], outcomes: [] };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { ok: false, problems: [`not valid JSON: ${(err as Error).message}`], raw };
  }
  const problems = validateBackup(data);
  if (problems.length > 0) return { ok: false, problems, raw };
  const { attempts, outcomes } = data as { attempts: Attempt[]; outcomes: Outcome[] };
  return { ok: true, attempts, outcomes };
}

export function saveData(attempts: Attempt[], outcomes: Outcome[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION_TAG, outcomes, attempts }));
}

/** Deletes the saved data (start fresh). */
export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Removes the pre-0.1.0 app's data. Call only after a successful import has been saved. */
export function removeLegacyData(): void {
  for (const key of LEGACY_KEYS) localStorage.removeItem(key);
}
