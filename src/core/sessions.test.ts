import { describe, expect, it } from 'vitest';
import { formatDay, groupIntoSessions } from './sessions';
import { makeAttempt } from './test-helpers';

describe('groupIntoSessions', () => {
  it('returns no sessions for no attempts', () => {
    expect(groupIntoSessions([])).toEqual([]);
  });

  it('groups consecutive attempts with the same location, kind and day, newest first', () => {
    const a1 = makeAttempt({ loggedAt: '2026-11-14T12:00:00Z' });
    const a2 = makeAttempt({ loggedAt: '2026-11-14T13:00:00Z' });
    const b = makeAttempt({ loggedAt: '2026-11-14T14:00:00Z', kind: 'route' });
    const c = makeAttempt({ loggedAt: '2026-11-15T12:00:00Z' });
    const sessions = groupIntoSessions([a1, a2, b, c]);

    expect(sessions.map((s) => s.entries)).toEqual([[c], [b], [a2, a1]]);
    expect(sessions[2]).toMatchObject({
      location: 'BW Ost',
      kind: 'bouldering',
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

  it('labels attempts without a location as "Unknown Location"', () => {
    expect(groupIntoSessions([makeAttempt({ location: '' })])[0].location).toBe('Unknown Location');
  });
});
