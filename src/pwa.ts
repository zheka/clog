/**
 * Offline support and updates for the installed app (production builds only).
 * A new version is downloaded in the background and waits; it takes over on the next launch,
 * or immediately when the user taps "Update" in the menu. The app never reloads by itself.
 */

export type UpdateStatus =
  | 'unavailable' // dev server, tests, or a browser without service workers
  | 'up-to-date'
  | 'checking'
  | 'ready' // a new version is downloaded and waiting
  | 'offline';

export interface Updates {
  status(): UpdateStatus;
  /** Calls `listener` whenever the status changes. */
  subscribe(listener: (status: UpdateStatus) => void): void;
  /** Looks for a new version now. */
  check(): Promise<void>;
  /** Switches to the waiting new version (reloads the page). */
  apply(): void;
}

export function setupUpdates(): Updates {
  let status: UpdateStatus = 'unavailable';
  let registration: ServiceWorkerRegistration | undefined;
  let updateSW: ((reload?: boolean) => Promise<void>) | undefined;
  const listeners = new Set<(status: UpdateStatus) => void>();
  const set = (next: UpdateStatus) => {
    status = next;
    listeners.forEach((listener) => listener(status));
  };

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    set('up-to-date');
    import('virtual:pwa-register').then(({ registerSW }) => {
      updateSW = registerSW({
        onNeedRefresh: () => set('ready'),
        onRegisteredSW: (_url, reg) => {
          registration = reg;
        },
      });
    });
  }

  return {
    status: () => status,
    subscribe: (listener) => listeners.add(listener),
    async check() {
      if (!registration || status === 'ready') return;
      set('checking');
      try {
        await registration.update();
        if (status === 'checking') set(registration.waiting ? 'ready' : 'up-to-date');
      } catch {
        set('offline');
      }
    },
    apply() {
      if (status === 'ready') updateSW?.(true);
    },
  };
}

/** Asks the browser not to clear the app's data when the device runs low on storage. */
export function requestPersistentStorage(): void {
  navigator.storage?.persist?.().catch(() => {});
}
