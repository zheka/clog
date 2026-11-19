import { signal } from '@preact/signals';
import { render } from 'preact';
import type { Attempt, Outcome } from './core/types';
import { clearData, loadData, saveData, type LoadResult } from './data/storage';
import { requestPersistentStorage, setupUpdates } from './pwa';
import { createStore } from './store';
import { App, type Views } from './ui/App';
import { createAttemptForm } from './ui/attemptForm';
import { AttemptSheet } from './ui/AttemptSheet';
import { createHistoryView } from './ui/HistoryView';
import { createMenuSheet } from './ui/MenuSheet';
import { alertStorageProblem } from './ui/dom';
import { showProblemScreen } from './ui/ProblemScreen';

// Offline support and updates work even when the saved data can't be used.
const updates = setupUpdates();
requestPersistentStorage();

const views = signal<Views | null>(null);

function startApp(data: { attempts: Attempt[]; outcomes: Outcome[] }) {
  const store = createStore(data, (state) => saveData(state.attempts, state.outcomes));
  const form = createAttemptForm(store);
  const menu = createMenuSheet(store, updates);
  views.value = {
    HistoryView: createHistoryView(store, form.openEdit),
    MenuSheet: menu.MenuSheet,
    AttemptSheet: () => <AttemptSheet form={form} store={store} />,
    openMenu: menu.open,
    openNewAttempt: form.openNew,
  };
}

let loaded: LoadResult | null = null;
try {
  loaded = loadData();
} catch (err) {
  // The storage can't be read at all. The app doesn't start, so it can't overwrite saved data
  // that is merely unreadable for now; after allowing storage, a reload starts it.
  alertStorageProblem("Can't read the saved data, so the app can't start", err);
}
if (loaded?.ok) {
  startApp(loaded);
} else if (loaded) {
  showProblemScreen(loaded.problems, loaded.raw, () => {
    clearData(); // if this throws, the problem screen stays (see ProblemScreen)
    startApp({ attempts: [], outcomes: [] });
  });
}

render(<App views={views} />, document.getElementById('app')!);
