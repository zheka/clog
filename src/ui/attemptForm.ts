import { batch, computed, signal } from '@preact/signals';
import { config, findActivity } from '../config';
import { cleanText } from '../core/text';
import type { Attempt, Category } from '../core/types';
import type { Store } from '../store';

/** Within this time since the last attempt, a new attempt starts with the context collapsed. */
const SAME_SESSION_MS = config.sameSessionHours * 60 * 60 * 1000;

export type AttemptForm = ReturnType<typeof createAttemptForm>;

/**
 * The attempt form's state and actions, without any markup (see AttemptSheet.tsx for that).
 * State is signals; what depends on it (missing fields, faded chips) is computed from them.
 */
export function createAttemptForm(store: Store) {
  // --- state -------------------------------------------------------------------

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

  const attempts = () => store.state.value.attempts;
  const lastAttempt = (ofActivity?: string): Attempt | null => {
    const list = attempts();
    for (let i = list.length - 1; i >= 0; i--) {
      if (!ofActivity || list[i].activity === ofActivity) return list[i];
    }
    return null;
  };

  /** Location and the current activity's fields from an attempt (missing values stay empty). */
  function fill(from: Partial<Attempt> | null) {
    const next: Record<string, string> = { location: from?.location ?? '' };
    for (const f of fieldNames.value) next[f] = from?.[f] ?? '';
    values.value = next;
    typed.value = {};
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

  // --- actions -----------------------------------------------------------------

  /** New attempt, prefilled from the previous attempt. */
  function openNew() {
    batch(() => {
      const last = lastAttempt();
      editingId.value = null;
      activity.value =
        last && findActivity(last.activity) ? last.activity : config.activities[0].name;
      fill(last);
      currentOutcome.value = last?.outcome ?? null;
      // Collapse the context (activity, location) while still in the same session. An empty
      // location must be visible: then it opens (and won't collapse until the location is filled).
      const sameSession =
        last !== null && Date.now() - new Date(last.loggedAt).getTime() < SAME_SESSION_MS;
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
      fill(previous ?? kept);
      if (previous) currentOutcome.value = previous.outcome;
    });
  }

  function setField(field: string, value: string, byTyping: boolean) {
    values.value = { ...values.value, [field]: value };
    typed.value = { ...typed.value, [field]: byTyping };
  }

  /** Opens or collapses the context section; it stays open while the location is empty. */
  function toggleContext() {
    contextOpen.value = !contextOpen.value || missing.value.includes('location');
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

  /** Creates a new outcome in `category` and logs the attempt with it. */
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

  return {
    // state (read by the components)
    isOpen,
    openCount,
    editingId,
    activity,
    values,
    typed,
    contextOpen,
    outcomeText,
    currentOutcome,
    fieldNames,
    missing,
    blocked,
    attempts,
    // actions
    openNew,
    openEdit,
    close,
    switchActivity,
    setField,
    toggleContext,
    logAttempt,
    addOutcomeAndLog,
    deleteAttempt,
  };
}
