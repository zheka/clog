// @vitest-environment jsdom
/**
 * Characterization tests for the whole app: load index.html + main.ts in jsdom and drive the UI.
 * They pin down current behaviour so refactors can't change it unnoticed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../index.html?raw';
import styleCss from './style.css?raw';

const STORAGE_KEY = 'clog';
const LEGACY_KEYS = ['climb_attempts_history', 'climb_outcomes_registry'];
const NOW = new Date('2026-11-15T12:00:00Z');

type Raw = Record<string, unknown>;

/** querySelector that fails the test if nothing matches. */
function q<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`No element matches ${sel}`);
  return el;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const texts = (sel: string) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim());
const storedData = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
const stored = (): Raw[] => storedData().attempts ?? [];
const storedOutcomes = (): Raw[] => storedData().outcomes ?? [];

function type(id: string, value: string) {
  const el = $<HTMLInputElement>(id);
  el.value = value;
  el.dispatchEvent(new Event('input'));
}

function clickChip(containerId: string, text: string) {
  const chip = [...$(containerId).children].find((c) => c.textContent === text) as HTMLElement;
  expect(chip, `chip "${text}" in #${containerId}`).toBeTruthy();
  chip.click();
}

function attempt(overrides: Raw = {}): Raw {
  return {
    id: 'a1',
    loggedAt: '2026-11-14T12:00:00.000Z',
    activity: 'boulder',
    location: 'BW Ost',
    grade: 'v4',
    outcome: 'flash',
    ...overrides,
  };
}

const OUTCOMES = [
  { name: 'flash', category: 'success' },
  { name: 'fell', category: 'failure' },
  { name: 'learning', category: 'work' },
];

let alertMock: ReturnType<typeof vi.fn>;
let confirmMock: ReturnType<typeof vi.fn>;

/**
 * Loads the app with saved data. `start(undefined, null)` = nothing saved (a fresh install).
 * `raw` items are written to localStorage as they are, before the saved data.
 */
async function start(
  attempts?: unknown[],
  outcomes: unknown[] | null = OUTCOMES,
  raw: Record<string, string> = {},
) {
  document.body.innerHTML = new DOMParser().parseFromString(indexHtml, 'text/html').body.innerHTML;
  // Apply the real stylesheet, so tests can check what is actually visible.
  document.head.innerHTML = `<style>${styleCss}</style>`;
  localStorage.clear();
  for (const [key, value] of Object.entries(raw)) localStorage.setItem(key, value);
  if (attempts !== undefined || outcomes !== null) {
    const data = { version: 'clog 0.1.0', outcomes: outcomes ?? [], attempts: attempts ?? [] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  vi.resetModules();
  await import('./main');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  alertMock = vi.fn();
  confirmMock = vi.fn(() => true);
  vi.stubGlobal('alert', alertMock);
  vi.stubGlobal('confirm', confirmMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

  it('groups consecutive entries by activity, location and day, newest first', async () => {
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
      `A • boulder • ${day('2026-11-15T12:00:00Z')}`,
    );
    expect(q('.group-header', groups[1]).textContent).toContain('B • route');
    expect([...groups[2].querySelectorAll('.grade-badge')].map((e) => e.textContent)).toEqual([
      'v2',
      'v1',
    ]);
    // only the newest group starts expanded; header click toggles
    expect(groups.map((g) => g.classList.contains('collapsed'))).toEqual([false, true, true]);
    q('.group-header', groups[1]).click();
    expect(groups[1].classList.contains('collapsed')).toBe(false);
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
    const badge = (id: string) => q(`[data-entry-id="${id}"] .entry-status-badge`).className;
    expect(badge('s')).toContain('entry-status-green');
    expect(badge('f')).toContain('entry-status-red');
    expect(badge('k')).toContain('entry-status-gray');
    // every field the activity lists, as a badge in config order; no tags
    expect(texts('[data-entry-id="kb"] .grade-badge')).toEqual(['40', 'v4']);
    expect(document.querySelector('.detail-tag')).toBeNull();
    const time = new Date('2026-11-14T12:00:00Z').toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    expect(q('[data-entry-id="s"] .entry-time').textContent).toBe(time);
  });

  it('escapes HTML in user text', async () => {
    await start([attempt({ grade: '<b>v4</b>' })]);
    expect(q('.grade-badge').innerHTML).toBe('&lt;b&gt;v4&lt;/b&gt;');
  });
});

describe('new entry modal', () => {
  it('prefills from the last entry and collapses context within 4 hours', async () => {
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
    $('openModalBtn').click();
    expect($('modalOverlay').classList.contains('active')).toBe(true);
    expect($('modalTitle').textContent).toBe('New Entry');
    expect($('deleteBtn').style.display).toBe('none');
    expect($<HTMLInputElement>('locationInput').value).toBe('BW Ost');
    expect($<HTMLInputElement>('field-grade').value).toBe('v5');
    expect($<HTMLInputElement>('field-angle').value).toBe('40');
    expect(texts('#activityFields label')).toEqual(['angle', 'grade']);
    expect(q('.activity-tab.active').getAttribute('data-activity')).toBe('kilter');
    expect($('contextBody').classList.contains('hidden')).toBe(true);
    expect($('contextToggleLink').textContent).toBe('Change');
    expect($('contextSummaryText').textContent).toBe('BW Ost • kilter');
  });

  it('expands context when the last entry is older than 4 hours, or with no history', async () => {
    await start([attempt({ loggedAt: '2026-11-15T08:01:00Z' })]);
    $('openModalBtn').click();
    expect($('contextBody').classList.contains('hidden')).toBe(true); // 3h59m: same session

    await start([attempt({ loggedAt: '2026-11-15T07:59:00Z' })]);
    $('openModalBtn').click();
    expect($('contextBody').classList.contains('hidden')).toBe(false);
    expect($('contextToggleLink').textContent).toBe('Hide');

    await start(undefined);
    $('openModalBtn').click();
    expect($('contextBody').classList.contains('hidden')).toBe(false);
    expect($<HTMLInputElement>('locationInput').value).toBe('');
    expect($('contextSummaryText').textContent).toBe('Unknown Location • boulder');
  });

  it('shows one tab per configured activity, and the fields of the selected activity', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    expect(texts('.activity-tab')).toEqual(['boulder', 'route', 'kilter']);
    expect(q('.activity-tab.active').dataset.activity).toBe('boulder');
    expect(texts('#activityFields label')).toEqual(['grade']);
    q('.activity-tab[data-activity="kilter"]').click();
    expect(texts('#activityFields label')).toEqual(['angle', 'grade']);
  });

  it('toggles the context section and updates its summary while typing', async () => {
    await start([attempt({ loggedAt: '2026-11-15T11:30:00Z' })]);
    $('openModalBtn').click();
    $('contextHeader').click();
    expect($('contextBody').classList.contains('hidden')).toBe(false);
    expect($('contextToggleLink').textContent).toBe('Hide');
    type('locationInput', 'New Gym');
    expect($('contextSummaryText').textContent).toBe('New Gym • boulder');
    q('[data-activity="route"]', $('contextBody')).click();
    expect($('contextSummaryText').textContent).toBe('New Gym • route');
  });

  it('closes via the close button and the overlay without saving', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    $('closeModalBtn').click();
    expect($('modalOverlay').classList.contains('active')).toBe(false);
    $('openModalBtn').click();
    $('modalOverlay').click();
    expect($('modalOverlay').classList.contains('active')).toBe(false);
    expect(stored()).toHaveLength(1);
  });

  it('suggests up to 8 recent distinct locations; matches first, then backfill', async () => {
    const names = ['Gym1', 'Gym2', 'gym2', 'Gym3', 'Gym4', 'Gym5', 'Gym6', 'Gym7', 'Gym8', 'Gym9'];
    await start(
      names.map((location, i) =>
        attempt({ id: `a${i}`, location, loggedAt: `2026-11-1${i}T12:00:00Z` }),
      ),
    );
    $('openModalBtn').click();
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
    expect($('contextSummaryText').textContent).toBe('Gym1 • boulder');
  });

  it('suggests grades: this gym first, then the same activity elsewhere, then any activity', async () => {
    await start([
      attempt({ id: 'r', activity: 'route', location: 'TK', grade: '7-' }),
      attempt({ id: 's', location: 'Seoul', grade: '8', loggedAt: '2026-11-14T12:01:00Z' }),
      attempt({ id: 'b', location: 'BW Ost', grade: '6', loggedAt: '2026-11-14T12:02:00Z' }),
    ]);
    $('openModalBtn').click();
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
    $('openModalBtn').click();
    expect(texts('#chips-angle .chip-small')).toEqual(['40', '45']);
    clickChip('chips-angle', '45');
    expect($<HTMLInputElement>('field-angle').value).toBe('45');
  });

  it('switching activity loads that activity’s previous attempt', async () => {
    await start([
      attempt({ id: 'k', activity: 'kilter', location: 'Home', angle: '40', grade: 'v5' }),
      attempt({ id: 'b', location: 'BW Ost', grade: '6', loggedAt: '2026-11-14T12:01:00Z' }),
    ]);
    $('openModalBtn').click();
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
    $('openModalBtn').click();
    expect(texts('#outcomeChips .chip')).toEqual(['e', 'c', 'a', 'b', 'd', 'f', 'g', 'h']);
    const chips = [...$('outcomeChips').children] as HTMLElement[];
    expect(chips[0].className).toBe('chip success');
    // the last used outcome is highlighted
    expect(chips[0].style.outline).not.toBe('');
    expect(chips[1].style.outline).toBe('');
  });

  it('shows no outcome chips on a fresh install (empty registry)', async () => {
    await start(undefined, null);
    $('openModalBtn').click();
    expect($('outcomeChips').children).toHaveLength(0);
  });
});

describe('logging attempts', () => {
  it('logs a new attempt when an outcome chip is clicked', async () => {
    await start([attempt({ activity: 'kilter', angle: '40' })]);
    $('openModalBtn').click();
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
    expect($('modalOverlay').classList.contains('active')).toBe(false);
    expect(document.querySelectorAll('.entry-card')).toHaveLength(2);
  });

  it('cleans typed text but keeps its case', async () => {
    await start([attempt({ location: 'BW Ost', grade: 'V4' })]);
    $('openModalBtn').click();
    type('locationInput', '  bw   ost ');
    type('field-grade', 'v4');
    clickChip('outcomeChips', 'flash');
    expect(stored()[1]).toMatchObject({ location: 'bw ost', grade: 'v4' });
  });

  it('requires location and every activity field', async () => {
    await start([attempt({ activity: 'kilter', angle: '40' })]);
    $('openModalBtn').click();
    type('field-angle', '');
    type('locationInput', '   ');
    clickChip('outcomeChips', 'flash');
    expect(alertMock).toHaveBeenCalledWith(
      'Please fill in location, angle before selecting an outcome.',
    );
    expect(stored()).toHaveLength(1);
    expect($('modalOverlay').classList.contains('active')).toBe(true);
  });
});

describe('typing an outcome', () => {
  const newChips = () => [...document.querySelectorAll<HTMLElement>('#outcomeChips .new-outcome')];

  it('starts empty and shows recent outcomes, the previous one highlighted', async () => {
    await start([attempt({ outcome: 'fell' })]);
    $('openModalBtn').click();
    expect($<HTMLInputElement>('outcomeInput').value).toBe('');
    expect(texts('#outcomeChips .chip')).toEqual(['fell', 'flash', 'learning']);
    expect(q('#outcomeChips .chip').style.outline).not.toBe('');
  });

  it('shows only matching outcomes while typing, no backfill', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    type('outcomeInput', 'le');
    expect(texts('#outcomeChips .chip:not(.new-outcome)')).toEqual(['learning']);
    type('outcomeInput', ' FLASH ');
    // an exact match: just its chip, no new-outcome chips
    expect(texts('#outcomeChips .chip')).toEqual(['flash']);
    clickChip('outcomeChips', 'flash');
    expect(stored()[1].outcome).toBe('flash');
    expect(storedOutcomes()).toEqual(OUTCOMES);
  });

  it('offers one chip per category for a new name, after the matches', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    type('outcomeInput', 'fl');
    expect(texts('#outcomeChips .chip')).toEqual(['flash', '🟢 fl', '🔴 fl', '⚪ fl']);
    type('outcomeInput', '  Fell At Crux ');
    expect(texts('#outcomeChips .chip')).toEqual([
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
    $('openModalBtn').click();
    type('outcomeInput', '  Fell At Crux ');
    newChips()[1].click();
    expect(storedOutcomes()).toContainEqual({ name: 'fell at crux', category: 'failure' });
    expect(stored()[1]).toMatchObject({ outcome: 'fell at crux', location: 'BW Ost' });
    expect($('modalOverlay').classList.contains('active')).toBe(false);
    expect(q('.entry-status-badge').className).toContain('entry-status-red');
  });

  it('keeps expanded history groups when registering an outcome fails to log', async () => {
    await start([attempt({ id: 'old', location: 'Old Gym' }), attempt({ id: 'new' })]);
    const oldGroup = () => q('[data-entry-id="old"]').closest('.group-container')!;
    q('.group-header', oldGroup()).click();
    expect(oldGroup().classList.contains('collapsed')).toBe(false);

    $('openModalBtn').click();
    type('field-grade', '');
    type('outcomeInput', 'new one');
    newChips()[0].click();

    expect(alertMock).toHaveBeenCalledWith('Please fill in grade before selecting an outcome.');
    expect(storedOutcomes()).toContainEqual({ name: 'new one', category: 'success' });
    // registered, so it is now an ordinary chip
    expect(texts('#outcomeChips .chip')).toEqual(['new one']);
    expect(oldGroup().classList.contains('collapsed')).toBe(false);
  });

  it('clears the typed text when the sheet opens again', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    type('outcomeInput', 'xyz');
    $('closeModalBtn').click();
    $('openModalBtn').click();
    expect($<HTMLInputElement>('outcomeInput').value).toBe('');
    expect(newChips()).toHaveLength(0);
  });
});

describe('layout', () => {
  it('opens the entry sheet from the top; chip rows are one line that scrolls sideways', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    expect(getComputedStyle($('modalOverlay')).alignItems).toBe('flex-start');
    for (const id of ['locationChips', 'chips-grade', 'outcomeChips']) {
      const row = getComputedStyle($(id));
      expect([id, row.flexWrap, row.overflowX]).toEqual([id, 'nowrap', 'auto']);
    }
    // the backup menu still opens from the bottom
    expect(getComputedStyle($('menuModalOverlay')).alignItems).toBe('flex-end');
  });
});

describe('keyboard', () => {
  it('"Done" closes the keyboard in every input, without saving', async () => {
    await start([attempt({ activity: 'kilter', angle: '40' })]);
    $('openModalBtn').click();
    for (const id of ['locationInput', 'field-angle', 'field-grade', 'outcomeInput']) {
      const input = $<HTMLInputElement>(id);
      expect(input.enterKeyHint).toBe('done');
      input.focus();
      expect(document.activeElement).toBe(input);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
      expect(document.activeElement).not.toBe(input);
    }
    expect(stored()).toHaveLength(1);
    expect($('modalOverlay').classList.contains('active')).toBe(true);
  });
});

describe('editing and deleting', () => {
  const data = () => [
    attempt({ id: 'a1', activity: 'kilter', angle: '40', grade: 'v3' }),
    attempt({ id: 'a2', loggedAt: '2026-11-14T13:00:00Z', grade: 'v4' }),
  ];

  const edit = (id: string) => q(`[data-entry-id="${id}"] .edit-btn`).click();

  it('opens the entry for editing', async () => {
    await start(data());
    edit('a1');
    expect($('modalTitle').textContent).toBe('Edit Entry');
    expect($('deleteBtn').style.display).toBe('block');
    expect($<HTMLInputElement>('field-grade').value).toBe('v3');
    expect($<HTMLInputElement>('field-angle').value).toBe('40');
    expect($('contextBody').classList.contains('hidden')).toBe(true);
    // suggestions exclude the entry being edited
    expect(texts('#chips-grade .chip-small')).toEqual(['v4']);
  });

  it('updates the entry in place, keeping id and time', async () => {
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
    expect(texts('.grade-badge')).toEqual(['v4']);
    edit('b');
    expect(document.getElementById('field-angle')).toBeNull();
    clickChip('outcomeChips', 'fell');
    expect(stored()[0]).toMatchObject({ outcome: 'fell', angle: '30' });
  });

  it('highlights the edited entry’s outcome', async () => {
    await start([attempt({ id: 'a1', outcome: 'fell' }), attempt({ id: 'a2', outcome: 'flash' })]);
    edit('a1');
    const chip = (t: string) =>
      [...$('outcomeChips').children].find((c) => c.textContent === t) as HTMLElement;
    expect(chip('fell').style.outline).not.toBe('');
    expect(chip('flash').style.outline).toBe('');
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
    expect($('modalOverlay').classList.contains('active')).toBe(false);
  });

  it('resets the delete button when the sheet closes', async () => {
    await start(data());
    edit('a2');
    $('deleteBtn').click();
    $('closeModalBtn').click();
    edit('a2');
    expect($('deleteBtn').textContent).toBe('Delete Entry');
    $('deleteBtn').click();
    expect(stored()).toHaveLength(2);
  });

  it('a new entry after cancelling an edit is added, not an edit', async () => {
    await start(data());
    edit('a1');
    $('closeModalBtn').click();
    $('openModalBtn').click();
    clickChip('outcomeChips', 'flash');
    expect(stored()).toHaveLength(3);
  });
});

describe('backup menu', () => {
  it('opens and closes', async () => {
    await start([attempt()]);
    $('openMenuBtn').click();
    expect($('menuModalOverlay').classList.contains('active')).toBe(true);
    $('closeMenuModalBtn').click();
    expect($('menuModalOverlay').classList.contains('active')).toBe(false);
    $('openMenuBtn').click();
    $('menuModalOverlay').click();
    expect($('menuModalOverlay').classList.contains('active')).toBe(false);
  });

  describe('export', () => {
    let blob: Blob | undefined;
    let downloadName: string | undefined;

    beforeEach(() => {
      blob = undefined;
      downloadName = undefined;
      URL.createObjectURL = vi.fn((b: Blob) => {
        blob = b;
        return 'blob:test';
      });
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloadName = this.getAttribute('download') ?? undefined;
      });
    });

    it('alerts when there is nothing to export', async () => {
      await start(undefined);
      $('openMenuBtn').click();
      $('exportJsonBtn').click();
      expect(alertMock).toHaveBeenCalledWith('No attempts to export.');
      expect(blob).toBeUndefined();
      expect($('menuModalOverlay').classList.contains('active')).toBe(true);
    });

    it('downloads a clog 0.1.0 backup and closes the menu', async () => {
      const outcomes = [
        { name: 'zz', category: 'work' },
        { name: 'aa', category: 'success' },
      ];
      const kilter = attempt({
        id: 'k',
        activity: 'kilter',
        angle: '40',
        loggedAt: '2026-11-14T13:00:00Z',
        outcome: 'aa',
      });
      await start([attempt({ outcome: 'zz' }), kilter], outcomes);
      $('openMenuBtn').click();
      $('exportJsonBtn').click();
      expect(downloadName).toBe('clog_backup_2026-11-15.json');
      expect(blob!.type).toBe('application/json;charset=utf-8;');
      expect(JSON.parse(await blob!.text())).toEqual({
        version: 'clog 0.1.0',
        exportedAt: NOW.toISOString(),
        outcomes: [outcomes[1], outcomes[0]],
        attempts: [attempt({ outcome: 'zz' }), kilter],
      });
      expect($('menuModalOverlay').classList.contains('active')).toBe(false);
    });
  });

  describe('import', () => {
    function importFile(content: string) {
      const input = $<HTMLInputElement>('importFileInput');
      Object.defineProperty(input, 'files', {
        value: [new File([content], 'backup.json')],
        configurable: true,
      });
      input.dispatchEvent(new Event('change'));
    }

    const backup = {
      version: 'clog 0.1.0',
      exportedAt: '2026-11-16T09:00:00.000Z',
      outcomes: [{ name: 'send', category: 'success' }],
      attempts: [
        attempt({ id: 'b2', loggedAt: '2026-11-10T13:00:00Z', outcome: 'send' }),
        attempt({ id: 'b1', loggedAt: '2026-11-10T12:00:00Z', outcome: 'send' }),
      ],
    };
    const legacy = { climb_attempts_history: '[]', climb_outcomes_registry: '[]' };

    it('replaces existing data after confirmation, then removes the legacy keys', async () => {
      await start([attempt()], OUTCOMES, legacy);
      $('openMenuBtn').click();
      importFile(JSON.stringify(backup));
      await vi.waitFor(() =>
        expect(alertMock).toHaveBeenCalledWith('Successfully imported 2 attempts.'),
      );
      expect(confirmMock).toHaveBeenCalledWith(
        'Importing this backup will completely REPLACE your existing 1 local entries with the 2 entries from the file.\n\nProceed?',
      );
      expect(storedData().version).toBe('clog 0.1.0');
      expect(stored().map((a) => a.id)).toEqual(['b1', 'b2']);
      expect(storedOutcomes()).toEqual(backup.outcomes);
      expect(document.querySelectorAll('.entry-card')).toHaveLength(2);
      expect(q('.entry-status-badge').className).toContain('entry-status-green');
      expect($('menuModalOverlay').classList.contains('active')).toBe(false);
      for (const key of LEGACY_KEYS) expect(localStorage.getItem(key)).toBeNull();
    });

    it('keeps data and legacy keys when the user cancels', async () => {
      confirmMock.mockReturnValue(false);
      await start([attempt()], OUTCOMES, legacy);
      importFile(JSON.stringify(backup));
      await vi.waitFor(() => expect(confirmMock).toHaveBeenCalled());
      expect(stored().map((a) => a.id)).toEqual(['a1']);
      expect(storedOutcomes()).toEqual(OUTCOMES);
      expect(alertMock).not.toHaveBeenCalled();
      for (const key of LEGACY_KEYS) expect(localStorage.getItem(key)).toBe('[]');
    });

    it('does not ask when there is no local data', async () => {
      await start(undefined, null);
      importFile(JSON.stringify(backup));
      await vi.waitFor(() => expect(alertMock).toHaveBeenCalled());
      expect(confirmMock).not.toHaveBeenCalled();
      expect(stored()).toHaveLength(2);
    });

    it('refuses files with problems, listing them, and keeps everything', async () => {
      await start([attempt()], OUTCOMES, legacy);
      const broken = {
        ...backup,
        attempts: [attempt({ id: 'x', outcome: 'sent', activity: 'ice' })],
      };
      importFile(JSON.stringify(broken));
      await vi.waitFor(() => expect(alertMock).toHaveBeenCalled());
      expect(alertMock.mock.calls[0][0]).toBe(
        'Failed to import JSON file: Import refused: 2 problems\n' +
          '  attempt #1 (id x…): unknown activity "ice"\n' +
          '  attempt #1 (id x…): outcome "sent" is not defined',
      );
      expect(stored().map((a) => a.id)).toEqual(['a1']);
      for (const key of LEGACY_KEYS) expect(localStorage.getItem(key)).toBe('[]');
    });

    it('refuses old-format backups', async () => {
      await start([attempt()]);
      importFile(JSON.stringify({ ...backup, version: '1.2.0' }));
      await vi.waitFor(() => expect(alertMock).toHaveBeenCalled());
      expect(alertMock.mock.calls[0][0]).toMatch(/version "1\.2\.0" is not a clog backup version/);
      expect(stored().map((a) => a.id)).toEqual(['a1']);
    });

    it('rejects files without attempts', async () => {
      await start([attempt()]);
      importFile(JSON.stringify({ ...backup, attempts: [] }));
      await vi.waitFor(() =>
        expect(alertMock).toHaveBeenCalledWith(
          'No valid climbing attempts found in the selected file.',
        ),
      );
      expect(stored().map((a) => a.id)).toEqual(['a1']);
    });

    it('reports invalid JSON', async () => {
      await start([attempt()]);
      importFile('not json');
      await vi.waitFor(() => expect(alertMock).toHaveBeenCalled());
      expect(alertMock.mock.calls[0][0]).toMatch(/^Failed to import JSON file: /);
      expect(stored().map((a) => a.id)).toEqual(['a1']);
    });
  });
});

describe('saved data that cannot be used', () => {
  const valid = { version: 'clog 0.1.0', outcomes: OUTCOMES, attempts: [attempt()] };
  const problemsShown = () => $('problemList').textContent;
  const inProblemMode = () =>
    !$('problemScreen').hidden && document.body.classList.contains('problem-mode');

  afterEach(() => document.body.classList.remove('problem-mode'));

  it('shows the problem screen instead of the app', async () => {
    await start(undefined, null, {
      clog: JSON.stringify({ ...valid, attempts: [attempt({ activity: 'kilterboard' })] }),
    });
    expect(inProblemMode()).toBe(true);
    expect(problemsShown()).toBe('attempt #1 (id a1…): unknown activity "kilterboard"');
    // the app is not running: its buttons do nothing
    $('openModalBtn').click();
    expect($('modalOverlay').classList.contains('active')).toBe(false);
    expect(document.querySelectorAll('.entry-card')).toHaveLength(0);
  });

  it('lists every kind of problem: invalid JSON, old version, unknown outcome', async () => {
    await start(undefined, null, { clog: '{oops' });
    expect(problemsShown()).toMatch(/^not valid JSON/);
    await start(undefined, null, { clog: JSON.stringify({ ...valid, version: '1.2.0' }) });
    expect(problemsShown()).toMatch(/^version "1\.2\.0" is not a clog backup version/);
    await start(undefined, null, {
      clog: JSON.stringify({ ...valid, attempts: [attempt({ outcome: 'mystery' })] }),
    });
    expect(problemsShown()).toBe('attempt #1 (id a1…): outcome "mystery" is not defined');
  });

  const visible = (id: string) => getComputedStyle($(id)).display !== 'none';

  it('is not visible for valid or missing data, and the app is', async () => {
    await start([attempt()]);
    expect(visible('problemScreen')).toBe(false);
    expect(visible('mainContent')).toBe(true);
    await start(undefined, null);
    expect(visible('problemScreen')).toBe(false);
  });

  it('is the only thing visible when the data cannot be used, until starting fresh', async () => {
    await start(undefined, null, { clog: '{oops' });
    expect(visible('problemScreen')).toBe(true);
    expect(visible('mainContent')).toBe(false);
    expect(visible('openModalBtn')).toBe(false);
    $('startFreshBtn').click();
    $('startFreshBtn').click();
    expect(visible('problemScreen')).toBe(false);
    expect(visible('mainContent')).toBe(true);
  });

  it('downloads the saved data unchanged and keeps it', async () => {
    const raw = '{oops';
    let blob: Blob | undefined;
    let name: string | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      name = this.getAttribute('download') ?? undefined;
    });
    await start(undefined, null, { clog: raw });
    $('downloadSavedDataBtn').click();
    expect(name).toBe('clog_saved_data_2026-11-15.json');
    expect(await blob!.text()).toBe(raw);
    expect(localStorage.getItem('clog')).toBe(raw);
    expect(inProblemMode()).toBe(true);
  });

  it('starts fresh only on the second tap, then works normally', async () => {
    await start(undefined, null, { clog: '{oops' });
    const button = $('startFreshBtn');
    button.click();
    expect(button.textContent).toBe('Tap again to delete saved data');
    expect(localStorage.getItem('clog')).toBe('{oops');
    expect(inProblemMode()).toBe(true);

    button.click();
    expect(inProblemMode()).toBe(false);
    expect(localStorage.getItem('clog')).toBeNull();
    expect($('historyList').textContent).toContain('No attempts logged yet.');

    // logging works again
    $('openModalBtn').click();
    type('locationInput', 'Gym');
    type('field-grade', '6a');
    type('outcomeInput', 'flash');
    q('#outcomeChips .new-outcome').click();
    expect(stored()).toHaveLength(1);
  });
});
