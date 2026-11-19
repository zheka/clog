// @vitest-environment jsdom
/** UI tests: The history list: loading saved data, sessions, cards. */
import { describe, expect, it } from 'vitest';
import { q, expandAll, $, texts, attempt, OUTCOMES, start, useAppTestSetup } from './test-app';

useAppTestSetup();

describe('loading and history list', () => {
  it('shows the empty state with no data', async () => {
    await start(undefined, null);
    expect($('historyList').textContent).toContain('No attempts logged yet.');
  });

  it('ignores data saved by the pre-0.1.0 app and starts empty', async () => {
    await start(undefined, null, {
      climb_attempts_history: JSON.stringify([attempt()]),
      climb_outcomes_registry: JSON.stringify(OUTCOMES),
    });
    expect($('historyList').textContent).toContain('No attempts logged yet.');
    expect(localStorage.getItem('climb_attempts_history')).not.toBeNull();
  });

  it('groups consecutive attempts by activity, location and day, newest first', async () => {
    await start([
      attempt({ id: 'a1', loggedAt: '2026-11-14T12:00:00Z', location: 'A', grade: 'v1' }),
      attempt({ id: 'a2', loggedAt: '2026-11-14T13:00:00Z', location: 'A', grade: 'v2' }),
      attempt({
        id: 'a3',
        loggedAt: '2026-11-14T14:00:00Z',
        location: 'B',
        activity: 'route',
        grade: '6b',
      }),
      attempt({ id: 'a4', loggedAt: '2026-11-15T12:00:00Z', location: 'A', grade: 'v3' }),
    ]);
    const groups = [...document.querySelectorAll('.group-container')];
    expect(groups).toHaveLength(3);
    const day = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    expect(q('.group-header', groups[0]).textContent).toContain(
      `${day('2026-11-15T12:00:00Z')} • boulder • A`,
    );
    expect(q('.group-header', groups[1]).textContent).toContain('route • B');
    // expanding is instant and has no height limit (a long session is shown in full)
    const body = (g: Element) => getComputedStyle(q('.group-body', g));
    expect(body(groups[0]).display).toBe('flex');
    expect(body(groups[0]).maxHeight).toMatch(/^(none|)$/);
    expect(body(groups[0]).transitionProperty).toMatch(/^(all|)$/); // no transition set
    // a collapsed group builds no cards
    expect(groups[1].querySelector('.group-body')).toBeNull();
    // each session is a frame, 8px apart; attempts inside are borderless
    expect(getComputedStyle($('historyList')).rowGap).toBe('8px');
    expect(getComputedStyle(groups[0]).borderTopStyle).toBe('solid');
    expect(getComputedStyle(q('.attempt-card', groups[0])).borderTopStyle).toMatch(/^(none|)$/);
    // names shown exactly as stored: no forced capitals (activities lowercase, locations as typed)
    expect(getComputedStyle(q('.group-header', groups[0])).textTransform).toMatch(/^(none|)$/);
    // header: starts with the date (no icon before it), in the normal text colour
    expect(q('.group-header-left', groups[0]).querySelector('svg')).toBeNull();
    expect(getComputedStyle(q('.group-header', groups[0])).color).toBe(
      getComputedStyle(document.body).color,
    );
    // header style: no line under it; the chevron is an outline in the text colour
    const header = getComputedStyle(q('.group-header', groups[0]));
    expect(header.borderBottomStyle).toMatch(/^(none|)$/);
    const chevron = getComputedStyle(q('.group-chevron', groups[0]));
    const formChevron = getComputedStyle(q('#contextHeader .group-chevron'));
    expect([chevron.fill, chevron.color]).toEqual([formChevron.fill, formChevron.color]);
    expect(chevron.fill).toBe('none');
    // only the newest group starts expanded; header click toggles and builds the cards
    expect(groups.map((g) => g.classList.contains('collapsed'))).toEqual([false, true, true]);
    q('.group-header', groups[2]).click();
    expect(groups[2].classList.contains('collapsed')).toBe(false);
    expect([...groups[2].querySelectorAll('.field-badge')].map((e) => e.textContent)).toEqual([
      'v2',
      'v1',
    ]);
  });

  it('renders time, activity fields as badges, and outcome badge colour by category', async () => {
    await start([
      attempt({ id: 's', outcome: 'flash' }),
      attempt({ id: 'f', outcome: 'fell', loggedAt: '2026-11-14T12:01:00Z' }),
      attempt({ id: 'k', outcome: 'learning', loggedAt: '2026-11-14T12:02:00Z' }),
      attempt({
        id: 'kb',
        activity: 'kilter',
        angle: '40',
        outcome: 'flash',
        loggedAt: '2026-11-14T12:04:00Z',
      }),
    ]);
    expandAll();
    const badge = (id: string) => q(`[data-attempt-id="${id}"] .attempt-status-badge`).className;
    expect(badge('s')).toContain('attempt-status-success');
    expect(badge('f')).toContain('attempt-status-failure');
    expect(badge('k')).toContain('attempt-status-work');
    // every field the activity lists, as a badge in config order; no tags
    expect(texts('[data-attempt-id="kb"] .field-badge')).toEqual(['40', 'v4']);
    expect(document.querySelector('.detail-tag')).toBeNull();
    const time = new Date('2026-11-14T12:00:00Z').toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    expect(q('[data-attempt-id="s"] .attempt-time').textContent).toBe(time);
  });

  it('escapes HTML in user text', async () => {
    await start([attempt({ grade: '<b>v4</b>' })]);
    expect(q('.field-badge').innerHTML).toBe('&lt;b&gt;v4&lt;/b&gt;');
  });
});
