import { describe, expect, it } from 'vitest';
import type { Attempt } from '../core/types';
import { backupFileName, createBackup, parseBackup } from './backup';

const attempt: Attempt = {
  id: 'a1',
  loggedAt: '2026-11-01T10:00:00.000Z',
  kind: 'bouldering',
  location: 'BW Ost',
  grade: 'v4',
  outcome: 'flash',
};

describe('parseBackup', () => {
  it('reads the current format with outcomes', () => {
    const text = JSON.stringify({
      version: '1.2.0',
      outcomes: [{ name: 'flash', category: 'success' }],
      attempts: [attempt],
    });
    const { attempts, outcomes } = parseBackup(text);
    expect(attempts).toEqual([attempt]);
    expect(outcomes).toEqual([{ name: 'flash', category: 'success' }]);
  });

  it('reads legacy formats: bare array, `entries`, `timestamp`, `customOutcomes`', () => {
    const legacy = { ...attempt, loggedAt: undefined, timestamp: attempt.loggedAt };
    expect(parseBackup(JSON.stringify([legacy])).attempts).toEqual([attempt]);
    expect(parseBackup(JSON.stringify({ entries: [legacy] })).attempts).toEqual([attempt]);
    expect(
      parseBackup(
        JSON.stringify({ attempts: [attempt], customOutcomes: [{ name: 'x', category: 'skip' }] }),
      ).outcomes,
    ).toEqual([{ name: 'x', category: 'skip' }]);
  });

  it('returns null outcomes when the file has none', () => {
    expect(parseBackup(JSON.stringify([attempt])).outcomes).toBeNull();
  });

  it('drops attempts missing required fields', () => {
    const { attempts } = parseBackup(
      JSON.stringify([attempt, { ...attempt, id: 'a2', grade: '' }, null]),
    );
    expect(attempts.map((a) => a.id)).toEqual(['a1']);
  });

  it('replaces missing and duplicate ids', () => {
    const { attempts } = parseBackup(
      JSON.stringify([attempt, attempt, { ...attempt, id: undefined }]),
    );
    expect(attempts[0].id).toBe('a1');
    expect(new Set(attempts.map((a) => a.id)).size).toBe(3);
  });

  it('defaults unknown kinds to bouldering and keeps board angle only for kilterboard', () => {
    const { attempts } = parseBackup(
      JSON.stringify([
        { ...attempt, id: 'k', kind: 'kilterboard', boardAngle: '40' },
        { ...attempt, id: 'b', kind: 'bouldering', boardAngle: 40 },
        { ...attempt, id: 'u', kind: 'ice' },
      ]),
    );
    expect(attempts.find((a) => a.id === 'k').boardAngle).toBe(40);
    expect(attempts.find((a) => a.id === 'b')).not.toHaveProperty('boardAngle');
    expect(attempts.find((a) => a.id === 'u').kind).toBe('bouldering');
  });

  it('trims text fields and sorts oldest first', () => {
    const later = {
      ...attempt,
      id: 'late',
      loggedAt: '2026-11-02T10:00:00.000Z',
      location: '  BW Ost  ',
    };
    const { attempts } = parseBackup(JSON.stringify([later, attempt]));
    expect(attempts.map((a) => a.id)).toEqual(['a1', 'late']);
    expect(attempts[1].location).toBe('BW Ost');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseBackup('not json')).toThrow();
  });
});

describe('createBackup', () => {
  it('builds a versioned payload with sorted outcomes and clean attempts', () => {
    const now = new Date('2026-11-15T12:00:00Z');
    const kb = { ...attempt, id: 'k', kind: 'kilterboard' as const, boardAngle: 40 };
    const extra = { ...attempt, id: 'x', extra: 'dropped' } as typeof attempt;
    const backup = createBackup(
      [kb, extra],
      [
        { name: 'z', category: 'skip' },
        { name: 'a', category: 'success' },
      ],
      now,
    );
    expect(backup).toEqual({
      version: '1.2.0',
      exportedAt: '2026-11-15T12:00:00.000Z',
      outcomes: [
        { name: 'a', category: 'success' },
        { name: 'z', category: 'skip' },
      ],
      attempts: [kb, { ...attempt, id: 'x' }],
    });
  });

  it('round-trips through parseBackup', () => {
    const attempts = [attempt, { ...attempt, id: 'b', loggedAt: '2026-11-02T10:00:00.000Z' }];
    const outcomes = [{ name: 'flash', category: 'success' as const }];
    const parsed = parseBackup(JSON.stringify(createBackup(attempts, outcomes)));
    expect(parsed).toEqual({ attempts, outcomes });
  });
});

describe('backupFileName', () => {
  it('uses the UTC date', () => {
    expect(backupFileName(new Date('2026-11-15T23:30:00Z'))).toBe('clog_backup_2026-11-15.json');
  });
});
