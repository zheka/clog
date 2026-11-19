import { describe, expect, it } from 'vitest';
import { getCategory, sortByName } from './outcomes';
import type { Outcome } from './types';

const outcomes: Outcome[] = [
  { name: 'flash', category: 'success' },
  { name: 'learning', category: 'work' },
];

describe('getCategory', () => {
  it('looks up by (normalised) name', () => {
    expect(getCategory(outcomes, 'flash')).toBe('success');
    expect(getCategory(outcomes, 'learning')).toBe('work');
  });
  it('falls back to the neutral category (only a safety net: data is validated)', () => {
    expect(getCategory(outcomes, 'mystery')).toBe('work');
  });
});

describe('sortByName', () => {
  it('sorts without mutating the input', () => {
    const input = [...outcomes].reverse();
    expect(sortByName(input).map((o) => o.name)).toEqual(['flash', 'learning']);
    expect(input[0].name).toBe('learning');
  });
});
