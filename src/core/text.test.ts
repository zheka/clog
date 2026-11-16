import { describe, expect, it } from 'vitest';
import { cleanText, normalizeName } from './text';

describe('cleanText', () => {
  it('trims, collapses whitespace and keeps case', () => {
    expect(cleanText('  BW \t Ost\n ')).toBe('BW Ost');
    expect(cleanText('6A')).toBe('6A');
  });
  it('applies Unicode NFC', () => {
    expect(cleanText('Öst')).toBe('Öst');
  });
});

describe('normalizeName', () => {
  it('also lowercases', () => {
    expect(normalizeName(' Fell  At Crux ')).toBe('fell at crux');
  });
});
