import type { Attempt, Outcome } from '../core/types';
import { VERSION_TAG, versionProblem } from './backup';

/** All app data lives under one key, shaped like a backup (without `exportedAt`). */
const STORAGE_KEY = 'clog';
/** Where unreadable saved data is copied before the app starts empty, so nothing is lost. */
const UNREADABLE_KEY = 'clog_unreadable';
/** Keys of the app before clog 0.1.0; removed after the first successful import on a device. */
const LEGACY_KEYS = ['climb_attempts_history', 'climb_outcomes_registry'];

/**
 * Reads saved data. Starts empty when there is none. Data the app can't read is copied to
 * `clog_unreadable` and the app starts empty. (Future schema changes migrate here, silently.)
 */
export function loadData(): { attempts: Attempt[]; outcomes: Outcome[] } {
  const empty = { attempts: [], outcomes: [] };
  const json = localStorage.getItem(STORAGE_KEY);
  if (!json) return empty;
  try {
    const data = JSON.parse(json);
    if (
      versionProblem(data?.version) ||
      !Array.isArray(data.attempts) ||
      !Array.isArray(data.outcomes)
    ) {
      throw new Error('unexpected format');
    }
    return { attempts: data.attempts, outcomes: data.outcomes };
  } catch (err) {
    console.error('Saved data could not be read; a copy is kept under', UNREADABLE_KEY, err);
    localStorage.setItem(UNREADABLE_KEY, json);
    return empty;
  }
}

export function saveData(attempts: Attempt[], outcomes: Outcome[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION_TAG, outcomes, attempts }));
}

/** Removes the pre-0.1.0 app's data. Call only after a successful import has been saved. */
export function removeLegacyData(): void {
  for (const key of LEGACY_KEYS) localStorage.removeItem(key);
}
