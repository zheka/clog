import { describe, expect, it } from 'vitest';
import { matchExistingCasing, quickOutcomes, recentValues, suggestValues } from './suggestions';
import { makeAttempt } from './test-helpers';

const withLocations = (...locations: string[]) =>
  locations.map((location) => makeAttempt({ location }));

describe('recentValues', () => {
  it('returns unique trimmed values, newest first, ignoring case', () => {
    expect(recentValues(withLocations('A', ' b ', 'B', 'c'), 'location')).toEqual(['c', 'B', 'A']);
  });
  it('skips empty values and the excluded id', () => {
    const attempts = withLocations('A', '  ', 'B');
    expect(recentValues(attempts, 'location', attempts[2].id)).toEqual(['A']);
  });
});

describe('suggestValues', () => {
  const attempts = withLocations('Gym1', 'Gym2', 'Other', 'Gym4');

  it('returns the 3 most recent without a query', () => {
    expect(suggestValues(attempts, 'location', '')).toEqual(['Gym4', 'Other', 'Gym2']);
  });
  it('puts matches first, then tops up with recent values', () => {
    expect(suggestValues(attempts, 'location', 'gym1')).toEqual(['Gym1', 'Gym4', 'Other']);
    expect(suggestValues(attempts, 'location', 'gym')).toEqual(['Gym4', 'Gym2', 'Gym1']);
  });
  it('respects the limit and excluded id', () => {
    expect(suggestValues(attempts, 'location', '', attempts[3].id, 2)).toEqual(['Other', 'Gym2']);
  });
});

describe('matchExistingCasing', () => {
  const attempts = withLocations('BW Ost', 'Element');
  it('returns the stored spelling for a case-insensitive match', () => {
    expect(matchExistingCasing(attempts, 'location', '  bw ost ')).toBe('BW Ost');
  });
  it('returns the trimmed input when there is no match', () => {
    expect(matchExistingCasing(attempts, 'location', ' New Gym ')).toBe('New Gym');
    expect(matchExistingCasing(attempts, 'location', '   ')).toBe('');
  });
});

describe('quickOutcomes', () => {
  it('lists used outcomes newest first, then unused registered ones, up to the limit', () => {
    const attempts = ['a', 'B', 'b', 'c'].map((outcome) => makeAttempt({ outcome }));
    const registry = ['a', 'x', 'y', 'z'].map((name) => ({ name, category: 'success' as const }));
    expect(quickOutcomes(attempts, registry)).toEqual(['c', 'b', 'a', 'x', 'y', 'z']);
    expect(quickOutcomes(attempts, registry, 4)).toEqual(['c', 'b', 'a', 'x']);
  });
});
