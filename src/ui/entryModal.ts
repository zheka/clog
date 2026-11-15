import { getCategory, sortByName } from '../core/outcomes';
import { matchExistingCasing, quickOutcomes, suggestValues } from '../core/suggestions';
import type { Category, Kind } from '../core/types';
import type { Store } from '../store';
import { byId } from './dom';

/** Within this time since the last attempt, a new entry starts with the context collapsed. */
const SAME_SESSION_MS = 2 * 60 * 60 * 1000;

export interface EntryModal {
  openNew(): void;
  openEdit(id: string): void;
}

/**
 * The New/Edit Entry sheet. Picking an outcome saves the entry immediately;
 * "Save & Log" registers a custom outcome first.
 */
export function mountEntryModal(store: Store): EntryModal {
  let editingId: string | null = null;
  let selectedKind: Kind = 'bouldering';
  let selectedCustomCategory: Category | null = null;

  const overlay = byId('modalOverlay');
  const title = byId('modalTitle');
  const deleteBtn = byId('deleteBtn');

  const contextHeader = byId('contextHeader');
  const contextBody = byId('contextBody');
  const contextSummary = byId('contextSummaryText');
  const contextToggle = byId('contextToggleLink');

  const kindTabs = document.querySelectorAll<HTMLElement>('.kind-tab');
  const angleGroup = byId('boardAngleGroup');
  const angleInput = byId<HTMLInputElement>('boardAngleInput');
  const angleChips = document.querySelectorAll<HTMLElement>('#angleChips .chip-small');

  const locationInput = byId<HTMLInputElement>('locationInput');
  const gradeInput = byId<HTMLInputElement>('gradeInput');
  const locationChips = byId('locationChips');
  const gradeChips = byId('gradeChips');
  const outcomeChips = byId('frequentOutcomesRow');

  const customInput = byId<HTMLInputElement>('customOutcomeInput');
  const outcomesDatalist = byId('outcomes-list');
  const categoryRow = byId('categorySelectorRow');
  const categoryBtns = document.querySelectorAll<HTMLElement>('.cat-btn');
  const saveCustomBtn = byId('saveCustomOutcomeBtn');

  // --- rendering -----------------------------------------------------------

  function setKind(kind: Kind) {
    selectedKind = kind;
    kindTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.kind === kind));
    if (kind === 'kilterboard') {
      angleGroup.style.display = 'flex';
    } else {
      angleGroup.style.display = 'none';
      angleInput.value = '';
    }
    updateContextSummary();
  }

  function updateContextSummary() {
    const location = locationInput.value.trim() || 'Unknown Location';
    contextSummary.textContent = `${location} • ${selectedKind}`;
  }

  function setContextExpanded(expanded: boolean) {
    contextBody.classList.toggle('hidden', !expanded);
    contextToggle.textContent = expanded ? 'Hide' : 'Change';
  }

  function renderSuggestions(field: 'location' | 'grade') {
    const input = field === 'location' ? locationInput : gradeInput;
    const container = field === 'location' ? locationChips : gradeChips;
    const { attempts } = store.getState();
    container.innerHTML = '';
    for (const text of suggestValues(attempts, field, input.value, editingId)) {
      const chip = document.createElement('span');
      chip.className = 'chip-small';
      chip.textContent = text;
      chip.addEventListener('click', () => {
        input.value = text;
        renderSuggestions(field);
        updateContextSummary();
      });
      container.appendChild(chip);
    }
  }

  function renderOutcomeChips() {
    const { attempts, outcomes } = store.getState();
    const lastOutcome = attempts.length > 0 ? attempts[attempts.length - 1].outcome : null;
    outcomeChips.innerHTML = '';
    for (const outcome of quickOutcomes(attempts, outcomes)) {
      const chip = document.createElement('span');
      chip.className = `chip ${getCategory(outcomes, outcome)}`;
      // Highlight the most recently used outcome
      if (lastOutcome && lastOutcome.toLowerCase() === outcome.toLowerCase()) {
        chip.style.outline = '2px solid var(--text)';
      }
      chip.textContent = outcome;
      chip.addEventListener('click', () => logAttempt(outcome));
      outcomeChips.appendChild(chip);
    }
  }

  function renderOutcomesDatalist() {
    outcomesDatalist.innerHTML = '';
    for (const o of sortByName(store.getState().outcomes)) {
      const option = document.createElement('option');
      option.value = o.name;
      outcomesDatalist.appendChild(option);
    }
  }

  function resetCustomOutcome() {
    customInput.value = '';
    categoryRow.style.display = 'none';
    selectCategory(null);
  }

  function selectCategory(category: Category | null) {
    selectedCustomCategory = category;
    categoryBtns.forEach((btn) => {
      btn.className =
        category && btn.dataset.cat === category ? `cat-btn selected-${category}` : 'cat-btn';
    });
  }

  function show() {
    updateContextSummary();
    renderSuggestions('location');
    renderSuggestions('grade');
    renderOutcomeChips();
    renderOutcomesDatalist();
    resetCustomOutcome();
    overlay.classList.add('active');
  }

  function close() {
    overlay.classList.remove('active');
    editingId = null;
  }

  // --- open ----------------------------------------------------------------

  /** New entry, prefilled from the last one (same gym, kind, grade and angle). */
  function openNew() {
    editingId = null;
    title.textContent = 'New Entry';
    deleteBtn.style.display = 'none';

    const { attempts } = store.getState();
    const last = attempts.length > 0 ? attempts[attempts.length - 1] : null;
    setKind(last ? last.kind || 'bouldering' : 'bouldering');
    locationInput.value = last ? last.location || '' : '';
    gradeInput.value = last ? last.grade || '' : '';
    angleInput.value =
      last && last.kind === 'kilterboard' && last.boardAngle ? String(last.boardAngle) : '';

    // Collapse the context (location/kind) while still in the same session.
    const sameSession =
      last !== null &&
      Boolean(last.loggedAt) &&
      Date.now() - new Date(last.loggedAt).getTime() < SAME_SESSION_MS;
    setContextExpanded(!sameSession);

    show();
  }

  function openEdit(id: string) {
    const entry = store.getState().attempts.find((a) => a.id === id);
    if (!entry) return;

    editingId = entry.id;
    title.textContent = 'Edit Entry';
    deleteBtn.style.display = 'block';

    setKind(entry.kind || 'bouldering');
    locationInput.value = entry.location || '';
    gradeInput.value = entry.grade || '';
    angleInput.value =
      entry.kind === 'kilterboard' && entry.boardAngle !== undefined
        ? String(entry.boardAngle)
        : '';
    setContextExpanded(false);

    show();
  }

  // --- save ----------------------------------------------------------------

  function logAttempt(outcome: string) {
    const { attempts } = store.getState();
    const location = matchExistingCasing(attempts, 'location', locationInput.value);
    const grade = matchExistingCasing(attempts, 'grade', gradeInput.value);
    if (!location || !grade) {
      alert('Please fill in both Location and Grade before selecting an outcome.');
      return;
    }

    let boardAngle: number | null = null;
    if (selectedKind === 'kilterboard' && angleInput.value.trim() !== '') {
      const parsed = Number(angleInput.value);
      if (!isNaN(parsed)) boardAngle = parsed;
    }

    const input = { kind: selectedKind, location, grade, outcome, boardAngle };
    if (editingId) {
      store.updateAttempt(editingId, input);
    } else {
      store.addAttempt(input);
    }
    close();
  }

  function saveCustomOutcome() {
    const name = customInput.value.trim().toLowerCase();
    if (!name) {
      alert('Please enter an outcome name.');
      return;
    }
    if (!selectedCustomCategory) {
      alert('Please select whether this outcome is a Success, Failure, or Skip.');
      return;
    }
    // Registered even if logging then fails validation.
    store.addOutcome({ name, category: selectedCustomCategory });
    logAttempt(name);
  }

  function deleteEntry() {
    if (!editingId) return;
    store.deleteAttempt(editingId);
    close();
  }

  // --- events --------------------------------------------------------------

  byId('openModalBtn').addEventListener('click', openNew);
  byId('closeModalBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  deleteBtn.addEventListener('click', deleteEntry);

  contextHeader.addEventListener('click', () => {
    setContextExpanded(contextBody.classList.contains('hidden'));
  });
  kindTabs.forEach((tab) => tab.addEventListener('click', () => setKind(tab.dataset.kind as Kind)));
  angleChips.forEach((chip) =>
    chip.addEventListener('click', () => (angleInput.value = chip.dataset.angle ?? '')),
  );
  locationInput.addEventListener('input', () => {
    renderSuggestions('location');
    updateContextSummary();
  });
  gradeInput.addEventListener('input', () => renderSuggestions('grade'));

  customInput.addEventListener('input', () => {
    if (customInput.value.trim().length > 0) {
      categoryRow.style.display = 'flex';
    } else {
      categoryRow.style.display = 'none';
      selectCategory(null);
    }
  });
  categoryBtns.forEach((btn) =>
    btn.addEventListener('click', () => selectCategory(btn.dataset.cat as Category)),
  );
  saveCustomBtn.addEventListener('click', saveCustomOutcome);

  // Keep outcome chips and the custom-outcome hints current while the sheet is open.
  store.subscribe((state, prev) => {
    if (state.outcomes !== prev.outcomes) {
      renderOutcomesDatalist();
      renderOutcomeChips();
    }
  });

  return { openNew, openEdit };
}
