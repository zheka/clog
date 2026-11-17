import { batch, computed, signal } from '@preact/signals';
import { render, type ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { config, findActivity } from '../config';
import { getCategory } from '../core/outcomes';
import { suggestOutcomes, suggestValues } from '../core/suggestions';
import { cleanText, normalizeName } from '../core/text';
import { CATEGORIES, type Attempt, type Category } from '../core/types';
import type { Store } from '../store';
import { Chevron } from './Chevron';
import { byId, scrollFades, type ScrollFades } from './dom';
import { TwoTapButton } from './TwoTapButton';

/** Within this time since the last attempt, a new attempt starts with the context collapsed. */
const SAME_SESSION_MS = config.sameSessionHours * 60 * 60 * 1000;
const CATEGORY_MARK: Record<Category, string> = { success: '🟢', failure: '🔴', work: '⚪' };

export interface AttemptModal {
  openNew(): void;
  openEdit(id: string): void;
}

/**
 * The New/Edit Attempt sheet: context (activity, location), the activity's own fields from
 * config.ts, and the outcome. Tapping an outcome chip saves the attempt immediately; typing a
 * new outcome name offers one chip per category that creates the outcome and saves.
 */
export function mountAttemptModal(store: Store): AttemptModal {
  // --- state -------------------------------------------------------------------

  const data = signal(store.getState());
  store.subscribe((next) => (data.value = next));

  const isOpen = signal(false);
  /** Bumped on every open, so per-open things (the armed delete button) reset. */
  const openCount = signal(0);
  const editingId = signal<string | null>(null);
  const activity = signal(config.activities[0].name);
  /** `location` and the activity fields, as typed (cleaned only when saving). */
  const values = signal<Record<string, string>>({});
  /** Fields the user typed in since they were set: only typed text filters the chips. */
  const typed = signal<Record<string, boolean>>({});
  const contextOpen = signal(false);
  const outcomeText = signal('');
  /** Highlighted among the outcome chips: the previous attempt's, or the edited attempt's. */
  const currentOutcome = signal<string | null>(null);

  const fieldNames = computed(() => findActivity(activity.value)?.fields ?? []);
  /** Required fields (location and the activity's fields) that are still empty. */
  const missing = computed(() =>
    ['location', ...fieldNames.value].filter((f) => !cleanText(values.value[f] ?? '')),
  );
  /** Saving needs every field: until then the outcome chips are faded and inactive. */
  const blocked = computed(() => missing.value.length > 0);

  // --- helpers -----------------------------------------------------------------

  const attempts = () => data.value.attempts;
  const lastAttempt = (ofActivity?: string): Attempt | null => {
    const list = attempts();
    for (let i = list.length - 1; i >= 0; i--) {
      if (!ofActivity || list[i].activity === ofActivity) return list[i];
    }
    return null;
  };

  function setField(field: string, value: string, byTyping: boolean) {
    values.value = { ...values.value, [field]: value };
    typed.value = { ...typed.value, [field]: byTyping };
  }

  /** Location and the current activity's fields from an attempt (missing values stay empty). */
  function fill(from: Attempt | null) {
    const next: Record<string, string> = { location: from?.location ?? '' };
    for (const f of fieldNames.value) next[f] = from?.[f] ?? '';
    values.value = next;
    typed.value = {};
  }

  // --- open, switch, save --------------------------------------------------------

  /** New attempt, prefilled from the previous attempt. */
  function openNew() {
    batch(() => {
      const last = lastAttempt();
      editingId.value = null;
      activity.value =
        last && findActivity(last.activity) ? last.activity : config.activities[0].name;
      fill(last);
      currentOutcome.value = last?.outcome ?? null;
      // Collapse the context (activity, location) while still in the same session.
      const sameSession =
        last !== null && Date.now() - new Date(last.loggedAt).getTime() < SAME_SESSION_MS;
      // An empty location must be visible: then the context section opens (and the header
      // won't collapse it until the location is filled).
      contextOpen.value = !sameSession || !cleanText(values.value.location ?? '');
      show();
    });
  }

  function openEdit(id: string) {
    const attempt = attempts().find((a) => a.id === id);
    if (!attempt) return;
    batch(() => {
      editingId.value = attempt.id;
      activity.value = attempt.activity;
      fill(attempt);
      currentOutcome.value = attempt.outcome;
      contextOpen.value = false;
      show();
    });
  }

  function show() {
    outcomeText.value = '';
    openCount.value++;
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
    editingId.value = null;
  }

  /**
   * Switching activity: a new attempt loads that activity's previous attempt (location and
   * fields); when editing, or with no previous attempt, the location and the values of fields
   * both activities have are kept.
   */
  function switchActivity(name: string) {
    batch(() => {
      const kept = values.value;
      activity.value = name;
      const previous = editingId.value ? null : lastAttempt(name);
      if (previous) {
        fill(previous);
        currentOutcome.value = previous.outcome;
      } else {
        const next: Record<string, string> = { location: kept.location ?? '' };
        for (const f of fieldNames.value) next[f] = kept[f] ?? '';
        values.value = next;
        typed.value = {};
      }
    });
  }

  function logAttempt(outcome: string) {
    // The chips are inactive while a field is empty; this only guards against a stray tap.
    if (blocked.value) return;
    const fields = Object.fromEntries(
      fieldNames.value.map((f) => [f, cleanText(values.value[f] ?? '')]),
    );
    const input = {
      activity: activity.value,
      location: cleanText(values.value.location ?? ''),
      outcome,
      fields,
    };
    if (editingId.value) store.updateAttempt(editingId.value, input);
    else store.addAttempt(input);
    close();
  }

  function addOutcomeAndLog(name: string, category: Category) {
    if (blocked.value) return;
    store.addOutcome({ name, category });
    logAttempt(name);
  }

  function deleteAttempt() {
    if (!editingId.value) return;
    store.deleteAttempt(editingId.value);
    close();
  }

  // --- components ---------------------------------------------------------------

  /** A text field with its chip row: recent values, matches first while typing. */
  function TextField({ field, id, chipsId }: { field: string; id: string; chipsId: string }) {
    const value = values.value[field] ?? '';
    const query = typed.value[field] ? value : '';
    const scope = { activity: activity.value, location: cleanText(values.value.location ?? '') };
    const suggestions = suggestValues(
      attempts(),
      field,
      query,
      scope,
      editingId.value,
      config.maxChips,
    );
    return (
      <>
        <DoneInput
          id={id}
          class="required-input"
          // Red hint while empty: all fields are required (the hint is never part of the value).
          placeholder={`add ${field}`}
          value={value}
          onInput={(text) => setField(field, text, true)}
        />
        <ChipRow id={chipsId} class="chips-container" items={suggestions}>
          {suggestions.map((v) => (
            <span
              key={v}
              class={v === value ? 'chip-small current' : 'chip-small'}
              onClick={() => setField(field, v, false)}
            >
              {v}
            </span>
          ))}
        </ChipRow>
      </>
    );
  }

  function OutcomeField() {
    const { outcomes } = data.value;
    const name = normalizeName(outcomeText.value);
    // No text: recent outcomes. While typing: only matching ones (no backfill).
    const names = suggestOutcomes(attempts(), outcomes, activity.value, name, config.maxChips);
    const isNew = name !== '' && !outcomes.some((o) => o.name === name);
    const rowClass = (base: string) => (blocked.value ? `${base} blocked` : base);
    return (
      <div class="form-group">
        <label for="outcomeInput">Outcome</label>
        <DoneInput
          id="outcomeInput"
          placeholder="find or add an outcome"
          value={outcomeText.value}
          onInput={(text) => (outcomeText.value = text)}
        />
        <ChipRow
          id="outcomeChips"
          class={rowClass('outcome-row')}
          aria-disabled={blocked.value}
          items={names}
        >
          {names.map((o) => (
            <span
              key={o}
              class={`chip ${getCategory(outcomes, o)}${o === currentOutcome.value ? ' current' : ''}`}
              onClick={() => logAttempt(o)}
            >
              {o}
            </span>
          ))}
        </ChipRow>
        {/* For a new name: one chip per category, which creates the outcome and saves. */}
        <ChipRow
          id="newOutcomeChips"
          class={rowClass('outcome-row new-outcome-row')}
          aria-disabled={blocked.value}
          items={isNew ? [name] : []}
        >
          {isNew &&
            CATEGORIES.map((category) => (
              <span
                key={category}
                class={`chip ${category} new-outcome`}
                data-category={category}
                onClick={() => addOutcomeAndLog(name, category)}
              >
                {`${CATEGORY_MARK[category]} ${name}`}
              </span>
            ))}
        </ChipRow>
      </div>
    );
  }

  function AttemptSheet() {
    const editing = editingId.value !== null;
    const expanded = contextOpen.value;
    const location = (values.value.location ?? '').trim() || 'Unknown Location';
    return (
      <div
        id="modalOverlay"
        class={isOpen.value ? 'modal-overlay active' : 'modal-overlay'}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div class="modal-sheet">
          <div class="modal-header">
            <span id="modalTitle" class="modal-title">
              {editing ? 'Edit Attempt' : 'New Attempt'}
            </span>
            <button id="closeModalBtn" class="close-btn" onClick={close}>
              &times;
            </button>
          </div>

          <form id="attemptForm" onSubmit={(e) => e.preventDefault()}>
            {/* Collapsible context: activity and location */}
            <div class="form-group">
              <label>Context</label>
              <div
                id="contextHeader"
                class={expanded ? 'context-accordion-header' : 'context-accordion-header collapsed'}
                aria-expanded={expanded}
                onClick={() => {
                  // Stays open while the location is empty.
                  contextOpen.value = !expanded || missing.value.includes('location');
                }}
              >
                <span id="contextSummaryText" class="context-summary">
                  {`${location} • ${activity.value}`}
                </span>
                <Chevron />
              </div>
              <div
                id="contextBody"
                class={expanded ? 'context-collapsible-body' : 'context-collapsible-body hidden'}
              >
                <div class="form-group">
                  <label>Activity</label>
                  <div class="activity-picker" id="activityPicker">
                    {config.activities.map((a) => (
                      <button
                        key={a.name}
                        type="button"
                        class={a.name === activity.value ? 'activity-tab active' : 'activity-tab'}
                        data-activity={a.name}
                        onClick={() => switchActivity(a.name)}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div class="form-group">
                  <label for="locationInput">Location</label>
                  <TextField field="location" id="locationInput" chipsId="locationChips" />
                </div>
              </div>
            </div>

            {/* The selected activity's own fields (from config.ts) */}
            <div id="activityFields" class="activity-fields">
              {fieldNames.value.map((field) => (
                <div key={field} class="form-group">
                  <label for={`field-${field}`}>{field}</label>
                  <TextField field={field} id={`field-${field}`} chipsId={`chips-${field}`} />
                </div>
              ))}
            </div>

            <OutcomeField />

            <div class="form-actions">
              <TwoTapButton
                id="deleteBtn"
                class="delete-btn"
                style={{ display: editing ? 'block' : 'none' }}
                label="Delete"
                confirmLabel="Tap again to delete"
                onConfirm={deleteAttempt}
                resetKey={openCount.value}
              />
            </div>
          </form>
        </div>
      </div>
    );
  }

  byId('openModalBtn').addEventListener('click', openNew);
  render(<AttemptSheet />, byId('attemptRoot'));
  return { openNew, openEdit };
}

/** A text input whose keyboard action key is "Done": it closes the keyboard, saves nothing. */
function DoneInput(props: {
  id: string;
  class?: string;
  placeholder: string;
  value: string;
  onInput: (text: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    ref.current!.enterKeyHint = 'done';
  }, []);
  return (
    <input
      ref={ref}
      type="text"
      id={props.id}
      class={props.class}
      placeholder={props.placeholder}
      autocomplete="off"
      value={props.value}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/**
 * A chip row: one line that scrolls sideways, with edge fades where there is more. When its
 * items change it scrolls back to the start, so the best matches are visible.
 */
function ChipRow(props: {
  id: string;
  class: string;
  items: string[];
  'aria-disabled'?: boolean;
  children: ComponentChildren;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fades, setFades] = useState<ScrollFades>({ left: false, right: false });
  const itemsKey = props.items.join('\n');
  useLayoutEffect(() => {
    const row = ref.current!;
    row.scrollLeft = 0;
    setFades(scrollFades(row));
  }, [itemsKey]);
  const fadeClass = `${fades.left ? ' scroll-fade-left' : ''}${fades.right ? ' scroll-fade-right' : ''}`;
  return (
    <div
      ref={ref}
      id={props.id}
      class={props.class + fadeClass}
      aria-disabled={props['aria-disabled']}
      onScroll={(e) => setFades(scrollFades(e.currentTarget))}
    >
      {props.children}
    </div>
  );
}
