import type { Attempt, Outcome } from './core/types';
import { clearData, loadData, saveData } from './data/storage';
import { createStore } from './store';
import { mountEntryModal } from './ui/entryModal';
import { mountHistoryView } from './ui/historyView';
import { mountMenuModal } from './ui/menuModal';
import { requestPersistentStorage, setupUpdates } from './pwa';
import { showProblemScreen } from './ui/problemScreen';

// Offline support and updates work even when the saved data can't be used.
const updates = setupUpdates();
requestPersistentStorage();

function startApp(data: { attempts: Attempt[]; outcomes: Outcome[] }) {
  const store = createStore(data, (state) => saveData(state.attempts, state.outcomes));
  const entryModal = mountEntryModal(store);
  mountHistoryView(store, entryModal.openEdit);
  mountMenuModal(store, updates);
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
