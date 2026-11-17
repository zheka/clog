import type { Signal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import { ProblemScreen } from './ProblemScreen';

/** The running app's views, once there is usable data (absent while the problem screen shows). */
export interface Views {
  HistoryView: FunctionComponent;
  MenuSheet: FunctionComponent;
  AttemptSheet: FunctionComponent;
  openMenu: () => void;
  openNewAttempt: () => void;
}

/** The whole page: header, problem screen, history, the + button and the sheets. */
export function App({ views }: { views: Signal<Views | null> }) {
  const app = views.value;
  return (
    <div class="app-container">
      <header>
        <h1>Climbing Log</h1>
        <button
          id="openMenuBtn"
          class="menu-btn"
          aria-label="Data & Backup Menu"
          title="Data & Backup"
          onClick={() => app?.openMenu()}
        >
          <svg viewBox="0 0 24 24">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </header>

      <ProblemScreen />

      <main id="mainContent">{app && <app.HistoryView />}</main>

      <button
        id="openModalBtn"
        class="fab"
        aria-label="New Attempt"
        onClick={() => app?.openNewAttempt()}
      >
        +
      </button>

      {app && <app.MenuSheet />}
      {app && <app.AttemptSheet />}
    </div>
  );
}
