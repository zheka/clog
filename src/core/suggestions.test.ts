import { describe, expect, it } from 'vitest';
import {
  fieldCandidates,
  outcomeCandidates,
  rankByQuery,
  suggestOutcomes,
  suggestValues,
} from './suggestions';
import { makeAttempt } from './test-helpers';
import type { Outcome } from './types';

const here = { activity: 'boulder', location: 'BW Ost' };

describe('fieldCandidates', () => {
  // oldest first, like stored data
  const attempts = [
    makeAttempt({ activity: 'route', location: 'TK', grade: '7-' }),
    makeAttempt({ activity: 'boulder', location: 'Seoul', grade: '8' }),
    makeAttempt({ activity: 'boulder', location: 'BW Ost', grade: '6' }),
    makeAttempt({ activity: 'boulder', location: 'BW Ost', grade: '7' }),
    makeAttempt({ activity: 'boulder', location: 'Seoul', grade: '6' }),
  ];

  it('orders field values: same activity + location, same activity, all; newest first', () => {
    expect(fieldCandidates(attempts, 'grade', here)).toEqual(['7', '6', '8', '7-']);
  });

  it('orders locations: same activity, then all', () => {
    expect(fieldCandidates(attempts, 'location', here)).toEqual(['Seoul', 'BW Ost', 'TK']);
  });

  it('keeps values that differ only by case apart, and skips the excluded attempt', () => {
    const list = [makeAttempt({ grade: '6a' }), makeAttempt({ grade: '6A' })];
    expect(fieldCandidates(list, 'grade', here)).toEqual(['6A', '6a']);
    expect(fieldCandidates(list, 'grade', here, list[1].id)).toEqual(['6a']);
  });

  it('ignores attempts without the field', () => {
    expect(fieldCandidates(attempts, 'angle', here)).toEqual([]);
  });
});

describe('rankByQuery', () => {
  const values = ['7/6+', '6', 'six', '6+', '5'];

  it('puts values starting with the text first, then containing it, then the rest', () => {
    expect(rankByQuery(values, '6')).toEqual(['6', '6+', '7/6+', 'six', '5']);
  });

  it('drops non-matching values without backfill', () => {
    expect(rankByQuery(values, '6', false)).toEqual(['6', '6+', '7/6+']);
  });

  it('ignores case and surrounding spaces, and keeps the order for no text', () => {
    expect(rankByQuery(['BW Ost', 'Seoul'], ' bw ')).toEqual(['BW Ost', 'Seoul']);
    expect(rankByQuery(values, '  ')).toEqual(values);
  });
});

describe('suggestValues', () => {
  it('always fills the row: matches first, then backfill, up to the limit', () => {
    const attempts = ['5', '6', '7', '8'].map((grade) => makeAttempt({ grade }));
    expect(suggestValues(attempts, 'grade', '', here, null, 3)).toEqual(['8', '7', '6']);
    expect(suggestValues(attempts, 'grade', '5', here, null, 3)).toEqual(['5', '8', '7']);
    expect(suggestValues(attempts, 'grade', 'x', here, null, 2)).toEqual(['8', '7']);
  });
});

describe('outcomes', () => {
  const outcomes: Outcome[] = ['flash', 'send', 'fell', 'onsight', 'pumped'].map((name) => ({
    name,
    category: 'success',
  }));
  const attempts = [
    makeAttempt({ activity: 'route', outcome: 'onsight' }),
    makeAttempt({ activity: 'boulder', outcome: 'fell' }),
    makeAttempt({ activity: 'boulder', outcome: 'flash' }),
    makeAttempt({ activity: 'route', outcome: 'mystery' }), // not in the list
  ];

  it('come from the outcome list only: this activity, then any activity, then unused', () => {
    expect(outcomeCandidates(attempts, outcomes, 'boulder')).toEqual([
      'flash',
      'fell',
      'onsight',
      'send',
      'pumped',
    ]);
  });

  it('while typing, only the matching ones (no backfill), up to the limit', () => {
    expect(suggestOutcomes(attempts, outcomes, 'boulder', 'f', 3)).toEqual(['flash', 'fell']);
    expect(suggestOutcomes(attempts, outcomes, 'boulder', 'f', 1)).toEqual(['flash']);
    expect(suggestOutcomes(attempts, outcomes, 'boulder', 'xyz', 8)).toEqual([]);
  });
});
