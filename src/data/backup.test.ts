import { describe, expect, it } from 'vitest';
import type { Attempt, Outcome } from '../core/types';
import {
  BackupError,
  backupFileName,
  createBackup,
  parseBackup,
  validateBackup,
  versionProblem,
} from './backup';

const outcomes: Outcome[] = [
  { name: 'flash', category: 'success' },
  { name: 'fell', category: 'failure' },
];
const attempt: Attempt = {
  id: 'a1',
  loggedAt: '2026-11-01T10:00:00.000Z',
  activity: 'kilter',
  location: 'BW Ost',
  angle: '40',
  grade: 'v4',
  outcome: 'flash',
};
const backup = (patch: Record<string, unknown> = {}) => ({
  version: 'clog 0.1.0',
  exportedAt: '2026-11-16T09:00:00.000Z',
  outcomes,
  attempts: [attempt],
  ...patch,
});
const problemsWith = (a: Record<string, unknown>) =>
  validateBackup(backup({ attempts: [{ ...attempt, ...a }] }));

describe('createBackup / parseBackup', () => {
  it('writes a versioned backup with outcomes sorted by name', () => {
    const now = new Date('2026-11-16T09:00:00Z');
    expect(createBackup([attempt], [...outcomes].reverse(), now)).toEqual({
      version: 'clog 0.1.0',
      exportedAt: '2026-11-16T09:00:00.000Z',
      outcomes: [outcomes[1], outcomes[0]],
      attempts: [attempt],
    });
  });

  it('round-trips, returning attempts oldest first', () => {
    const later = { ...attempt, id: 'a2', loggedAt: '2026-11-02T10:00:00.000Z' };
    const parsed = parseBackup(JSON.stringify(createBackup([later, attempt], outcomes)));
    expect(parsed.attempts).toEqual([attempt, later]);
    expect(parsed.outcomes).toEqual([outcomes[1], outcomes[0]]);
  });

  it('throws on invalid JSON, and a BackupError listing problems', () => {
    expect(() => parseBackup('not json')).toThrow(SyntaxError);
    const text = JSON.stringify(
      backup({ attempts: [{ ...attempt, outcome: 'x', activity: 'y' }] }),
    );
    expect(() => parseBackup(text)).toThrow(BackupError);
    try {
      parseBackup(text);
    } catch (err) {
      expect((err as BackupError).problems).toHaveLength(2);
      expect((err as Error).message).toMatch(/^Import refused: 2 problems\n {2}attempt #1/);
    }
  });
});

describe('versionProblem', () => {
  it('accepts the same 0.1 with a patch up to ours', () => {
    expect(versionProblem('clog 0.1.0')).toBeNull();
  });
  it('refuses legacy, newer and older versions', () => {
    expect(versionProblem('1.2.0')).toMatch(/not a clog backup version.*convert/);
    expect(versionProblem(undefined)).toMatch(/not a clog backup version/);
    expect(versionProblem('clog 0.1.1')).toMatch(/newer than this app/);
    expect(versionProblem('clog 0.2.0')).toMatch(/newer/);
    expect(versionProblem('clog 1.0.0')).toMatch(/newer/);
    expect(versionProblem('clog 0.0.9')).toMatch(/older than this app/);
  });
});

describe('validateBackup', () => {
  it('accepts a valid backup', () => {
    expect(validateBackup(backup())).toEqual([]);
  });

  it('refuses non-objects and legacy shapes', () => {
    expect(validateBackup([attempt])).toEqual([
      'the file is not a clog backup (expected a JSON object)',
    ]);
    expect(validateBackup(backup({ version: '1.2.0' }))).toHaveLength(1);
  });

  it('checks outcomes: normalised, unique, known category', () => {
    expect(
      validateBackup(backup({ outcomes: [...outcomes, { name: 'Flash ', category: 'x' }] })),
    ).toEqual([
      'outcome #3: name "Flash " is not normalised (expected "flash")',
      'outcome #3 "Flash ": category must be one of success, failure, work (got "x")',
    ]);
    expect(validateBackup(backup({ outcomes: [...outcomes, outcomes[0]] }))).toEqual([
      'outcome #3: "flash" is defined twice',
    ]);
    expect(validateBackup(backup({ outcomes: 'none' }))).toContain('"outcomes" must be a list');
  });

  it('checks the fixed fields of attempts', () => {
    expect(problemsWith({ location: '' })).toEqual(['attempt #1 (id a1…): missing location']);
    expect(problemsWith({ activity: 'ice' })).toEqual([
      'attempt #1 (id a1…): unknown activity "ice"',
    ]);
    expect(problemsWith({ outcome: 'sent' })).toEqual([
      'attempt #1 (id a1…): outcome "sent" is not defined',
    ]);
    expect(problemsWith({ loggedAt: 'yesterday' })).toEqual([
      'attempt #1 (id a1…): loggedAt "yesterday" is not a valid time',
    ]);
  });

  it('checks values: text, cleaned, known fields', () => {
    expect(problemsWith({ angle: 40 })).toEqual([
      'attempt #1 (id a1…): angle must be text (got 40)',
    ]);
    expect(problemsWith({ location: ' BW  Ost' })).toEqual([
      'attempt #1 (id a1…): location " BW  Ost" is not cleaned (extra spaces?)',
    ]);
    expect(problemsWith({ kind: 'bouldering' })).toEqual([
      'attempt #1 (id a1…): unknown field "kind"',
    ]);
  });

  it('allows case differences in values and fields not listed for the activity', () => {
    expect(problemsWith({ location: 'bw ost', grade: '6A' })).toEqual([]);
    expect(problemsWith({ activity: 'boulder' })).toEqual([]); // has an angle, still valid
  });

  it('refuses duplicate ids and reports every problem', () => {
    expect(validateBackup(backup({ attempts: [attempt, attempt] }))).toEqual([
      'attempt #2 (id a1…): duplicate id',
    ]);
    expect(validateBackup(backup({ attempts: [{}, 5] }))).toEqual([
      'attempt #1: missing id',
      'attempt #1: missing loggedAt',
      'attempt #1: missing activity',
      'attempt #1: missing location',
      'attempt #1: missing outcome',
      'attempt #2: not an object',
    ]);
  });
});

describe('backupFileName', () => {
  it('uses the UTC date', () => {
    expect(backupFileName(new Date('2026-11-15T23:30:00Z'))).toBe('clog_backup_2026-11-15.json');
  });
});
