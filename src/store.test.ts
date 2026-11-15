import { describe, expect, it, vi } from 'vitest';
import type { AttemptInput } from './core/attempt';
import { makeAttempt } from './core/test-helpers';
import { createStore, type State } from './store';

const input: AttemptInput = {
  kind: 'bouldering',
  location: 'BW Ost',
  grade: 'v5',
  outcome: 'flash',
  boardAngle: null,
};

function setup(initial: Partial<State> = {}) {
  const save = vi.fn();
  const store = createStore({ attempts: [], outcomes: [], ...initial }, save);
  const listener = vi.fn();
  store.subscribe(listener);
  return { store, save, listener };
}

describe('store', () => {
  it('adds an attempt with a new id and the current time, saves and notifies', () => {
    const { store, save, listener } = setup();
    const added = store.addAttempt(input);
    expect(added).toEqual({
      id: expect.any(String),
      loggedAt: expect.any(String),
      ...input,
      boardAngle: undefined,
    });
    expect(added).not.toHaveProperty('boardAngle');
    expect(store.getState().attempts).toEqual([added]);
    expect(save).toHaveBeenCalledWith(store.getState());
    expect(listener).toHaveBeenCalledWith(store.getState(), { attempts: [], outcomes: [] });
  });

  it('keeps the board angle only for kilterboard', () => {
    const { store } = setup();
    expect(store.addAttempt({ ...input, kind: 'kilterboard', boardAngle: 40 }).boardAngle).toBe(40);
    expect(store.addAttempt({ ...input, boardAngle: 40 })).not.toHaveProperty('boardAngle');
  });

  it('updates an attempt without changing its id or time, or other attempts', () => {
    const a = makeAttempt({ kind: 'kilterboard', boardAngle: 40 });
    const b = makeAttempt();
    const { store } = setup({ attempts: [a, b] });
    store.updateAttempt(a.id, { ...input, kind: 'route' });
    const [updated, other] = store.getState().attempts;
    expect(updated).toEqual({
      id: a.id,
      loggedAt: a.loggedAt,
      ...input,
      kind: 'route',
      boardAngle: undefined,
    });
    expect(updated).not.toHaveProperty('boardAngle');
    expect(other).toBe(b);
    expect(a.kind).toBe('kilterboard'); // the original object is not mutated
  });

  it('deletes an attempt', () => {
    const [a, b] = [makeAttempt(), makeAttempt()];
    const { store } = setup({ attempts: [a, b] });
    store.deleteAttempt(a.id);
    expect(store.getState().attempts).toEqual([b]);
  });

  it('adds an outcome once, ignoring case, without touching attempts', () => {
    const { store, listener } = setup({ outcomes: [{ name: 'flash', category: 'success' }] });
    const attemptsBefore = store.getState().attempts;
    store.addOutcome({ name: 'FLASH', category: 'failure' });
    expect(listener).not.toHaveBeenCalled();
    store.addOutcome({ name: 'fell', category: 'failure' });
    expect(store.getState().outcomes.map((o) => o.name)).toEqual(['flash', 'fell']);
    expect(store.getState().attempts).toBe(attemptsBefore);
  });

  it('replaces everything, keeping outcomes when none are given', () => {
    const outcomes = [{ name: 'flash', category: 'success' as const }];
    const { store } = setup({ attempts: [makeAttempt()], outcomes });
    const imported = [makeAttempt()];
    store.replaceAll(imported, null);
    expect(store.getState()).toEqual({ attempts: imported, outcomes });
    store.replaceAll([], []);
    expect(store.getState()).toEqual({ attempts: [], outcomes: [] });
  });

  it('stops notifying after unsubscribe', () => {
    const { store } = setup();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.addAttempt(input);
    expect(listener).not.toHaveBeenCalled();
  });
});
