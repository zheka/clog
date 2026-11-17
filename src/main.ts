import type { Attempt, Outcome } from './core/types';
import { clearData, loadData, saveData } from './data/storage';
import { createStore } from './store';
import { mountAttemptModal } from './ui/AttemptSheet';
import { mountHistoryView } from './ui/HistoryView';
import { mountMenuModal } from './ui/MenuSheet';
import { requestPersistentStorage, setupUpdates } from './pwa';
import { mountProblemScreen, showProblemScreen } from './ui/ProblemScreen';

// Offline support and updates work even when the saved data can't be used.
const updates = setupUpdates();
requestPersistentStorage();
mountProblemScreen();

function startApp(data: { attempts: Attempt[]; outcomes: Outcome[] }) {
  const store = createStore(data, (state) => saveData(state.attempts, state.outcomes));
  const attemptModal = mountAttemptModal(store);
  mountHistoryView(store, attemptModal.openEdit);
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
