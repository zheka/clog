import { signal, type ReadonlySignal } from '@preact/signals';
import { createAttempt, withChanges, type AttemptInput } from './core/attempt';
import type { Attempt, Outcome } from './core/types';

export interface State {
  /** Oldest first. */
  readonly attempts: Attempt[];
  readonly outcomes: Outcome[];
}

export type Listener = (state: State, prev: State) => void;

/**
 * App state plus the only functions that change it. Every change replaces the state
 * (arrays are never mutated, so `state.attempts !== prev.attempts` means attempts changed),
 * saves it, then publishes it: views read `state` (a signal), others can `subscribe`.
 */
export interface Store {
  /** The current state; components that read it update when it changes. */
  readonly state: ReadonlySignal<State>;
  /** Calls `listener` after every change. Returns a function that unsubscribes. */
  subscribe(listener: Listener): () => void;
  addAttempt(input: AttemptInput): Attempt;
  updateAttempt(id: string, input: AttemptInput): void;
  deleteAttempt(id: string): void;
  /** Registers an outcome unless one with the same (normalised) name exists. */
  addOutcome(outcome: Outcome): void;
  /** Replaces everything (an imported backup). */
  replaceAll(state: State): void;
}

export function createStore(initial: State, save: (state: State) => void): Store {
  const current = signal(initial);
  const listeners = new Set<Listener>();

  function setState(next: State) {
    const prev = current.peek();
    // Save first: if saving fails, nothing changes on screen.
    save(next);
    current.value = next;
    listeners.forEach((listener) => listener(next, prev));
  }

  return {
    state: current,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    addAttempt(input) {
      const attempt = createAttempt(input);
      const state = current.peek();
      setState({ ...state, attempts: [...state.attempts, attempt] });
      return attempt;
    },

    updateAttempt(id, input) {
      const state = current.peek();
      setState({
        ...state,
        attempts: state.attempts.map((a) => (a.id === id ? withChanges(a, input) : a)),
      });
    },

    deleteAttempt(id) {
      const state = current.peek();
      setState({ ...state, attempts: state.attempts.filter((a) => a.id !== id) });
    },

    addOutcome(outcome) {
      const state = current.peek();
      if (state.outcomes.some((o) => o.name === outcome.name)) return;
      setState({ ...state, outcomes: [...state.outcomes, outcome] });
    },

    replaceAll(state) {
      setState(state);
    },
  };
}
