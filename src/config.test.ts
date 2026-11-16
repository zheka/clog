import { describe, expect, it } from 'vitest';
import { config, findActivity, validateConfig, type AppConfig } from './config';

describe('config', () => {
  it('is valid', () => {
    expect(validateConfig(config)).toEqual([]);
  });

  it('finds activities by name', () => {
    expect(findActivity('kilter')?.fields).toEqual(['angle', 'grade']);
    expect(findActivity('nope')).toBeUndefined();
  });
});

describe('validateConfig', () => {
  const base: AppConfig = {
    fields: { grade: {} },
    activities: [{ name: 'boulder', fields: ['grade'] }],
    sameSessionHours: 2,
    maxChips: 8,
  };
  const problems = (patch: Partial<AppConfig>) => validateConfig({ ...base, ...patch });

  it('rejects reserved and badly formed field names', () => {
    expect(problems({ fields: { grade: {}, location: {} } })).toEqual([
      'field "location": name is reserved',
    ]);
    expect(problems({ fields: { grade: {}, updatedAt: {} } })).toHaveLength(2);
    expect(problems({ fields: { grade: {}, '2nd': {} } })).toHaveLength(1);
  });

  it('rejects undefined, repeated and duplicate names', () => {
    expect(problems({ activities: [{ name: 'boulder', fields: ['grade', 'angle'] }] })).toEqual([
      'activity "boulder": field "angle" is not defined',
    ]);
    expect(problems({ activities: [{ name: 'boulder', fields: ['grade', 'grade'] }] })).toEqual([
      'activity "boulder": field "grade" listed twice',
    ]);
    expect(
      problems({
        activities: [
          { name: 'boulder', fields: [] },
          { name: 'boulder', fields: [] },
        ],
      }),
    ).toEqual(['activity "boulder": duplicate name']);
  });

  it('requires normalised activity names, at least one activity, and a positive window', () => {
    expect(problems({ activities: [{ name: 'Boulder', fields: [] }] })).toHaveLength(1);
    expect(problems({ activities: [] })).toEqual(['no activities']);
    expect(problems({ sameSessionHours: 0 })).toEqual(['sameSessionHours must be positive']);
    expect(problems({ maxChips: 0 })).toEqual(['maxChips must be at least 1']);
  });
});
