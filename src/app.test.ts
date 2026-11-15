// @vitest-environment jsdom
/**
 * Characterization tests for the whole app: load index.html + main.ts in jsdom and drive the UI.
 * They pin down CURRENT behaviour (quirks included) so refactors can't change it unnoticed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../index.html?raw';

const HISTORY_KEY = 'climb_attempts_history';
const OUTCOMES_KEY = 'climb_outcomes_registry';
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
const stored = (): Raw[] => JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
const storedOutcomes = (): Raw[] => JSON.parse(localStorage.getItem(OUTCOMES_KEY) ?? '[]');

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
    kind: 'bouldering',
    location: 'BW Ost',
    grade: 'v4',
    outcome: 'flash',
    ...overrides,
  };
}

const OUTCOMES = [
  { name: 'flash', category: 'success' },
  { name: 'fell', category: 'failure' },
  { name: 'skipped', category: 'skip' },
];

let alertMock: ReturnType<typeof vi.fn>;
let confirmMock: ReturnType<typeof vi.fn>;

/** `null` = leave that localStorage key unset (a fresh install). */
async function start(attempts?: unknown, outcomes: unknown = OUTCOMES) {
  document.body.innerHTML = new DOMParser().parseFromString(indexHtml, 'text/html').body.innerHTML;
  localStorage.clear();
  if (attempts !== undefined) localStorage.setItem(HISTORY_KEY, JSON.stringify(attempts));
  if (outcomes !== null) localStorage.setItem(OUTCOMES_KEY, JSON.stringify(outcomes));
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

  it('normalizes legacy stored data (timestamp, missing kind/id)', async () => {
    await start([
      { timestamp: '2026-11-14T12:00:00Z', location: 'Gym', grade: '6a', outcome: 'flash' },
    ]);
    expect(texts('.grade-badge')).toEqual(['6a']);
    expect(texts('.group-header')[0]).toContain('Gym • bouldering');
  });

  it('groups consecutive entries by location, kind and day, newest first', async () => {
    await start([
      attempt({ id: 'a1', loggedAt: '2026-11-14T12:00:00Z', location: 'A', grade: 'v1' }),
      attempt({ id: 'a2', loggedAt: '2026-11-14T13:00:00Z', location: 'A', grade: 'v2' }),
      attempt({
        id: 'a3',
        loggedAt: '2026-11-14T14:00:00Z',
        location: 'B',
        kind: 'route',
        grade: '6b',
      }),
      attempt({ id: 'a4', loggedAt: '2026-11-15T12:00:00Z', location: 'A', grade: 'v3' }),
    ]);
    const groups = [...document.querySelectorAll('.group-container')];
    expect(groups).toHaveLength(3);
    const day = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    expect(q('.group-header', groups[0]).textContent).toContain(
      `A • bouldering • ${day('2026-11-15T12:00:00Z')}`,
    );
    expect(q('.group-header', groups[1]).textContent).toContain('B • route');
    expect([...groups[2].querySelectorAll('.grade-badge')].map((e) => e.textContent)).toEqual([
      'v2',
      'v1',
    ]);
    // only the newest group starts expanded; header click toggles
    expect(groups.map((g) => g.classList.contains('collapsed'))).toEqual([false, true, true]);
    (q('.group-header', groups[1]) as HTMLElement).click();
    expect(groups[1].classList.contains('collapsed')).toBe(false);
  });

  it('renders time, grade, outcome badge colour by category and board angle', async () => {
    await start([
      attempt({ id: 's', outcome: 'flash' }),
      attempt({ id: 'f', outcome: 'fell', loggedAt: '2026-11-14T12:01:00Z' }),
      attempt({ id: 'k', outcome: 'skipped', loggedAt: '2026-11-14T12:02:00Z' }),
      // quirk: outcomes missing from the registry render as failures
      attempt({ id: 'u', outcome: 'mystery', loggedAt: '2026-11-14T12:03:00Z' }),
      attempt({
        id: 'kb',
        kind: 'kilterboard',
        boardAngle: 40,
        outcome: 'flash',
        loggedAt: '2026-11-14T12:04:00Z',
      }),
    ]);
    const badge = (id: string) => q(`[data-entry-id="${id}"] .entry-status-badge`).className;
    expect(badge('s')).toContain('entry-status-green');
    expect(badge('f')).toContain('entry-status-red');
    expect(badge('k')).toContain('entry-status-gray');
    expect(badge('u')).toContain('entry-status-red');
    expect(q('[data-entry-id="kb"] .detail-tag').textContent).toBe('Angle: 40°');
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
  it('prefills from the last entry and collapses context within 2 hours', async () => {
    await start([
      attempt({ id: 'old', location: 'Elsewhere', loggedAt: '2026-11-01T12:00:00Z' }),
      attempt({
        id: 'last',
        kind: 'kilterboard',
        boardAngle: 40,
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
    expect($<HTMLInputElement>('gradeInput').value).toBe('v5');
    expect($<HTMLInputElement>('boardAngleInput').value).toBe('40');
    expect($('boardAngleGroup').style.display).toBe('flex');
    expect(q('.kind-tab.active').getAttribute('data-kind')).toBe('kilterboard');
    expect($('contextBody').classList.contains('hidden')).toBe(true);
    expect($('contextToggleLink').textContent).toBe('Change');
    expect($('contextSummaryText').textContent).toBe('BW Ost • kilterboard');
  });

  it('expands context when the last entry is older than 2 hours, or with no history', async () => {
    await start([attempt({ loggedAt: '2026-11-15T09:59:00Z' })]);
    $('openModalBtn').click();
    expect($('contextBody').classList.contains('hidden')).toBe(false);
    expect($('contextToggleLink').textContent).toBe('Hide');

    await start(undefined);
    $('openModalBtn').click();
    expect($('contextBody').classList.contains('hidden')).toBe(false);
    expect($<HTMLInputElement>('locationInput').value).toBe('');
    expect($('contextSummaryText').textContent).toBe('Unknown Location • bouldering');
  });

  it('toggles the context section and updates its summary while typing', async () => {
    await start([attempt({ loggedAt: '2026-11-15T11:30:00Z' })]);
    $('openModalBtn').click();
    $('contextHeader').click();
    expect($('contextBody').classList.contains('hidden')).toBe(false);
    expect($('contextToggleLink').textContent).toBe('Hide');
    type('locationInput', 'New Gym');
    expect($('contextSummaryText').textContent).toBe('New Gym • bouldering');
    ($('contextBody').querySelector('[data-kind="route"]') as HTMLElement).click();
    expect($('contextSummaryText').textContent).toBe('New Gym • route');
    expect($('boardAngleGroup').style.display).toBe('none');
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

  it('suggests up to 3 recent unique locations; matches first, then recent ones', async () => {
    await start(
      ['Gym1', 'Gym2', 'gym2', 'Gym3', 'Gym4'].map((location, i) =>
        attempt({ id: `a${i}`, location, loggedAt: `2026-11-0${i + 1}T12:00:00Z` }),
      ),
    );
    $('openModalBtn').click();
    expect(texts('#locationChips .chip-small')).toEqual(['Gym4', 'Gym3', 'gym2']);
    type('locationInput', 'gym1');
    expect(texts('#locationChips .chip-small')).toEqual(['Gym1', 'Gym4', 'Gym3']);
    clickChip('locationChips', 'Gym1');
    expect($<HTMLInputElement>('locationInput').value).toBe('Gym1');
    expect($('contextSummaryText').textContent).toBe('Gym1 • bouldering');
  });

  it('suggests grades the same way', async () => {
    await start(['v1', 'v2', 'v3', 'v4'].map((grade, i) => attempt({ id: `a${i}`, grade })));
    $('openModalBtn').click();
    expect(texts('#gradeChips .chip-small')).toEqual(['v4', 'v3', 'v2']);
    type('gradeInput', 'v1');
    expect(texts('#gradeChips .chip-small')).toEqual(['v1', 'v4', 'v3']);
  });

  it('fills the angle from angle chips', async () => {
    await start([attempt({ kind: 'kilterboard' })]);
    $('openModalBtn').click();
    (q('#angleChips [data-angle="45"]') as HTMLElement).click();
    expect($<HTMLInputElement>('boardAngleInput').value).toBe('45');
  });

  it('shows outcome chips by recency, then unused registered outcomes, max 8', async () => {
    const outcomes = 'abcdefghij'.split('').map((name) => ({ name, category: 'success' }));
    await start([attempt({ id: '1', outcome: 'c' }), attempt({ id: '2', outcome: 'e' })], outcomes);
    $('openModalBtn').click();
    expect(texts('#frequentOutcomesRow .chip')).toEqual(['e', 'c', 'a', 'b', 'd', 'f', 'g', 'h']);
    const chips = [...$('frequentOutcomesRow').children] as HTMLElement[];
    expect(chips[0].className).toBe('chip success');
    // the last used outcome is highlighted
    expect(chips[0].style.outline).not.toBe('');
    expect(chips[1].style.outline).toBe('');
  });

  it('shows no outcome chips on a fresh install (empty registry)', async () => {
    await start(undefined, null);
    $('openModalBtn').click();
    expect($('frequentOutcomesRow').children).toHaveLength(0);
  });
});

describe('logging attempts', () => {
  it('logs a new attempt when an outcome chip is clicked', async () => {
    await start([attempt({ kind: 'kilterboard', boardAngle: 40 })]);
    $('openModalBtn').click();
    type('gradeInput', 'v5');
    clickChip('frequentOutcomesRow', 'flash');
    const all = stored();
    expect(all).toHaveLength(2);
    expect(all[1]).toEqual({
      id: expect.any(String),
      loggedAt: NOW.toISOString(),
      kind: 'kilterboard',
      location: 'BW Ost',
      grade: 'v5',
      outcome: 'flash',
      boardAngle: 40,
    });
    expect(all[1].id).not.toBe('a1');
    expect($('modalOverlay').classList.contains('active')).toBe(false);
    expect(document.querySelectorAll('.entry-card')).toHaveLength(2);
  });

  it('reuses the existing casing of location and grade', async () => {
    await start([attempt({ location: 'BW Ost', grade: 'V4' })]);
    $('openModalBtn').click();
    type('locationInput', '  bw ost ');
    type('gradeInput', 'v4');
    clickChip('frequentOutcomesRow', 'flash');
    expect(stored()[1]).toMatchObject({ location: 'BW Ost', grade: 'V4' });
  });

  it('omits the board angle when empty or not kilterboard', async () => {
    await start([attempt({ kind: 'kilterboard', boardAngle: 40 })]);
    $('openModalBtn').click();
    type('boardAngleInput', '');
    clickChip('frequentOutcomesRow', 'flash');
    expect(stored()[1]).not.toHaveProperty('boardAngle');
  });

  it('requires location and grade', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    type('gradeInput', '   ');
    clickChip('frequentOutcomesRow', 'flash');
    expect(alertMock).toHaveBeenCalledWith(
      'Please fill in both Location and Grade before selecting an outcome.',
    );
    expect(stored()).toHaveLength(1);
    expect($('modalOverlay').classList.contains('active')).toBe(true);
  });
});

describe('custom outcomes', () => {
  it('shows the category row only while a name is typed', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    expect($('categorySelectorRow').style.display).toBe('none');
    type('customOutcomeInput', 'x');
    expect($('categorySelectorRow').style.display).toBe('flex');
    (q('.cat-btn[data-cat="skip"]') as HTMLElement).click();
    expect(q('.cat-btn[data-cat="skip"]').className).toBe('cat-btn selected-skip');
    type('customOutcomeInput', '');
    expect($('categorySelectorRow').style.display).toBe('none');
    expect(q('.cat-btn[data-cat="skip"]').className).toBe('cat-btn');
  });

  it('validates name and category', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    $('saveCustomOutcomeBtn').click();
    expect(alertMock).toHaveBeenLastCalledWith('Please enter an outcome name.');
    type('customOutcomeInput', 'sloppy heel');
    $('saveCustomOutcomeBtn').click();
    expect(alertMock).toHaveBeenLastCalledWith(
      'Please select whether this outcome is a Success, Failure, or Skip.',
    );
    expect(stored()).toHaveLength(1);
  });

  it('registers the outcome (lowercased) and logs the attempt', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    type('customOutcomeInput', '  Fell At Crux ');
    (q('.cat-btn[data-cat="failure"]') as HTMLElement).click();
    $('saveCustomOutcomeBtn').click();
    expect(storedOutcomes()).toContainEqual({ name: 'fell at crux', category: 'failure' });
    expect(stored()[1]).toMatchObject({ outcome: 'fell at crux', location: 'BW Ost' });
    expect(q('.entry-status-badge').className).toContain('entry-status-red');
    expect($('outcomes-list').querySelectorAll('option')).toHaveLength(4);
  });

  it('does not duplicate an existing outcome or change its category', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    type('customOutcomeInput', 'FLASH');
    (q('.cat-btn[data-cat="failure"]') as HTMLElement).click();
    $('saveCustomOutcomeBtn').click();
    expect(storedOutcomes()).toEqual(OUTCOMES);
    expect(stored()[1].outcome).toBe('flash');
  });

  it('fills the datalist with registered outcomes, sorted', async () => {
    await start([attempt()]);
    $('openModalBtn').click();
    expect(
      [...$('outcomes-list').querySelectorAll('option')].map((o) => o.getAttribute('value')),
    ).toEqual(['fell', 'flash', 'skipped']);
  });
});

describe('editing and deleting', () => {
  const data = () => [
    attempt({ id: 'a1', kind: 'kilterboard', boardAngle: 40, grade: 'v3' }),
    attempt({ id: 'a2', loggedAt: '2026-11-14T13:00:00Z', grade: 'v4' }),
  ];

  const edit = (id: string) => (q(`[data-entry-id="${id}"] .edit-btn`) as HTMLElement).click();

  it('opens the entry for editing', async () => {
    await start(data());
    edit('a1');
    expect($('modalTitle').textContent).toBe('Edit Entry');
    expect($('deleteBtn').style.display).toBe('block');
    expect($<HTMLInputElement>('gradeInput').value).toBe('v3');
    expect($<HTMLInputElement>('boardAngleInput').value).toBe('40');
    expect($('contextBody').classList.contains('hidden')).toBe(true);
    // suggestions exclude the entry being edited
    expect(texts('#gradeChips .chip-small')).toEqual(['v4']);
  });

  it('updates the entry in place, keeping id and time', async () => {
    await start(data());
    edit('a1');
    type('gradeInput', 'v6');
    type('boardAngleInput', '45');
    clickChip('frequentOutcomesRow', 'fell');
    expect(stored()).toHaveLength(2);
    expect(stored()[0]).toEqual({
      id: 'a1',
      loggedAt: '2026-11-14T12:00:00.000Z',
      kind: 'kilterboard',
      location: 'BW Ost',
      grade: 'v6',
      outcome: 'fell',
      boardAngle: 45,
    });
  });

  it('drops the board angle when the kind changes', async () => {
    await start(data());
    edit('a1');
    (q('.kind-tab[data-kind="route"]') as HTMLElement).click();
    clickChip('frequentOutcomesRow', 'flash');
    expect(stored()[0].kind).toBe('route');
    expect(stored()[0]).not.toHaveProperty('boardAngle');
  });

  it('highlights the most recent outcome, not the edited entry’s (quirk)', async () => {
    await start([attempt({ id: 'a1', outcome: 'fell' }), attempt({ id: 'a2', outcome: 'flash' })]);
    edit('a1');
    const chip = (t: string) =>
      [...$('frequentOutcomesRow').children].find((c) => c.textContent === t) as HTMLElement;
    expect(chip('flash').style.outline).not.toBe('');
    expect(chip('fell').style.outline).toBe('');
  });

  it('deletes without confirmation (quirk)', async () => {
    await start(data());
    edit('a2');
    $('deleteBtn').click();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(stored().map((a) => a.id)).toEqual(['a1']);
    expect($('modalOverlay').classList.contains('active')).toBe(false);
  });

  it('a new entry after cancelling an edit is added, not an edit', async () => {
    await start(data());
    edit('a1');
    $('closeModalBtn').click();
    $('openModalBtn').click();
    clickChip('frequentOutcomesRow', 'flash');
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

    it('downloads a versioned backup and closes the menu', async () => {
      const outcomes = [
        { name: 'zz', category: 'skip' },
        { name: 'aa', category: 'success' },
      ];
      await start(
        [
          attempt(),
          attempt({
            id: 'k',
            kind: 'kilterboard',
            boardAngle: 40,
            loggedAt: '2026-11-14T13:00:00Z',
          }),
        ],
        outcomes,
      );
      $('openMenuBtn').click();
      $('exportJsonBtn').click();
      expect(downloadName).toBe('clog_backup_2026-11-15.json');
      expect(blob!.type).toBe('application/json;charset=utf-8;');
      const payload = JSON.parse(await blob!.text());
      expect(payload).toEqual({
        version: '1.2.0',
        exportedAt: NOW.toISOString(),
        outcomes: [outcomes[1], outcomes[0]],
        attempts: [
          { ...attempt(), loggedAt: '2026-11-14T12:00:00.000Z' },
          {
            ...attempt({ id: 'k', kind: 'kilterboard', boardAngle: 40 }),
            loggedAt: '2026-11-14T13:00:00Z',
          },
        ],
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
      version: '1.2.0',
      outcomes: [{ name: 'sent', category: 'success' }],
      attempts: [
        attempt({ id: 'b2', loggedAt: '2026-11-10T13:00:00Z', outcome: 'sent' }),
        attempt({ id: 'b1', loggedAt: '2026-11-10T12:00:00Z', outcome: 'sent' }),
      ],
    };

    it('replaces existing data after confirmation', async () => {
      await start([attempt()]);
      $('openMenuBtn').click();
      importFile(JSON.stringify(backup));
      await vi.waitFor(() =>
        expect(alertMock).toHaveBeenCalledWith('Successfully imported 2 attempts.'),
      );
      expect(confirmMock).toHaveBeenCalledWith(
        'Importing this backup will completely REPLACE your existing 1 local entries with the 2 entries from the file.\n\nProceed?',
      );
      expect(stored().map((a) => a.id)).toEqual(['b1', 'b2']);
      expect(storedOutcomes()).toEqual(backup.outcomes);
      expect(document.querySelectorAll('.entry-card')).toHaveLength(2);
      expect(q('.entry-status-badge').className).toContain('entry-status-green');
      expect($('menuModalOverlay').classList.contains('active')).toBe(false);
    });

    it('keeps data when the user cancels', async () => {
      confirmMock.mockReturnValue(false);
      await start([attempt()]);
      importFile(JSON.stringify(backup));
      await vi.waitFor(() => expect(confirmMock).toHaveBeenCalled());
      expect(stored().map((a) => a.id)).toEqual(['a1']);
      expect(storedOutcomes()).toEqual(OUTCOMES);
      expect(alertMock).not.toHaveBeenCalled();
    });

    it('does not ask when there is no local data, and keeps outcomes if the file has none', async () => {
      await start(undefined);
      importFile(JSON.stringify(backup.attempts));
      await vi.waitFor(() => expect(alertMock).toHaveBeenCalled());
      expect(confirmMock).not.toHaveBeenCalled();
      expect(stored()).toHaveLength(2);
      expect(storedOutcomes()).toEqual(OUTCOMES);
    });

    it('rejects files without valid attempts', async () => {
      await start([attempt()]);
      importFile(JSON.stringify({ attempts: [{ id: 'x' }] }));
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
