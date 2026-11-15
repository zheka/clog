import { describe, expect, it } from 'vitest';
import {
  createAttempt,
  generateId,
  isCompleteAttempt,
  normalizeAttempt,
  sortByTime,
  unwrapAttempts,
  withChanges,
} from './attempt';
import { makeAttempt } from './test-helpers';

describe('generateId', () => {
  it('returns unique ids', () => {
    expect(new Set(Array.from({ length: 100 }, generateId)).size).toBe(100);
  });
});

describe('isCompleteAttempt', () => {
  const full = { loggedAt: 't', location: 'l', grade: 'g', outcome: 'o' };
  it('requires time (loggedAt or timestamp), location, grade and outcome', () => {
    expect(isCompleteAttempt(full)).toBe(true);
    expect(isCompleteAttempt({ ...full, loggedAt: undefined, timestamp: 't' })).toBe(true);
    for (const key of ['loggedAt', 'location', 'grade', 'outcome']) {
      expect(isCompleteAttempt({ ...full, [key]: '' })).toBe(false);
    }
  });
  it('rejects non-objects', () => {
    expect(isCompleteAttempt(null)).toBe(false);
    expect(isCompleteAttempt('x')).toBe(false);
  });
});

describe('normalizeAttempt', () => {
  it('keeps a valid attempt as is', () => {
    const a = makeAttempt();
    expect(normalizeAttempt({ ...a })).toEqual(a);
  });

  it('fills defaults for missing fields', () => {
    const a = normalizeAttempt({});
    expect(a).toEqual({
      id: expect.any(String),
      loggedAt: expect.any(String),
      kind: 'bouldering',
      location: 'Unknown',
      grade: '',
      outcome: '',
    });
    expect(Number.isNaN(Date.parse(a.loggedAt))).toBe(false);
  });

  it('reads legacy `timestamp`, trims text and stringifies values', () => {
    expect(
      normalizeAttempt({ id: 'x', timestamp: 'T', location: ' Gym ', grade: 5, outcome: ' ok ' }),
    ).toMatchObject({ loggedAt: 'T', location: 'Gym', grade: '5', outcome: 'ok' });
  });

  it('keeps a numeric board angle only for kilterboard', () => {
    expect(normalizeAttempt({ kind: 'kilterboard', boardAngle: '40' }).boardAngle).toBe(40);
    expect(normalizeAttempt({ kind: 'kilterboard', boardAngle: 0 }).boardAngle).toBe(0);
    expect(normalizeAttempt({ kind: 'kilterboard', boardAngle: '' })).not.toHaveProperty(
      'boardAngle',
    );
    expect(normalizeAttempt({ kind: 'route', boardAngle: 40 })).not.toHaveProperty('boardAngle');
  });

  it('turns unknown kinds into bouldering', () => {
    expect(normalizeAttempt({ kind: 'ice' }).kind).toBe('bouldering');
  });
});

describe('unwrapAttempts', () => {
  it('accepts a bare array, `attempts` or `entries`', () => {
    expect(unwrapAttempts([1])).toEqual([1]);
    expect(unwrapAttempts({ attempts: [1] })).toEqual([1]);
    expect(unwrapAttempts({ entries: [1] })).toEqual([1]);
    expect(unwrapAttempts({})).toEqual([]);
  });
});

describe('sortByTime', () => {
  it('sorts oldest first without mutating the input', () => {
    const [a, b] = [makeAttempt(), makeAttempt()];
    const input = [b, a];
    expect(sortByTime(input)).toEqual([a, b]);
    expect(input).toEqual([b, a]);
  });
});

describe('createAttempt / withChanges', () => {
  const input = {
    kind: 'kilterboard' as const,
    location: 'Gym',
    grade: 'v5',
    outcome: 'flash',
    boardAngle: 40,
  };

  it('creates an attempt stamped with the given time', () => {
    const now = new Date('2026-11-15T12:00:00Z');
    expect(createAttempt(input, now)).toEqual({
      id: expect.any(String),
      loggedAt: '2026-11-15T12:00:00.000Z',
      ...input,
    });
  });

  it('applies changes, dropping the angle when not kilterboard or not set', () => {
    const a = makeAttempt({ kind: 'kilterboard', boardAngle: 30 });
    expect(withChanges(a, input)).toEqual({ ...a, ...input });
    expect(withChanges(a, { ...input, boardAngle: null })).not.toHaveProperty('boardAngle');
    expect(withChanges(a, { ...input, kind: 'route' })).not.toHaveProperty('boardAngle');
    expect(a.boardAngle).toBe(30);
  });
});
