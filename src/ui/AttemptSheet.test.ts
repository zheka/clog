// @vitest-environment jsdom
/** UI tests: The new/edit attempt sheet: prefill, chips, logging, outcomes, editing and deleting. */
import { describe, expect, it } from 'vitest';
import {
  NOW,
  q,
  expandAll,
  $,
  texts,
  stored,
  storedOutcomes,
  type,
  clickChip,
  attempt,
  OUTCOMES,
  alertMock,
  confirmMock,
  start,
  useAppTestSetup,
} from './test-app';

useAppTestSetup();

describe('new attempt sheet', () => {
  it('prefills from the last attempt and collapses context within 4 hours', async () => {
    await start([
      attempt({ id: 'old', location: 'Elsewhere', loggedAt: '2026-11-01T12:00:00Z' }),
      attempt({
        id: 'last',
        activity: 'kilter',
        angle: '40',
        location: 'BW Ost',
        grade: 'v5',
        loggedAt: '2026-11-15T11:00:00Z',
      }),
    ]);
    $('newAttemptBtn').click();
    expect($('attemptSheet').classList.contains('active')).toBe(true);
    expect($('attemptSheetTitle').textContent).toBe('New Attempt');
    expect($('deleteBtn').style.display).toBe('none');
    expect($<HTMLInputElement>('locationInput').value).toBe('BW Ost');
    expect($<HTMLInputElement>('field-grade').value).toBe('v5');
    expect($<HTMLInputElement>('field-angle').value).toBe('40');
    expect(texts('#activityFields label')).toEqual(['angle', 'grade']);
    expect(q('.activity-tab.active').getAttribute('data-activity')).toBe('kilter');
    expect($('contextBody').classList.contains('hidden')).toBe(true);
    expect($('contextHeader').getAttribute('aria-expanded')).toBe('false');
    expect($('contextSummaryText').textContent).toBe('kilter • BW Ost');
  });

  it('expands context when the last attempt is older than 4 hours, or with no history', async () => {
    await start([attempt({ loggedAt: '2026-11-15T08:01:00Z' })]);
    $('newAttemptBtn').click();
    expect($('contextBody').classList.contains('hidden')).toBe(true); // 3h59m: same session

    await start([attempt({ loggedAt: '2026-11-15T07:59:00Z' })]);
    $('newAttemptBtn').click();
    expect($('contextBody').classList.contains('hidden')).toBe(false);
    expect($('contextHeader').getAttribute('aria-expanded')).toBe('true');

    await start(undefined);
    $('newAttemptBtn').click();
    expect($('contextBody').classList.contains('hidden')).toBe(false);
    expect($<HTMLInputElement>('locationInput').value).toBe('');
    expect($('contextSummaryText').textContent).toBe('boulder • Unknown Location');
  });

  it('shows one tab per configured activity, and the fields of the selected activity', async () => {
    await start([attempt()]);
    $('newAttemptBtn').click();
    expect(texts('.activity-tab')).toEqual(['boulder', 'route', 'kilter']);
    expect(getComputedStyle(q('.activity-tab')).textTransform).toMatch(/^(none|)$/);
    expect(q('.activity-tab.active').dataset.activity).toBe('boulder');
    expect(texts('#activityFields label')).toEqual(['grade']);
    q('.activity-tab[data-activity="kilter"]').click();
    expect(texts('#activityFields label')).toEqual(['angle', 'grade']);
  });

  it('toggles the context section and updates its summary while typing', async () => {
    await start([attempt({ loggedAt: '2026-11-15T11:30:00Z' })]);
    $('newAttemptBtn').click();
    $('contextHeader').click();
    expect($('contextBody').classList.contains('hidden')).toBe(false);
    expect($('contextHeader').getAttribute('aria-expanded')).toBe('true');
    type('locationInput', 'New Gym');
    expect($('contextSummaryText').textContent).toBe('boulder • New Gym');
    q('[data-activity="route"]', $('contextBody')).click();
    expect($('contextSummaryText').textContent).toBe('route • New Gym');
  });

  it('closes via the close button and the overlay without saving', async () => {
    await start([attempt()]);
    $('newAttemptBtn').click();
    $('closeAttemptSheetBtn').click();
    expect($('attemptSheet').classList.contains('active')).toBe(false);
    $('newAttemptBtn').click();
    $('attemptSheet').click();
    expect($('attemptSheet').classList.contains('active')).toBe(false);
    expect(stored()).toHaveLength(1);
  });

  it('suggests up to 8 recent distinct locations; matches first, then backfill', async () => {
    const names = ['Gym1', 'Gym2', 'gym2', 'Gym3', 'Gym4', 'Gym5', 'Gym6', 'Gym7', 'Gym8', 'Gym9'];
    await start(
      names.map((location, i) =>
        attempt({ id: `a${i}`, location, loggedAt: `2026-11-1${i}T12:00:00Z` }),
      ),
    );
    $('newAttemptBtn').click();
    expect(texts('#locationChips .chip-small')).toEqual([
      'Gym9',
      'Gym8',
      'Gym7',
      'Gym6',
      'Gym5',
      'Gym4',
      'Gym3',
      'gym2',
    ]);
    type('locationInput', 'gym1');
    expect(texts('#locationChips .chip-small')).toEqual([
      'Gym1',
      'Gym9',
      'Gym8',
      'Gym7',
      'Gym6',
      'Gym5',
      'Gym4',
      'Gym3',
    ]);
    clickChip('locationChips', 'Gym1');
    expect($<HTMLInputElement>('locationInput').value).toBe('Gym1');
    expect($('contextSummaryText').textContent).toBe('boulder • Gym1');
  });

  it('suggests grades: this gym first, then the same activity elsewhere, then any activity', async () => {
    await start([
      attempt({ id: 'r', activity: 'route', location: 'TK', grade: '7-' }),
      attempt({ id: 's', location: 'Seoul', grade: '8', loggedAt: '2026-11-14T12:01:00Z' }),
      attempt({ id: 'b', location: 'BW Ost', grade: '6', loggedAt: '2026-11-14T12:02:00Z' }),
    ]);
    $('newAttemptBtn').click();
    expect(texts('#chips-grade .chip-small')).toEqual(['6', '8', '7-']);
    // the prefilled value doesn't filter, and is highlighted
    expect(q('#chips-grade .chip-small.current').textContent).toBe('6');
    // typed text: values starting with it first, then the rest as backfill
    type('field-grade', '7');
    expect(texts('#chips-grade .chip-small')).toEqual(['7-', '6', '8']);
    clickChip('chips-grade', '8');
    expect($<HTMLInputElement>('field-grade').value).toBe('8');
    expect(texts('#chips-grade .chip-small')).toEqual(['6', '8', '7-']);
  });

  it('suggests angles from recent board attempts', async () => {
    await start([
      attempt({ id: 'k1', activity: 'kilter', angle: '45' }),
      attempt({ id: 'k2', activity: 'kilter', angle: '40', loggedAt: '2026-11-14T12:01:00Z' }),
    ]);
    $('newAttemptBtn').click();
    expect(texts('#chips-angle .chip-small')).toEqual(['40', '45']);
    clickChip('chips-angle', '45');
    expect($<HTMLInputElement>('field-angle').value).toBe('45');
  });

  it('switching activity loads that activity’s previous attempt', async () => {
    await start([
      attempt({ id: 'k', activity: 'kilter', location: 'Home', angle: '40', grade: 'v5' }),
      attempt({ id: 'b', location: 'BW Ost', grade: '6', loggedAt: '2026-11-14T12:01:00Z' }),
    ]);
    $('newAttemptBtn').click();
    q('.activity-tab[data-activity="kilter"]').click();
    expect($<HTMLInputElement>('locationInput').value).toBe('Home');
    expect($<HTMLInputElement>('field-angle').value).toBe('40');
    expect($<HTMLInputElement>('field-grade').value).toBe('v5');
    // no previous route attempt: location and shared fields are kept
    q('.activity-tab[data-activity="route"]').click();
    expect($<HTMLInputElement>('locationInput').value).toBe('Home');
    expect($<HTMLInputElement>('field-grade').value).toBe('v5');
  });

  it('shows outcome chips by recency, then unused outcomes from the list, max 8', async () => {
    const outcomes = 'abcdefghij'.split('').map((name) => ({ name, category: 'success' }));
    await start([attempt({ id: '1', outcome: 'c' }), attempt({ id: '2', outcome: 'e' })], outcomes);
    $('newAttemptBtn').click();
    expect(texts('#outcomeChips .chip')).toEqual(['e', 'c', 'a', 'b', 'd', 'f', 'g', 'h']);
    const chips = [...$('outcomeChips').children] as HTMLElement[];
    expect(chips[0].className).toBe('chip success current');
    // the last used outcome is highlighted
    expect(chips[0].classList.contains('current')).toBe(true);
    expect(chips[1].classList.contains('current')).toBe(false);
  });

  it('shows no outcome chips on a fresh install (empty registry)', async () => {
    await start(undefined, null);
    $('newAttemptBtn').click();
    expect($('outcomeChips').children).toHaveLength(0);
  });
});

describe('logging attempts', () => {
  it('logs a new attempt when an outcome chip is clicked', async () => {
    await start([attempt({ activity: 'kilter', angle: '40' })]);
    $('newAttemptBtn').click();
    type('field-grade', 'v5');
    clickChip('outcomeChips', 'flash');
    const all = stored();
    expect(all).toHaveLength(2);
    expect(all[1]).toEqual({
      id: expect.any(String),
      loggedAt: NOW.toISOString(),
      activity: 'kilter',
      location: 'BW Ost',
      grade: 'v5',
      outcome: 'flash',
      angle: '40',
    });
    expect(all[1].id).not.toBe('a1');
    expect($('attemptSheet').classList.contains('active')).toBe(false);
    // today's new session is expanded; yesterday's is collapsed (no cards built)
    expect(document.querySelectorAll('.group-container')).toHaveLength(2);
    expect(document.querySelectorAll('.attempt-card')).toHaveLength(1);
  });

  it('cleans typed text but keeps its case', async () => {
    await start([attempt({ location: 'BW Ost', grade: 'V4' })]);
    $('newAttemptBtn').click();
    type('locationInput', '  bw   ost ');
    type('field-grade', 'v4');
    clickChip('outcomeChips', 'flash');
    expect(stored()[1]).toMatchObject({ location: 'bw ost', grade: 'v4' });
  });

  it('requires every field: empty ones show a red "add …" hint and the outcome chips fade', async () => {
    await start([attempt({ activity: 'kilter', angle: '40' })]);
    $('newAttemptBtn').click();
    const blocked = () => $('outcomeChips').classList.contains('blocked');
    expect(blocked()).toBe(false);
    expect($<HTMLInputElement>('field-angle').placeholder).toBe('add angle');
    expect($<HTMLInputElement>('locationInput').placeholder).toBe('add location');
    expect(getComputedStyle(q('#outcomeChips .chip')).opacity).toBe('1');

    type('field-angle', '');
    expect(blocked()).toBe(true);
    expect(getComputedStyle(q('#outcomeChips .chip')).opacity).toBe('0.35');
    expect(getComputedStyle(q('#outcomeChips .chip')).pointerEvents).toBe('none');
    // a stray tap still does nothing, and there is no popup
    clickChip('outcomeChips', 'flash');
    expect(stored()).toHaveLength(1);
    expect(alertMock).not.toHaveBeenCalled();
    expect($('attemptSheet').classList.contains('active')).toBe(true);

    // filling the field (here from a chip) makes the outcome chips active again
    clickChip('chips-angle', '40');
    expect(blocked()).toBe(false);
    clickChip('outcomeChips', 'flash');
    expect(stored()).toHaveLength(2);
  });

  it('new-outcome chips are inactive too, and register nothing while a field is empty', async () => {
    await start([attempt()]);
    $('newAttemptBtn').click();
    type('field-grade', '');
    type('outcomeInput', 'new one');
    expect($('newOutcomeChips').classList.contains('blocked')).toBe(true);
    q('#newOutcomeChips .chip').click();
    expect(storedOutcomes()).toEqual(OUTCOMES);
    expect(stored()).toHaveLength(1);
  });

  it('opens the context section when the location is empty', async () => {
    // fresh install: nothing to prefill
    await start(undefined, null);
    $('newAttemptBtn').click();
    expect($('contextBody').classList.contains('hidden')).toBe(false);
    expect($('outcomeChips').classList.contains('blocked')).toBe(true);
    // switching activity with no previous attempt keeps it open while the location is empty
    q('.activity-tab[data-activity="kilter"]').click();
    expect($('contextBody').classList.contains('hidden')).toBe(false);
  });

  it('keeps the context section open while the location is empty', async () => {
    await start([attempt({ loggedAt: '2026-11-15T11:30:00Z' })]); // same session: starts collapsed
    $('newAttemptBtn').click();
    const open = () => !$('contextBody').classList.contains('hidden');
    expect(open()).toBe(false);
    $('contextHeader').click();
    type('locationInput', '');
    $('contextHeader').click(); // try to collapse
    expect(open()).toBe(true);
    type('locationInput', 'Gym');
    $('contextHeader').click();
    expect(open()).toBe(false);
  });
});

describe('typing an outcome', () => {
  const newChips = () => [...document.querySelectorAll<HTMLElement>('#newOutcomeChips .chip')];

  it('starts empty and shows recent outcomes, the previous one highlighted', async () => {
    await start([attempt({ outcome: 'fell' })]);
    $('newAttemptBtn').click();
    expect($<HTMLInputElement>('outcomeInput').value).toBe('');
    expect(texts('#outcomeChips .chip')).toEqual(['fell', 'flash', 'learning']);
    expect(q('#outcomeChips .chip').classList.contains('current')).toBe(true);
  });

  it('hides the outcome row while typed text matches no outcome', async () => {
    await start([attempt()]);
    $('newAttemptBtn').click();
    const shown = (id: string) => getComputedStyle($(id)).display !== 'none';
    expect(shown('outcomeChips')).toBe(true);
    type('outcomeInput', 'zzz');
    expect([shown('outcomeChips'), shown('newOutcomeChips')]).toEqual([false, true]);
    type('outcomeInput', '');
    expect([shown('outcomeChips'), shown('newOutcomeChips')]).toEqual([true, false]);
  });

  it('shows only matching outcomes while typing, no backfill', async () => {
    await start([attempt()]);
    $('newAttemptBtn').click();
    type('outcomeInput', 'le');
    expect(texts('#outcomeChips .chip')).toEqual(['learning']);
    type('outcomeInput', ' FLASH ');
    // an exact match: just its chip, no new-outcome chips
    expect(texts('#outcomeChips .chip')).toEqual(['flash']);
    expect(newChips()).toHaveLength(0);
    clickChip('outcomeChips', 'flash');
    expect(stored()[1].outcome).toBe('flash');
    expect(storedOutcomes()).toEqual(OUTCOMES);
  });

  it('offers one chip per category for a new name, in a row of its own below', async () => {
    await start([attempt()]);
    $('newAttemptBtn').click();
    const newRowVisible = () => getComputedStyle($('newOutcomeChips')).display !== 'none';
    expect(newRowVisible()).toBe(false);
    type('outcomeInput', 'fl');
    expect(texts('#outcomeChips .chip')).toEqual(['flash']);
    expect(texts('#newOutcomeChips .chip')).toEqual(['🟢 fl', '🔴 fl', '⚪ fl']);
    expect(newRowVisible()).toBe(true);
    type('outcomeInput', '  Fell At Crux ');
    expect(texts('#outcomeChips .chip')).toEqual([]);
    expect(texts('#newOutcomeChips .chip')).toEqual([
      '🟢 fell at crux',
      '🔴 fell at crux',
      '⚪ fell at crux',
    ]);
    expect(newChips().map((c) => c.className)).toEqual([
      'chip success new-outcome',
      'chip failure new-outcome',
      'chip work new-outcome',
    ]);
  });

  it('a new-outcome chip registers the outcome (normalised) and logs the attempt', async () => {
    await start([attempt()]);
    $('newAttemptBtn').click();
    type('outcomeInput', '  Fell At Crux ');
    newChips()[1].click();
    expect(storedOutcomes()).toContainEqual({ name: 'fell at crux', category: 'failure' });
    expect(stored()[1]).toMatchObject({ outcome: 'fell at crux', location: 'BW Ost' });
    expect($('attemptSheet').classList.contains('active')).toBe(false);
    expect(q('.attempt-status-badge').className).toContain('attempt-status-failure');
  });

  it('clears the typed text when the sheet opens again', async () => {
    await start([attempt()]);
    $('newAttemptBtn').click();
    type('outcomeInput', 'xyz');
    $('closeAttemptSheetBtn').click();
    $('newAttemptBtn').click();
    expect($<HTMLInputElement>('outcomeInput').value).toBe('');
    expect(newChips()).toHaveLength(0);
  });
});

describe('layout', () => {
  it('opens sheets from the top; chip rows are one line that scrolls sideways', async () => {
    await start([attempt()]);
    $('newAttemptBtn').click();
    expect(getComputedStyle($('attemptSheet')).alignItems).toBe('flex-start');
    for (const id of ['locationChips', 'chips-grade', 'outcomeChips']) {
      const row = getComputedStyle($(id));
      expect([id, row.flexWrap, row.overflowX]).toEqual([id, 'nowrap', 'auto']);
    }
    // the context bar uses the history's chevron: right when collapsed, down when open
    const chevron = () => getComputedStyle(q('#contextHeader .group-chevron')).transform;
    $('contextHeader').click();
    const first = chevron();
    $('contextHeader').click();
    expect([first, chevron()].sort()).toEqual(['none', 'rotate(-90deg)']);
    // even spacing: the form and the activity fields both separate sections by 20px
    expect(getComputedStyle($('attemptForm')).rowGap).toBe('20px');
    expect(getComputedStyle($('activityFields')).rowGap).toBe('20px');
    // field chips have a minimum tap size; the highlight is drawn inside the chip
    const chip = getComputedStyle(q('#chips-grade .chip-small'));
    expect([chip.minWidth, chip.minHeight]).toEqual(['64px', '48px']);
    const outcomeChip = getComputedStyle(q('#outcomeChips .chip'));
    expect([outcomeChip.minWidth, outcomeChip.minHeight]).toEqual(['64px', '48px']);
    // all chips are the same pill shape and text size
    const shape = (c: CSSStyleDeclaration) => [c.borderTopLeftRadius, c.fontSize];
    expect(shape(outcomeChip)).toEqual(shape(chip));
    const current = getComputedStyle(q('#chips-grade .chip-small.current'));
    expect(current.outlineOffset).toBe('-2px');
    expect(getComputedStyle(q('#outcomeChips .chip.current')).outlineOffset).toBe('-2px');
    // every sheet opens from the top, the backup menu too
    expect(getComputedStyle($('menuSheet')).alignItems).toBe('flex-start');
  });
});

describe('keyboard', () => {
  it('"Done" closes the keyboard in every input, without saving', async () => {
    await start([attempt({ activity: 'kilter', angle: '40' })]);
    $('newAttemptBtn').click();
    for (const id of ['locationInput', 'field-angle', 'field-grade', 'outcomeInput']) {
      const input = $<HTMLInputElement>(id);
      expect(input.enterKeyHint).toBe('done');
      input.focus();
      expect(document.activeElement).toBe(input);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
      expect(document.activeElement).not.toBe(input);
    }
    expect(stored()).toHaveLength(1);
    expect($('attemptSheet').classList.contains('active')).toBe(true);
  });
});

describe('editing and deleting', () => {
  const data = () => [
    attempt({ id: 'a1', activity: 'kilter', angle: '40', grade: 'v3' }),
    attempt({ id: 'a2', loggedAt: '2026-11-14T13:00:00Z', grade: 'v4' }),
  ];

  /** Expands every group (collapsed ones build no cards), then taps the attempt's Edit. */
  const edit = (id: string) => {
    expandAll();
    q(`[data-attempt-id="${id}"] .edit-btn`).click();
  };

  it('opens the attempt for editing', async () => {
    await start(data());
    edit('a1');
    expect($('attemptSheetTitle').textContent).toBe('Edit Attempt');
    expect($('deleteBtn').style.display).toBe('block');
    expect($<HTMLInputElement>('field-grade').value).toBe('v3');
    expect($<HTMLInputElement>('field-angle').value).toBe('40');
    expect($('contextBody').classList.contains('hidden')).toBe(true);
    // suggestions exclude the attempt being edited
    expect(texts('#chips-grade .chip-small')).toEqual(['v4']);
  });

  it('updates the attempt in place, keeping id and time', async () => {
    await start(data());
    edit('a1');
    type('field-grade', 'v6');
    type('field-angle', '45');
    clickChip('outcomeChips', 'fell');
    expect(stored()).toHaveLength(2);
    expect(stored()[0]).toEqual({
      id: 'a1',
      loggedAt: '2026-11-14T12:00:00.000Z',
      activity: 'kilter',
      location: 'BW Ost',
      grade: 'v6',
      outcome: 'fell',
      angle: '45',
    });
  });

  it('drops the board angle when the activity changes, keeping the shared grade', async () => {
    await start(data());
    edit('a1');
    q('.activity-tab[data-activity="route"]').click();
    expect($<HTMLInputElement>('field-grade').value).toBe('v3');
    clickChip('outcomeChips', 'flash');
    expect(stored()[0]).toMatchObject({ activity: 'route', grade: 'v3' });
    expect(stored()[0]).not.toHaveProperty('angle');
  });

  it('keeps a defined field the activity does not list, without showing it', async () => {
    await start([attempt({ id: 'b', angle: '30' })]); // boulder doesn't list angle
    expect(texts('.field-badge')).toEqual(['v4']);
    edit('b');
    expect(document.getElementById('field-angle')).toBeNull();
    clickChip('outcomeChips', 'fell');
    expect(stored()[0]).toMatchObject({ outcome: 'fell', angle: '30' });
  });

  it('highlights the edited attempt’s outcome', async () => {
    await start([attempt({ id: 'a1', outcome: 'fell' }), attempt({ id: 'a2', outcome: 'flash' })]);
    edit('a1');
    const chip = (t: string) =>
      [...$('outcomeChips').children].find((c) => c.textContent === t) as HTMLElement;
    expect(chip('fell').classList.contains('current')).toBe(true);
    expect(chip('flash').classList.contains('current')).toBe(false);
  });

  it('deletes only on the second tap', async () => {
    await start(data());
    edit('a2');
    $('deleteBtn').click();
    expect($('deleteBtn').textContent).toBe('Tap again to delete');
    expect(stored()).toHaveLength(2);
    $('deleteBtn').click();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(stored().map((a) => a.id)).toEqual(['a1']);
    expect($('attemptSheet').classList.contains('active')).toBe(false);
  });

  it('resets the delete button when the sheet closes', async () => {
    await start(data());
    edit('a2');
    $('deleteBtn').click();
    $('closeAttemptSheetBtn').click();
    edit('a2');
    expect($('deleteBtn').textContent).toBe('Delete');
    $('deleteBtn').click();
    expect(stored()).toHaveLength(2);
  });

  it('a new attempt after cancelling an edit is added, not an edit', async () => {
    await start(data());
    edit('a1');
    $('closeAttemptSheetBtn').click();
    $('newAttemptBtn').click();
    clickChip('outcomeChips', 'flash');
    expect(stored()).toHaveLength(3);
  });
});
