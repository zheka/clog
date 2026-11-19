// @vitest-environment jsdom
/** UI tests: Saved data that cannot be used: the problem screen. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { q, $, stored, type, attempt, OUTCOMES, start, useAppTestSetup } from './test-app';

useAppTestSetup();

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
    // the app is not running: its buttons do nothing, no attempt sheet opens
    $('newAttemptBtn').click();
    expect(document.querySelector('.modal-overlay.active')).toBeNull();
    expect(document.querySelectorAll('.attempt-card')).toHaveLength(0);
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
    expect(visible('newAttemptBtn')).toBe(false);
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
    $('newAttemptBtn').click();
    type('locationInput', 'Gym');
    type('field-grade', '6a');
    type('outcomeInput', 'flash');
    q('#newOutcomeChips .chip').click();
    expect(stored()).toHaveLength(1);
  });
});
