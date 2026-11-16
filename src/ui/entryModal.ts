import { config, findActivity } from '../config';
import { getCategory, sortByName } from '../core/outcomes';
import { matchExistingCasing, quickOutcomes, suggestValues } from '../core/suggestions';
import { cleanText, normalizeName } from '../core/text';
import type { Category } from '../core/types';
import type { Store } from '../store';
import { byId } from './dom';

/** Within this time since the last attempt, a new entry starts with the context collapsed. */
const SAME_SESSION_MS = config.sameSessionHours * 60 * 60 * 1000;

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
  let selectedActivity = config.activities[0].name;
  let selectedCustomCategory: Category | null = null;

  const overlay = byId('modalOverlay');
  const title = byId('modalTitle');
  const deleteBtn = byId('deleteBtn');

  const contextHeader = byId('contextHeader');
  const contextBody = byId('contextBody');
  const contextSummary = byId('contextSummaryText');
  const contextToggle = byId('contextToggleLink');

  const activityPicker = byId('activityPicker');
  const activityTabs = config.activities.map((activity) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'activity-tab';
    tab.dataset.activity = activity.name;
    tab.textContent = activity.name;
    tab.addEventListener('click', () => setActivity(activity.name));
    activityPicker.appendChild(tab);
    return tab;
  });
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

  function setActivity(name: string) {
    selectedActivity = name;
    activityTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.activity === name));
    if (hasField('angle')) {
      angleGroup.style.display = 'flex';
    } else {
      angleGroup.style.display = 'none';
      angleInput.value = '';
    }
    updateContextSummary();
  }

  function hasField(field: string) {
    return findActivity(selectedActivity)?.fields.includes(field) ?? false;
  }

  function updateContextSummary() {
    const location = locationInput.value.trim() || 'Unknown Location';
    contextSummary.textContent = `${location} • ${selectedActivity}`;
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

  /** New entry, prefilled from the last one (same activity, gym, grade and angle). */
  function openNew() {
    editingId = null;
    title.textContent = 'New Entry';
    deleteBtn.style.display = 'none';

    const { attempts } = store.getState();
    const last = attempts.length > 0 ? attempts[attempts.length - 1] : null;
    setActivity(last && findActivity(last.activity) ? last.activity : config.activities[0].name);
    locationInput.value = last ? last.location || '' : '';
    gradeInput.value = last ? last.grade || '' : '';
    angleInput.value = last && hasField('angle') ? last.angle || '' : '';

    // Collapse the context (activity, location) while still in the same session.
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

    setActivity(entry.activity);
    locationInput.value = entry.location || '';
    gradeInput.value = entry.grade || '';
    angleInput.value = hasField('angle') ? entry.angle || '' : '';
    setContextExpanded(false);

    show();
  }

  // --- save ----------------------------------------------------------------

  function logAttempt(outcome: string) {
    const { attempts } = store.getState();
    const location = matchExistingCasing(attempts, 'location', cleanText(locationInput.value));
    const grade = matchExistingCasing(attempts, 'grade', cleanText(gradeInput.value));
    if (!location || !grade) {
      alert('Please fill in both Location and Grade before selecting an outcome.');
      return;
    }

    const fields: Record<string, string> = { grade };
    if (hasField('angle')) fields.angle = cleanText(angleInput.value);

    const input = { activity: selectedActivity, location, outcome, fields };
    if (editingId) {
      store.updateAttempt(editingId, input);
    } else {
      store.addAttempt(input);
    }
    close();
  }

  function saveCustomOutcome() {
    const name = normalizeName(customInput.value);
    if (!name) {
      alert('Please enter an outcome name.');
      return;
    }
    if (!selectedCustomCategory) {
      alert('Please select whether this outcome is a Success, Failure, or Work.');
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
