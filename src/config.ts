/**
 * App configuration: what the app offers, as opposed to what you enter in it (outcomes live in
 * the backup). Edit here, run `npm test` (src/config.test.ts checks the rules), push.
 *
 * Renaming or removing an activity or field that saved data uses needs a migration of the
 * data: see docs/design.md.
 */
import { RESERVED_KEYS } from './core/types';
import { normalizeName } from './core/text';

/** Properties of an activity field. None yet; display options come with the UX work. */
export type FieldConfig = Record<string, never>;

export interface ActivityConfig {
  /** Shown on the tab and in history headers; stored in each attempt's `activity`. */
  name: string;
  /** The activity's own fields, in form order (each defined in `fields`). */
  fields: string[];
}

export interface AppConfig {
  /** Each activity field, defined once. Its name is the key in the attempt record. */
  fields: Record<string, FieldConfig>;
  /** In tab order. */
  activities: ActivityConfig[];
  /** A new entry starts with the context (activity, location) collapsed this soon after the last one. */
  sameSessionHours: number;
  /** Most chips in one chip row (the row is a single line that scrolls sideways). */
  maxChips: number;
}

export const config: AppConfig = {
  fields: {
    grade: {},
    angle: {},
  },
  activities: [
    { name: 'boulder', fields: ['grade'] },
    { name: 'route', fields: ['grade'] },
    { name: 'kilter', fields: ['angle', 'grade'] },
  ],
  sameSessionHours: 4,
  maxChips: 8,
};

export function findActivity(name: string, cfg: AppConfig = config): ActivityConfig | undefined {
  return cfg.activities.find((a) => a.name === name);
}

const FIELD_NAME = /^[a-z][a-z0-9]*$/;

/** Problems with a configuration; empty when valid. */
export function validateConfig(cfg: AppConfig): string[] {
  const problems: string[] = [];
  for (const field of Object.keys(cfg.fields)) {
    if (!FIELD_NAME.test(field)) {
      problems.push(`field "${field}": use lowercase letters and digits, starting with a letter`);
    }
    if (RESERVED_KEYS.includes(field)) problems.push(`field "${field}": name is reserved`);
  }
  if (cfg.activities.length === 0) problems.push('no activities');
  const names = new Set<string>();
  for (const activity of cfg.activities) {
    const label = `activity "${activity.name}"`;
    if (!activity.name || normalizeName(activity.name) !== activity.name) {
      problems.push(`${label}: name must be normalised (lowercase, single spaces)`);
    }
    if (names.has(activity.name)) problems.push(`${label}: duplicate name`);
    names.add(activity.name);
    const seen = new Set<string>();
    for (const field of activity.fields) {
      if (!(field in cfg.fields)) problems.push(`${label}: field "${field}" is not defined`);
      if (seen.has(field)) problems.push(`${label}: field "${field}" listed twice`);
      seen.add(field);
    }
  }
  if (!(cfg.sameSessionHours > 0)) problems.push('sameSessionHours must be positive');
  if (!(cfg.maxChips >= 1)) problems.push('maxChips must be at least 1');
  return problems;
}
