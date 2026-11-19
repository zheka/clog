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
 * saves it, then notifies subscribers.
 */
export interface Store {
  getState(): State;
  /** Calls `listener` after every change. Returns a function that unsubscribes. */
  subscribe(listener: Listener): () => void;
  addAttempt(input: AttemptInput): Attempt;
  updateAttempt(id: string, input: AttemptInput): void;
  deleteAttempt(id: string): void;
  /** Registers an outcome unless one with the same (normalised) name exists. */
  addOutcome(outcome: Outcome): void;
  /** Replaces all attempts, and the outcomes too unless `outcomes` is null. */
  replaceAll(attempts: Attempt[], outcomes: Outcome[] | null): void;
}

export function createStore(initial: State, save: (state: State) => void): Store {
  let state = initial;
  const listeners = new Set<Listener>();

  function setState(next: State) {
    const prev = state;
    state = next;
    save(state);
    listeners.forEach((listener) => listener(state, prev));
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    addAttempt(input) {
      const attempt = createAttempt(input);
      setState({ ...state, attempts: [...state.attempts, attempt] });
      return attempt;
    },

    updateAttempt(id, input) {
      setState({
        ...state,
        attempts: state.attempts.map((a) => (a.id === id ? withChanges(a, input) : a)),
      });
    },

    deleteAttempt(id) {
      setState({ ...state, attempts: state.attempts.filter((a) => a.id !== id) });
    },

    addOutcome(outcome) {
      if (state.outcomes.some((o) => o.name === outcome.name)) return;
      setState({ ...state, outcomes: [...state.outcomes, outcome] });
    },

    replaceAll(attempts, outcomes) {
      setState({ attempts, outcomes: outcomes ?? state.outcomes });
    },
  };
}
