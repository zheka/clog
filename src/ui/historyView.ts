import { getCategory } from '../core/outcomes';
import { groupIntoSessions, type Session } from '../core/sessions';
import type { Attempt, Category, Outcome } from '../core/types';
import type { State, Store } from '../store';
import { byId, escapeHtml } from './dom';

const BADGE_CLASS: Record<Category, string> = {
  success: 'entry-status-green',
  failure: 'entry-status-red',
  work: 'entry-status-gray',
};

const PIN_ICON =
  '<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
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
        ${PIN_ICON}
        <span>${escapeHtml(session.location)} &bull; ${escapeHtml(session.activity)} &bull; <span class="group-date">${session.dateString}</span></span>
      </div>
      ${CHEVRON_ICON}
    `;
    headerEl.addEventListener('click', () => groupEl.classList.toggle('collapsed'));
    groupEl.appendChild(headerEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'group-body';
    session.entries.forEach((entry) => bodyEl.appendChild(renderCard(entry, outcomes)));
    groupEl.appendChild(bodyEl);

    return groupEl;
  }

  function renderCard(entry: Attempt, outcomes: Outcome[]) {
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.dataset.entryId = entry.id;

    const time = new Date(entry.loggedAt).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const badgeClass = BADGE_CLASS[getCategory(outcomes, entry.outcome)];

    let html = `
        <div class="entry-main-row">
          <div class="entry-left">
            <span class="entry-time">${time}</span>
            <span class="grade-badge">${escapeHtml(entry.grade)}</span>
            <span class="entry-status-badge ${badgeClass}">${escapeHtml(entry.outcome)}</span>
          </div>
          <div class="entry-right">
            <button type="button" class="edit-btn" data-id="${entry.id}">Edit</button>
          </div>
        </div>
      `;
    if (entry.angle) {
      html += `<div class="entry-details-row"><span class="detail-tag">Angle: ${escapeHtml(entry.angle)}&deg;</span></div>`;
    }
    card.innerHTML = html;
    card.querySelector('.edit-btn')!.addEventListener('click', () => onEdit(entry.id));
    return card;
  }

  render(store.getState());
  store.subscribe((state, prev) => {
    if (state.attempts !== prev.attempts) render(state);
  });
}
