import { signal } from '@preact/signals';
import { render } from 'preact';
import type { Attempt, Outcome } from './core/types';
import { clearData, loadData, saveData } from './data/storage';
import { requestPersistentStorage, setupUpdates } from './pwa';
import { createStore } from './store';
import { App, type Views } from './ui/App';
import { createAttemptSheet } from './ui/AttemptSheet';
import { createHistoryView } from './ui/HistoryView';
import { createMenuSheet } from './ui/MenuSheet';
import { showProblemScreen } from './ui/ProblemScreen';

// Offline support and updates work even when the saved data can't be used.
const updates = setupUpdates();
requestPersistentStorage();

const views = signal<Views | null>(null);

function startApp(data: { attempts: Attempt[]; outcomes: Outcome[] }) {
  const store = createStore(data, (state) => saveData(state.attempts, state.outcomes));
  const attempt = createAttemptSheet(store);
  const menu = createMenuSheet(store, updates);
  views.value = {
    HistoryView: createHistoryView(store, attempt.openEdit),
    MenuSheet: menu.MenuSheet,
    AttemptSheet: attempt.AttemptSheet,
    openMenu: menu.open,
    openNewAttempt: attempt.openNew,
  };
}

const loaded = loadData();
if (loaded.ok) {
  startApp(loaded);
} else {
  showProblemScreen(loaded.problems, loaded.raw, () => {
    clearData();
    startApp({ attempts: [], outcomes: [] });
  });
}

render(<App views={views} />, document.getElementById('app')!);
