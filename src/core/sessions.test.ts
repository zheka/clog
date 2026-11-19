import { describe, expect, it } from 'vitest';
import { formatDay, groupIntoSessions } from './sessions';
import { makeAttempt } from './test-helpers';

describe('groupIntoSessions', () => {
  it('returns no sessions for no attempts', () => {
    expect(groupIntoSessions([])).toEqual([]);
  });

  it('groups consecutive attempts with the same activity, location and day, newest first', () => {
    const a1 = makeAttempt({ loggedAt: '2026-11-14T12:00:00Z' });
    const a2 = makeAttempt({ loggedAt: '2026-11-14T13:00:00Z' });
    const b = makeAttempt({ loggedAt: '2026-11-14T14:00:00Z', activity: 'route' });
    const c = makeAttempt({ loggedAt: '2026-11-15T12:00:00Z' });
    const sessions = groupIntoSessions([a1, a2, b, c]);

    expect(sessions.map((s) => s.attempts)).toEqual([[c], [b], [a2, a1]]);
    expect(sessions[2]).toMatchObject({
      location: 'BW Ost',
      activity: 'boulder',
      dateString: formatDay('2026-11-14T12:00:00Z'),
    });
  });

  it('starts a new session when another location is interleaved', () => {
    const attempts = [
      makeAttempt({ location: 'A' }),
      makeAttempt({ location: 'B' }),
      makeAttempt({ location: 'A' }),
    ];
    expect(groupIntoSessions(attempts).map((s) => s.location)).toEqual(['A', 'B', 'A']);
  });

  it('keeps the same day of different years apart, though both show "Nov 14"', () => {
    const lastYear = makeAttempt({ loggedAt: '2025-11-14T12:00:00Z' });
    const thisYear = makeAttempt({ loggedAt: '2026-11-14T12:00:00Z' });
    const sessions = groupIntoSessions([lastYear, thisYear]);
    expect(sessions.map((s) => s.attempts)).toEqual([[thisYear], [lastYear]]);
    expect(sessions[0].dateString).toBe(sessions[1].dateString);
  });
});
