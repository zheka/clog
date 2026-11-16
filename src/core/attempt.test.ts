import { describe, expect, it } from 'vitest';
import { createAttempt, generateId, sortByTime, withChanges, type AttemptInput } from './attempt';
import { makeAttempt } from './test-helpers';

describe('generateId', () => {
  it('returns unique ids', () => {
    expect(new Set(Array.from({ length: 100 }, generateId)).size).toBe(100);
  });
});

describe('createAttempt / withChanges', () => {
  const input: AttemptInput = {
    activity: 'kilter',
    location: 'Gym',
    outcome: 'flash',
    fields: { angle: '40', grade: 'v5' },
  };

  it('creates a flat attempt stamped with the given time, keys in design order', () => {
    const now = new Date('2026-11-15T12:00:00Z');
    const a = createAttempt(input, now);
    expect(a).toEqual({
      id: expect.any(String),
      loggedAt: '2026-11-15T12:00:00.000Z',
      activity: 'kilter',
      location: 'Gym',
      angle: '40',
      grade: 'v5',
      outcome: 'flash',
    });
    expect(Object.keys(a)).toEqual([
      'id',
      'loggedAt',
      'activity',
      'location',
      'angle',
      'grade',
      'outcome',
    ]);
  });

  it('leaves out empty fields', () => {
    expect(createAttempt({ ...input, fields: { angle: '', grade: 'v5' } })).not.toHaveProperty(
      'angle',
    );
  });

  it('replaces activity fields and keeps id and time', () => {
    const a = makeAttempt({ activity: 'kilter', angle: '30' });
    const updated = withChanges(a, { ...input, activity: 'boulder', fields: { grade: '6a' } });
    expect(updated).toEqual({
      id: a.id,
      loggedAt: a.loggedAt,
      activity: 'boulder',
      location: 'Gym',
      grade: '6a',
      outcome: 'flash',
    });
    expect(a.angle).toBe('30'); // not mutated
  });
});

describe('withChanges: fields the previous activity did not list', () => {
  const input: AttemptInput = {
    activity: 'route',
    location: 'TK',
    outcome: 'send',
    fields: { grade: '7' },
  };

  it('keeps them (still defined in the config, just not listed)', () => {
    const a = makeAttempt({ activity: 'boulder', angle: '30' }); // boulder doesn't list angle
    expect(withChanges(a, input).angle).toBe('30');
  });

  it('drops fields the previous activity listed when the new one does not', () => {
    const a = makeAttempt({ activity: 'kilter', angle: '30' });
    expect(withChanges(a, input)).not.toHaveProperty('angle');
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
