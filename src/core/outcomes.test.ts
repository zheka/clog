import { describe, expect, it } from 'vitest';
import { getCategory, sortByName } from './outcomes';
import type { Outcome } from './types';

const outcomes: Outcome[] = [
  { name: 'flash', category: 'success' },
  { name: 'skipped', category: 'skip' },
];

describe('getCategory', () => {
  it('looks up by name, ignoring case and surrounding spaces', () => {
    expect(getCategory(outcomes, ' FLASH ')).toBe('success');
    expect(getCategory(outcomes, 'skipped')).toBe('skip');
  });
  it('treats unregistered outcomes as failures', () => {
    expect(getCategory(outcomes, 'mystery')).toBe('failure');
  });
});

describe('sortByName', () => {
  it('sorts without mutating the input', () => {
    const input = [...outcomes].reverse();
    expect(sortByName(input).map((o) => o.name)).toEqual(['flash', 'skipped']);
    expect(input[0].name).toBe('skipped');
  });
});
