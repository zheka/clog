/**
 * Shared setup for the UI tests (*.test.ts in this folder): they load index.html and the app in
 * jsdom, drive it like a user, and check the page. They pin down the app's behaviour so changes
 * to it are deliberate.
 */
import { afterEach, beforeEach, expect, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import styleCss from '../style.css?raw';

export const STORAGE_KEY = 'clog';
export const LEGACY_KEYS = ['climb_attempts_history', 'climb_outcomes_registry'];
export const NOW = new Date('2026-11-15T12:00:00Z');

export type Raw = Record<string, unknown>;

/** querySelector that fails the test if nothing matches. */
export function q<T extends HTMLElement = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`No element matches ${sel}`);
  return el;
}

/** Expands every collapsed history group (collapsed groups build no cards). */
export function expandAll() {
  for (const header of document.querySelectorAll<HTMLElement>('.collapsed .group-header')) {
    header.click();
  }
}

export const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
export const texts = (sel: string) =>
  [...document.querySelectorAll(sel)].map((e) => e.textContent.trim());
export const storedData = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
export const stored = (): Raw[] => storedData().attempts ?? [];
export const storedOutcomes = (): Raw[] => storedData().outcomes ?? [];

export function type(id: string, value: string) {
  const el = $<HTMLInputElement>(id);
  el.value = value;
  el.dispatchEvent(new Event('input'));
}

export function clickChip(containerId: string, text: string) {
  const chip = [...$(containerId).children].find((c) => c.textContent === text) as HTMLElement;
  expect(chip, `chip "${text}" in #${containerId}`).toBeTruthy();
  chip.click();
}

export function attempt(overrides: Raw = {}): Raw {
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

export const OUTCOMES = [
  { name: 'flash', category: 'success' },
  { name: 'fell', category: 'failure' },
  { name: 'learning', category: 'work' },
];

/** Stand-ins for the browser's alert() and confirm(), fresh for every test. */
export let alertMock: ReturnType<typeof vi.fn>;
export let confirmMock: ReturnType<typeof vi.fn>;

/**
 * Loads the app with saved data. `start(undefined, null)` = nothing saved (a fresh install).
 * `raw` items are written to localStorage as they are, before the saved data.
 */
export async function start(
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
  await import('../main');
}

/** Call once at the top of each UI test file: a fixed clock and fresh alert/confirm stand-ins. */
export function useAppTestSetup() {
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
}
