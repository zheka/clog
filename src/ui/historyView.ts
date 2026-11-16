import { findActivity } from '../config';
import { getCategory } from '../core/outcomes';
import { groupIntoSessions, type Session } from '../core/sessions';
import type { Attempt, Category, Outcome } from '../core/types';
import type { State, Store } from '../store';
import { byId, escapeHtml } from './dom';

const BADGE_CLASS: Record<Category, string> = {
  success: 'attempt-status-green',
  failure: 'attempt-status-red',
  work: 'attempt-status-gray',
};

const CHEVRON_ICON =
  '<svg class="group-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>';

/**
 * The list of attempts, grouped into sessions. Re-renders when attempts change.
 * Outcome-only changes don't re-render, so expanded/collapsed groups stay as they are.
 */
export function mountHistoryView(store: Store, onEdit: (id: string) => void): void {
  const list = byId('historyList');

  function render({ attempts, outcomes }: State) {
    list.innerHTML = '';
    if (attempts.length === 0) {
      list.innerHTML =
        '<div class="empty-state">No attempts logged yet.<br>Tap + to add your first attempt!</div>';
      return;
    }
    groupIntoSessions(attempts).forEach((session, index) => {
      // Only the most recent session starts expanded.
      list.appendChild(renderSession(session, outcomes, index !== 0));
    });
  }

  function renderSession(session: Session, outcomes: Outcome[], collapsed: boolean) {
    const groupEl = document.createElement('div');
    groupEl.className = 'group-container';
    if (collapsed) groupEl.classList.add('collapsed');

    const headerEl = document.createElement('div');
    headerEl.className = 'group-header';
    headerEl.innerHTML = `
      <div class="group-header-left">
        <span><span class="group-date">${session.dateString}</span> &bull; ${escapeHtml(session.location)} &bull; ${escapeHtml(session.activity)}</span>
      </div>
      ${CHEVRON_ICON}
    `;
    headerEl.addEventListener('click', () => groupEl.classList.toggle('collapsed'));
    groupEl.appendChild(headerEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'group-body';
    session.attempts.forEach((attempt) => bodyEl.appendChild(renderCard(attempt, outcomes)));
    groupEl.appendChild(bodyEl);

    return groupEl;
  }

  function renderCard(attempt: Attempt, outcomes: Outcome[]) {
    const card = document.createElement('div');
    card.className = 'attempt-card';
    card.dataset.attemptId = attempt.id;

    const time = new Date(attempt.loggedAt).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const badgeClass = BADGE_CLASS[getCategory(outcomes, attempt.outcome)];

    const html = `
        <div class="attempt-main-row">
          <div class="attempt-left">
            <span class="attempt-time">${time}</span>
            ${fieldBadges(attempt)}
            <span class="attempt-status-badge ${badgeClass}">${escapeHtml(attempt.outcome)}</span>
          </div>
          <div class="attempt-right">
            <button type="button" class="edit-btn" data-id="${attempt.id}">Edit</button>
          </div>
        </div>
      `;
    card.innerHTML = html;
    card.querySelector('.edit-btn')!.addEventListener('click', () => onEdit(attempt.id));
    return card;
  }

  /** The activity's fields as badges, in config order. Fields it doesn't list aren't shown. */
  function fieldBadges(attempt: Attempt) {
    return (findActivity(attempt.activity)?.fields ?? [])
      .filter((field) => attempt[field])
      .map((field) => `<span class="grade-badge">${escapeHtml(attempt[field])}</span>`)
      .join('');
  }

  render(store.getState());
  store.subscribe((state, prev) => {
    if (state.attempts !== prev.attempts) render(state);
  });
}
