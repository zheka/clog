import { config, findActivity } from '../config';
import { getCategory } from '../core/outcomes';
import { suggestOutcomes, suggestValues, type Scope } from '../core/suggestions';
import { cleanText, normalizeName } from '../core/text';
import { CATEGORIES, type Attempt, type Category } from '../core/types';
import type { Store } from '../store';
import {
  byId,
  closeKeyboardOnDone,
  trackScrollFades,
  twoTapButton,
  updateScrollFades,
} from './dom';

/** Within this time since the last attempt, a new attempt starts with the context collapsed. */
const SAME_SESSION_MS = config.sameSessionHours * 60 * 60 * 1000;
const CATEGORY_MARK: Record<Category, string> = { success: '🟢', failure: '🔴', work: '⚪' };

export interface AttemptModal {
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
 * The New/Edit Attempt sheet: context (activity, location), the activity's own fields from
 * config.ts, and the outcome. Tapping an outcome chip saves the attempt immediately; typing a
 * new outcome name offers one chip per category that creates the outcome and saves.
 */
export function mountAttemptModal(store: Store): AttemptModal {
  let editingId: string | null = null;
  let selectedActivity = config.activities[0].name;
  let currentOutcome: string | null = null;

  const overlay = byId('modalOverlay');
  const title = byId('modalTitle');
  const deleteBtn = byId('deleteBtn');

  const contextHeader = byId('contextHeader');
  const contextBody = byId('contextBody');
  const contextSummary = byId('contextSummaryText');
  const fieldsContainer = byId('activityFields');
  const outcomeInput = byId<HTMLInputElement>('outcomeInput');
  const outcomeChips = byId('outcomeChips');
  const newOutcomeChips = byId('newOutcomeChips');

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
      // Red hint while empty: all fields are required (the hint is never part of the value).
      input.placeholder = `add ${field}`;
      input.classList.add('required-input');
      closeKeyboardOnDone(input);
      const chips = document.createElement('div');
      chips.className = 'chips-container';
      chips.id = `chips-${field}`;
      trackScrollFades(chips);
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

  /** Names of the required fields (location and the activity's fields) that are still empty. */
  function missingFields(): string[] {
    return [location, ...fieldInputs]
      .filter((text) => !cleanText(text.input.value))
      .map((text) => text.field);
  }

  /**
   * Saving needs every field: until then the outcome chips (which save) are faded and inactive,
   * and the empty fields show their red "add …" hint.
   */
  function updateSaveState() {
    const missing = missingFields();
    const blocked = missing.length > 0;
    // An empty location must stay visible: keep the context section open until it's filled.
    if (missing.includes('location')) setContextExpanded(true);
    for (const row of [outcomeChips, newOutcomeChips]) {
      row.classList.toggle('blocked', blocked);
      row.setAttribute('aria-disabled', String(blocked));
    }
  }

  function setContextExpanded(expanded: boolean) {
    contextBody.classList.toggle('hidden', !expanded);
    // Same chevron as the history groups: down when open, right when collapsed.
    contextHeader.classList.toggle('collapsed', !expanded);
    contextHeader.setAttribute('aria-expanded', String(expanded));
  }

  function renderChips(text: TextInput) {
    const query = text.typed ? text.input.value : '';
    const values = suggestValues(
      attempts(),
      text.field,
      query,
      scope(),
      editingId,
      config.maxChips,
    );
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
    showRowStart(text.chips);
    updateSaveState();
  }

  /** After refilling a chip row: scroll back to its start and update its edge fades. */
  function showRowStart(row: HTMLElement) {
    row.scrollLeft = 0;
    updateScrollFades(row);
  }

  function outcomeChip(row: HTMLElement, text: string, category: Category, onTap: () => void) {
    const chip = document.createElement('span');
    chip.className = `chip ${category}`;
    chip.textContent = text;
    chip.addEventListener('click', onTap);
    row.appendChild(chip);
    return chip;
  }

  /**
   * No text: recent outcomes. While typing: matching outcomes, and (for a name that doesn't
   * exist yet) a row of its own below with one chip per category, which creates the outcome
   * and saves the attempt.
   */
  function renderOutcomeChips() {
    const { outcomes } = store.getState();
    const name = normalizeName(outcomeInput.value);
    outcomeChips.innerHTML = '';
    newOutcomeChips.innerHTML = '';
    for (const outcome of suggestOutcomes(
      attempts(),
      outcomes,
      selectedActivity,
      name,
      config.maxChips,
    )) {
      const category = getCategory(outcomes, outcome);
      const chip = outcomeChip(outcomeChips, outcome, category, () => logAttempt(outcome));
      // Highlight the field's current value
      if (outcome === currentOutcome) chip.classList.add('current');
    }
    if (name && !outcomes.some((o) => o.name === name)) {
      for (const category of CATEGORIES) {
        const label = `${CATEGORY_MARK[category]} ${name}`;
        const chip = outcomeChip(newOutcomeChips, label, category, () => {
          if (missingFields().length > 0) return;
          store.addOutcome({ name, category });
          logAttempt(name);
        });
        chip.classList.add('new-outcome');
        chip.dataset.category = category;
      }
    }
    showRowStart(outcomeChips);
    showRowStart(newOutcomeChips);
    updateSaveState();
  }

  function renderAllChips() {
    renderChips(location);
    fieldInputs.forEach(renderChips);
  }

  function show() {
    outcomeInput.value = '';
    renderOutcomeChips();
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

  /** New attempt, prefilled from the previous attempt. */
  function openNew() {
    editingId = null;
    title.textContent = 'New Attempt';
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
    const attempt = attempts().find((a) => a.id === id);
    if (!attempt) return;

    editingId = attempt.id;
    title.textContent = 'Edit Attempt';
    deleteBtn.style.display = 'block';

    setActivity(attempt.activity);
    fill(attempt);
    currentOutcome = attempt.outcome;
    setContextExpanded(false);

    show();
  }

  /**
   * Switching activity: a new attempt loads that activity's previous attempt (location and
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
    // The chips are inactive while a field is empty; this only guards against a stray tap.
    if (missingFields().length > 0) return;
    const input = { activity: selectedActivity, location: loc, outcome, fields };
    if (editingId) {
      store.updateAttempt(editingId, input);
    } else {
      store.addAttempt(input);
    }
    close();
  }

  function deleteAttempt() {
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
  const resetDelete = twoTapButton(deleteBtn, 'Tap again to delete', deleteAttempt);

  contextHeader.addEventListener('click', () => {
    setContextExpanded(contextBody.classList.contains('hidden'));
    updateSaveState(); // stays open while the location is empty
  });
  for (const row of [location.chips, outcomeChips, newOutcomeChips]) trackScrollFades(row);
  closeKeyboardOnDone(location.input);
  closeKeyboardOnDone(outcomeInput);
  location.input.addEventListener('input', () => {
    location.typed = true;
    updateContextSummary();
    renderAllChips();
  });

  outcomeInput.addEventListener('input', renderOutcomeChips);

  // Keep outcome chips current while the sheet is open.
  store.subscribe((state, prev) => {
    if (state.outcomes !== prev.outcomes) renderOutcomeChips();
  });

  return { openNew, openEdit };
}
