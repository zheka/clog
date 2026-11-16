// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const registerSW = vi.fn();
vi.mock('virtual:pwa-register', () => ({ registerSW }));

/** A stand-in for the service worker registration: just what pwa.ts uses. */
interface FakeRegistration {
  update: () => Promise<unknown>;
  waiting?: unknown;
}

/** Loads pwa.ts as in a production build, with `reg` as the service worker registration. */
async function setup(reg: FakeRegistration) {
  vi.stubEnv('PROD', true);
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
  const updateSW = vi.fn();
  registerSW.mockImplementation((options) => {
    options.onRegisteredSW?.('/sw.js', reg as unknown as ServiceWorkerRegistration);
    return updateSW;
  });
  vi.resetModules();
  const { setupUpdates } = await import('./pwa');
  const updates = setupUpdates();
  const seen: string[] = [];
  updates.subscribe((s) => seen.push(s));
  await vi.waitFor(() => expect(registerSW).toHaveBeenCalled());
  return { updates, updateSW, seen, options: registerSW.mock.calls[0][0] };
}

describe('updates', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    registerSW.mockReset();
  });

  it('is unavailable outside production builds', async () => {
    vi.resetModules();
    const { setupUpdates } = await import('./pwa');
    expect(setupUpdates().status()).toBe('unavailable');
    expect(registerSW).not.toHaveBeenCalled();
  });

  it('checks for a new version and reports when it is ready', async () => {
    const reg: FakeRegistration = { update: vi.fn(async () => {}), waiting: null };
    const { updates, seen } = await setup(reg);
    expect(updates.status()).toBe('up-to-date');
    await updates.check();
    expect(seen).toEqual(['checking', 'up-to-date']);
    reg.waiting = {};
    await updates.check();
    expect(updates.status()).toBe('ready');
  });

  it('becomes ready when a new version arrives in the background, and applies it on request', async () => {
    const { updates, updateSW, options } = await setup({ update: vi.fn(async () => {}) });
    updates.apply();
    expect(updateSW).not.toHaveBeenCalled(); // nothing to apply yet
    options.onNeedRefresh();
    expect(updates.status()).toBe('ready');
    updates.apply();
    expect(updateSW).toHaveBeenCalledWith(true);
  });

  it('reports a failed check as offline', async () => {
    const { updates } = await setup({ update: vi.fn(async () => Promise.reject(new Error('x'))) });
    await updates.check();
    expect(updates.status()).toBe('offline');
  });
});
