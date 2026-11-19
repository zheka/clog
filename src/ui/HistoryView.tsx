import { signal, type ReadonlySignal, type Signal } from '@preact/signals';
import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { findActivity } from '../config';
import { getCategory } from '../core/outcomes';
import { groupIntoSessions, type Session } from '../core/sessions';
import type { Attempt, Outcome } from '../core/types';
import type { State, Store } from '../store';
import { Chevron } from './Chevron';

/**
 * The list of attempts, grouped into sessions. Expanded/collapsed groups reset (only the newest
 * open) whenever attempts change; outcome-only changes keep them as they are.
 */
export function createHistoryView(store: Store, onEdit: (id: string) => void) {
  // Bumped when attempts change: re-keys the list, which resets the groups' expanded state.
  const attemptsVersion = signal(0);
  store.subscribe((next, prev) => {
    if (next.attempts !== prev.attempts) attemptsVersion.value++;
  });
  return function HistoryView() {
    return (
      <div id="historyList" class="history-list">
        <HistoryList state={store.state} version={attemptsVersion} onEdit={onEdit} />
      </div>
    );
  };
}

interface ListProps {
  state: ReadonlySignal<State>;
  version: Signal<number>;
  onEdit: (id: string) => void;
}

function HistoryList({ state, version, onEdit }: ListProps) {
  const { attempts, outcomes } = state.value;
  if (attempts.length === 0) {
    return (
      <div class="empty-state">
        No attempts logged yet.
        <br />
        Tap + to add your first attempt!
      </div>
    );
  }
  return (
    <Fragment key={version.value}>
      {groupIntoSessions(attempts).map((session, index) => (
        <SessionGroup
          key={session.key}
          session={session}
          outcomes={outcomes}
          // Only the most recent session starts expanded.
          initiallyCollapsed={index !== 0}
          onEdit={onEdit}
        />
      ))}
    </Fragment>
  );
}

interface GroupProps {
  session: Session;
  outcomes: Outcome[];
  initiallyCollapsed: boolean;
  onEdit: (id: string) => void;
}

function SessionGroup({ session, outcomes, initiallyCollapsed, onEdit }: GroupProps) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  return (
    <div class={collapsed ? 'group-container collapsed' : 'group-container'}>
      <div class="group-header" onClick={() => setCollapsed(!collapsed)}>
        <div class="group-header-left">
          <span>
            <span class="group-date">{session.dateString}</span>
            {' • '}
            {session.activity}
            {' • '}
            {session.location}
          </span>
        </div>
        <Chevron />
      </div>
      {/* A collapsed group builds no cards: with a long history most groups are collapsed. */}
      {!collapsed && (
        <div class="group-body">
          {session.attempts.map((attempt) => (
            <AttemptCard key={attempt.id} attempt={attempt} outcomes={outcomes} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  attempt: Attempt;
  outcomes: Outcome[];
  onEdit: (id: string) => void;
}

function AttemptCard({ attempt, outcomes, onEdit }: CardProps) {
  const time = new Date(attempt.loggedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // The activity's fields as badges, in config order. Fields it doesn't list aren't shown.
  const fields = (findActivity(attempt.activity)?.fields ?? []).filter((field) => attempt[field]);
  return (
    <div class="attempt-card" data-attempt-id={attempt.id}>
      <div class="attempt-main-row">
        <div class="attempt-left">
          <span class="attempt-time">{time}</span>
          {fields.map((field) => (
            <span key={field} class="field-badge">
              {attempt[field]}
            </span>
          ))}
          <span
            class={`attempt-status-badge attempt-status-${getCategory(outcomes, attempt.outcome)}`}
          >
            {attempt.outcome}
          </span>
        </div>
        <div class="attempt-right">
          <button
            type="button"
            class="edit-btn"
            data-id={attempt.id}
            onClick={() => onEdit(attempt.id)}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
