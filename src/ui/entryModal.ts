import { config, findActivity } from '../config';
import { getCategory } from '../core/outcomes';
import { suggestOutcomes, suggestValues, type Scope } from '../core/suggestions';
import { cleanText, normalizeName } from '../core/text';
import type { Attempt, Category } from '../core/types';
import type { Store } from '../store';
import { byId, twoTapButton } from './dom';

/** Within this time since the last attempt, a new entry starts with the context collapsed. */
const SAME_SESSION_MS = config.sameSessionHours * 60 * 60 * 1000;
const FIELD_CHIPS = 3;
const OUTCOME_CHIPS = 8;

export interface EntryModal {
  openNew(): void;
  openEdit(id: string): void;
}

/** A text input with its chip row. Chips filter only by text the user typed, not a prefill. */
interface TextInput {
  field: string;
  input: HTMLInputElement;
  chips: HTMLElement;
  typed: boolean;
}

/**
 * The New/Edit Entry sheet: context (activity, location), the activity's own fields from
 * config.ts, and the outcome. Picking an outcome saves the entry immediately;
 * "Save & Log" registers a custom outcome first.
 */
export function mountEntryModal(store: Store): EntryModal {
  let editingId: string | null = null;
  let selectedActivity = config.activities[0].name;
  let currentOutcome: string | null = null;
  let selectedCustomCategory: Category | null = null;

  const overlay = byId('modalOverlay');
  const title = byId('modalTitle');
  const deleteBtn = byId('deleteBtn');

  const contextHeader = byId('contextHeader');
  const contextBody = byId('contextBody');
  const contextSummary = byId('contextSummaryText');
  const contextToggle = byId('contextToggleLink');
  const fieldsContainer = byId('activityFields');
  const outcomeChips = byId('frequentOutcomesRow');

  const customInput = byId<HTMLInputElement>('customOutcomeInput');
  const categoryRow = byId('categorySelectorRow');
  const categoryBtns = document.querySelectorAll<HTMLElement>('.cat-btn');
  const saveCustomBtn = byId('saveCustomOutcomeBtn');

  const location: TextInput = {
    field: 'location',
    input: byId<HTMLInputElement>('locationInput'),
    chips: byId('locationChips'),
    typed: false,
  };
  /** Inputs of the selected activity's fields, in config order. */
  let fieldInputs: TextInput[] = [];

  const activityTabs = config.activities.map((activity) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'activity-tab';
    tab.dataset.activity = activity.name;
    tab.textContent = activity.name;
    tab.addEventListener('click', () => switchActivity(activity.name));
    byId('activityPicker').appendChild(tab);
    return tab;
  });

  // --- helpers ---------------------------------------------------------------

  const attempts = () => store.getState().attempts;
  const lastAttempt = (activity?: string): Attempt | null => {
    const list = attempts();
    for (let i = list.length - 1; i >= 0; i--) {
      if (!activity || list[i].activity === activity) return list[i];
    }
    return null;
  };
  const scope = (): Scope => ({
    activity: selectedActivity,
    location: cleanText(location.input.value),
  });

  function setValue(text: TextInput, value: string) {
    text.input.value = value;
    text.typed = false;
  }

  // --- rendering -------------------------------------------------------------

  /** Shows the activity's tabs state and builds its field inputs (empty). */
  function setActivity(name: string) {
    selectedActivity = name;
    activityTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.activity === name));
    fieldsContainer.innerHTML = '';
    fieldInputs = (findActivity(name)?.fields ?? []).map((field) => {
      const group = document.createElement('div');
      group.className = 'form-group';
      const label = document.createElement('label');
      label.htmlFor = `field-${field}`;
      label.textContent = field;
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `field-${field}`;
      input.autocomplete = 'off';
      const chips = document.createElement('div');
      chips.className = 'chips-container';
      chips.id = `chips-${field}`;
      group.append(label, input, chips);
      fieldsContainer.appendChild(group);
      const text: TextInput = { field, input, chips, typed: false };
      input.addEventListener('input', () => {
        text.typed = true;
        renderChips(text);
      });
      return text;
    });
    updateContextSummary();
  }

  /** Fills location and fields from an attempt (missing values stay empty). */
  function fill(from: Attempt | null, keepLocation = false) {
    if (!keepLocation) setValue(location, from?.location ?? '');
    for (const text of fieldInputs) setValue(text, from?.[text.field] ?? '');
  }

  function updateContextSummary() {
    const loc = location.input.value.trim() || 'Unknown Location';
    contextSummary.textContent = `${loc} • ${selectedActivity}`;
  }

  function setContextExpanded(expanded: boolean) {
    contextBody.classList.toggle('hidden', !expanded);
    contextToggle.textContent = expanded ? 'Hide' : 'Change';
  }

  function renderChips(text: TextInput) {
    const query = text.typed ? text.input.value : '';
    const values = suggestValues(attempts(), text.field, query, scope(), editingId, FIELD_CHIPS);
    text.chips.innerHTML = '';
    for (const value of values) {
      const chip = document.createElement('span');
      chip.className = 'chip-small';
      chip.classList.toggle('current', value === text.input.value);
      chip.textContent = value;
      chip.addEventListener('click', () => {
        setValue(text, value);
        if (text === location) {
          updateContextSummary();
          renderAllChips();
        } else {
          renderChips(text);
        }
      });
      text.chips.appendChild(chip);
    }
  }

  function renderOutcomeChips() {
    const { outcomes } = store.getState();
    const query = normalizeName(customInput.value);
    outcomeChips.innerHTML = '';
    for (const outcome of suggestOutcomes(
      attempts(),
      outcomes,
      selectedActivity,
      query,
      OUTCOME_CHIPS,
    )) {
      const chip = document.createElement('span');
      chip.className = `chip ${getCategory(outcomes, outcome)}`;
      // Highlight the field's current value
      if (outcome === currentOutcome) chip.style.outline = '2px solid var(--text)';
      chip.textContent = outcome;
      chip.addEventListener('click', () => logAttempt(outcome));
      outcomeChips.appendChild(chip);
    }
  }

  function renderAllChips() {
    renderChips(location);
    fieldInputs.forEach(renderChips);
  }

  /** The category buttons appear for a new name only; an existing one is picked from the chips. */
  function updateCustomOutcome() {
    const name = normalizeName(customInput.value);
    const exists = store.getState().outcomes.some((o) => o.name === name);
    if (name && !exists) {
      categoryRow.style.display = 'flex';
    } else {
      categoryRow.style.display = 'none';
      selectCategory(null);
    }
    renderOutcomeChips();
  }

  function selectCategory(category: Category | null) {
    selectedCustomCategory = category;
    categoryBtns.forEach((btn) => {
      btn.className =
        category && btn.dataset.cat === category ? `cat-btn selected-${category}` : 'cat-btn';
    });
  }

  function show() {
    customInput.value = '';
    updateCustomOutcome();
    updateContextSummary();
    renderAllChips();
    overlay.classList.add('active');
  }

  function close() {
    overlay.classList.remove('active');
    editingId = null;
    resetDelete();
  }

  // --- open ------------------------------------------------------------------

  /** New entry, prefilled from the previous attempt. */
  function openNew() {
    editingId = null;
    title.textContent = 'New Entry';
    deleteBtn.style.display = 'none';

    const last = lastAttempt();
    setActivity(last && findActivity(last.activity) ? last.activity : config.activities[0].name);
    fill(last);
    currentOutcome = last?.outcome ?? null;

    // Collapse the context (activity, location) while still in the same session.
    const sameSession =
      last !== null && Date.now() - new Date(last.loggedAt).getTime() < SAME_SESSION_MS;
    setContextExpanded(!sameSession);

    show();
  }

  function openEdit(id: string) {
    const entry = attempts().find((a) => a.id === id);
    if (!entry) return;

    editingId = entry.id;
    title.textContent = 'Edit Entry';
    deleteBtn.style.display = 'block';

    setActivity(entry.activity);
    fill(entry);
    currentOutcome = entry.outcome;
    setContextExpanded(false);

    show();
  }

  /**
   * Switching activity: a new entry loads that activity's previous attempt (location and
   * fields); when editing, or with no previous attempt, the location and the values of fields
   * both activities have are kept.
   */
  function switchActivity(name: string) {
    const kept = Object.fromEntries(fieldInputs.map((t) => [t.field, t.input.value]));
    setActivity(name);
    const previous = editingId ? null : lastAttempt(name);
    if (previous) {
      fill(previous);
      currentOutcome = previous.outcome;
    } else {
      for (const text of fieldInputs) setValue(text, kept[text.field] ?? '');
    }
    updateContextSummary();
    renderAllChips();
    renderOutcomeChips();
  }

  // --- save ------------------------------------------------------------------

  function logAttempt(outcome: string) {
    const loc = cleanText(location.input.value);
    const fields = Object.fromEntries(fieldInputs.map((t) => [t.field, cleanText(t.input.value)]));
    const missing = [
      loc ? null : 'location',
      ...fieldInputs.map((t) => (fields[t.field] ? null : t.field)),
    ].filter(Boolean);
    if (missing.length > 0) {
      alert(`Please fill in ${missing.join(', ')} before selecting an outcome.`);
      return;
    }
    const input = { activity: selectedActivity, location: loc, outcome, fields };
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
    // An existing outcome is logged from its chip, not saved again.
    if (store.getState().outcomes.some((o) => o.name === name)) return;
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

  // --- events ----------------------------------------------------------------

  byId('openModalBtn').addEventListener('click', openNew);
  byId('closeModalBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  const resetDelete = twoTapButton(deleteBtn, 'Tap again to delete', deleteEntry);

  contextHeader.addEventListener('click', () => {
    setContextExpanded(contextBody.classList.contains('hidden'));
  });
  location.input.addEventListener('input', () => {
    location.typed = true;
    updateContextSummary();
    renderAllChips();
  });

  customInput.addEventListener('input', updateCustomOutcome);
  categoryBtns.forEach((btn) =>
    btn.addEventListener('click', () => selectCategory(btn.dataset.cat as Category)),
  );
  saveCustomBtn.addEventListener('click', saveCustomOutcome);

  // Keep outcome chips current while the sheet is open.
  store.subscribe((state, prev) => {
    if (state.outcomes !== prev.outcomes) renderOutcomeChips();
  });

  return { openNew, openEdit };
}
