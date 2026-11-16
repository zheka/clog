export type Category = 'success' | 'failure' | 'work';
export const CATEGORIES: readonly Category[] = ['success', 'failure', 'work'];

/** Attempt keys that are not activity fields. */
export const FIXED_KEYS = ['id', 'loggedAt', 'activity', 'location', 'outcome'] as const;
/** Keys an activity field may not use: the fixed ones plus those reserved for sync. */
export const RESERVED_KEYS: readonly string[] = [...FIXED_KEYS, 'updatedAt', 'deletedAt'];

/**
 * One logged attempt. Stored flat: the fixed keys plus the activity's own fields
 * (e.g. `grade`, `angle`), all text.
 */
export interface Attempt {
  id: string;
  /** When the attempt was logged (ISO timestamp), not when the climb happened. */
  loggedAt: string;
  activity: string;
  location: string;
  outcome: string;
  [field: string]: string;
}

export interface Outcome {
  /** The outcome's id: a normalised name (see core/text.ts). */
  name: string;
  category: Category;
}
