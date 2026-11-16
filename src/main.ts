import type { Attempt, Outcome } from './core/types';
import { clearData, loadData, saveData } from './data/storage';
import { createStore } from './store';
import { mountEntryModal } from './ui/entryModal';
import { mountHistoryView } from './ui/historyView';
import { mountMenuModal } from './ui/menuModal';
import { showProblemScreen } from './ui/problemScreen';

function startApp(data: { attempts: Attempt[]; outcomes: Outcome[] }) {
  const store = createStore(data, (state) => saveData(state.attempts, state.outcomes));
  const entryModal = mountEntryModal(store);
  mountHistoryView(store, entryModal.openEdit);
  mountMenuModal(store);
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
