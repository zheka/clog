import { loadData, saveData } from './data/storage';
import { createStore } from './store';
import { mountEntryModal } from './ui/entryModal';
import { mountHistoryView } from './ui/historyView';
import { mountMenuModal } from './ui/menuModal';

const store = createStore(loadData(), (state) => saveData(state.attempts, state.outcomes));

const entryModal = mountEntryModal(store);
mountHistoryView(store, entryModal.openEdit);
mountMenuModal(store);
