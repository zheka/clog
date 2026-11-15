import { generateId } from './core/attempt';
import { getCategory, sortByName } from './core/outcomes';
import { groupIntoSessions } from './core/sessions';
import { matchExistingCasing, quickOutcomes, suggestValues } from './core/suggestions';
import type { Attempt, Category, Kind, Outcome } from './core/types';
import { backupFileName, createBackup, parseBackup } from './data/backup';
import { loadData, saveData } from './data/storage';
import { byId, downloadFile, escapeHtml } from './ui/dom';

let history: Attempt[] = [];
let outcomes: Outcome[] = [];
let editingId: string | null = null;
let selectedKind: Kind = 'bouldering';
let selectedCustomCategory: Category | null = null;

const historyList = byId('historyList');
const openModalBtn = byId('openModalBtn');
const closeModalBtn = byId('closeModalBtn');
const modalOverlay = byId('modalOverlay');
const modalTitle = byId('modalTitle');
const deleteBtn = byId('deleteBtn');

const openMenuBtn = byId('openMenuBtn');
const closeMenuModalBtn = byId('closeMenuModalBtn');
const menuModalOverlay = byId('menuModalOverlay');
const exportJsonBtn = byId('exportJsonBtn');
const importJsonBtn = byId('importJsonBtn');
const importFileInput = byId<HTMLInputElement>('importFileInput');

const contextHeader = byId('contextHeader');
const contextBody = byId('contextBody');
const contextSummaryText = byId('contextSummaryText');
const contextToggleLink = byId('contextToggleLink');

const kindTabs = document.querySelectorAll<HTMLElement>('.kind-tab');
const boardAngleGroup = byId('boardAngleGroup');
const boardAngleInput = byId<HTMLInputElement>('boardAngleInput');
const angleChips = document.querySelectorAll<HTMLElement>('#angleChips .chip-small');

const locationInput = byId<HTMLInputElement>('locationInput');
const gradeInput = byId<HTMLInputElement>('gradeInput');
const locationChips = byId('locationChips');
const gradeChips = byId('gradeChips');
const frequentOutcomesRow = byId('frequentOutcomesRow');

const customOutcomeInput = byId<HTMLInputElement>('customOutcomeInput');
const categorySelectorRow = byId('categorySelectorRow');
const catBtns = document.querySelectorAll<HTMLElement>('.cat-btn');
const saveCustomOutcomeBtn = byId('saveCustomOutcomeBtn');

function updateOutcomesDatalist() {
  const dl = byId('outcomes-list');
  dl.innerHTML = '';
  sortByName(outcomes).forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.name;
    dl.appendChild(opt);
  });
}

function setKind(kind: Kind) {
  selectedKind = kind;
  kindTabs.forEach((tab) => {
    if (tab.dataset.kind === kind) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  if (kind === 'kilterboard') {
    boardAngleGroup.style.display = 'flex';
  } else {
    boardAngleGroup.style.display = 'none';
    boardAngleInput.value = '';
  }
  updateContextSummary();
}

function updateContextSummary() {
  const loc = locationInput.value.trim() || 'Unknown Location';
  contextSummaryText.textContent = `${loc} • ${selectedKind}`;
}

function renderFrequentOutcomes() {
  frequentOutcomesRow.innerHTML = '';
  const freqs = quickOutcomes(history, outcomes);
  const lastOutcome = history.length > 0 ? history[history.length - 1].outcome : null;

  freqs.forEach((outcome) => {
    const cat = getCategory(outcomes, outcome);
    const chip = document.createElement('span');

    // Highlight the last used outcome as preselected
    if (lastOutcome && lastOutcome.toLowerCase() === outcome.toLowerCase()) {
      chip.className = `chip ${cat}`;
      chip.style.outline = '2px solid var(--text)';
    } else {
      chip.className = `chip ${cat}`;
    }

    chip.textContent = outcome;
    chip.addEventListener('click', () => handleOutcomeSelect(outcome));
    frequentOutcomesRow.appendChild(chip);
  });
}

function updateChips(
  fieldKey: 'location' | 'grade',
  inputElem: HTMLInputElement,
  containerElem: HTMLElement,
) {
  containerElem.innerHTML = '';
  const items = suggestValues(history, fieldKey, inputElem.value, editingId);
  items.forEach((text) => {
    const chip = document.createElement('span');
    chip.className = 'chip-small';
    chip.textContent = text;
    chip.addEventListener('click', () => {
      inputElem.value = text;
      updateChips(fieldKey, inputElem, containerElem);
      updateContextSummary();
    });
    containerElem.appendChild(chip);
  });
}

function renderHistory() {
  historyList.innerHTML = '';
  if (history.length === 0) {
    historyList.innerHTML =
      '<div class="empty-state">No attempts logged yet.<br>Tap + to add your first attempt!</div>';
    return;
  }

  const groups = groupIntoSessions(history);

  groups.forEach((group, index) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'group-container';
    const isCollapsed = index !== 0;
    if (isCollapsed) {
      groupEl.classList.add('collapsed');
    }

    const headerEl = document.createElement('div');
    headerEl.className = 'group-header';
    headerEl.innerHTML = `
      <div class="group-header-left">
        <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        <span>${escapeHtml(group.location)} &bull; ${group.kind} &bull; <span style="font-weight: 400; opacity: 0.85;">${group.dateString}</span></span>
      </div>
      <svg class="group-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
    `;

    headerEl.addEventListener('click', () => {
      groupEl.classList.toggle('collapsed');
    });
    groupEl.appendChild(headerEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'group-body';

    group.entries.forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'entry-card';
      card.dataset.entryId = entry.id;

      const dateObj = new Date(entry.loggedAt);
      const timeStr = dateObj.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const cat = getCategory(outcomes, entry.outcome);
      let badgeClass = 'entry-status-gray';
      if (cat === 'success') badgeClass = 'entry-status-green';
      if (cat === 'failure') badgeClass = 'entry-status-red';

      let cardHtml = `
        <div class="entry-main-row">
          <div class="entry-left">
            <span class="entry-time">${timeStr}</span>
            <span class="grade-badge">${escapeHtml(entry.grade)}</span>
            <span class="entry-status-badge ${badgeClass}">${escapeHtml(entry.outcome)}</span>
          </div>
          <div class="entry-right">
            <button type="button" class="edit-btn" data-id="${entry.id}">Edit</button>
          </div>
        </div>
      `;

      let detailsHtml = '';
      if (
        entry.kind === 'kilterboard' &&
        entry.boardAngle !== undefined &&
        entry.boardAngle !== null
      ) {
        detailsHtml += `<span class="detail-tag">Angle: ${entry.boardAngle}&deg;</span>`;
      }

      if (detailsHtml) {
        cardHtml += `<div class="entry-details-row">${detailsHtml}</div>`;
      }

      card.innerHTML = cardHtml;
      card.querySelector<HTMLElement>('.edit-btn')!.addEventListener('click', () => {
        openModalForEdit(entry.id);
      });

      bodyEl.appendChild(card);
    });

    groupEl.appendChild(bodyEl);
    historyList.appendChild(groupEl);
  });
}

function openMenuModal() {
  menuModalOverlay.classList.add('active');
}
function closeMenuModal() {
  menuModalOverlay.classList.remove('active');
}

function openModal() {
  editingId = null;
  modalTitle.textContent = 'New Entry';
  deleteBtn.style.display = 'none';

  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  setKind(lastEntry ? lastEntry.kind || 'bouldering' : 'bouldering');
  locationInput.value = lastEntry ? lastEntry.location || '' : '';
  gradeInput.value = lastEntry ? lastEntry.grade || '' : '';
  if (lastEntry && lastEntry.kind === 'kilterboard' && lastEntry.boardAngle) {
    boardAngleInput.value = String(lastEntry.boardAngle);
  } else {
    boardAngleInput.value = '';
  }

  let shouldExpandContext = true;
  if (lastEntry && lastEntry.loggedAt) {
    const diffHours = (Date.now() - new Date(lastEntry.loggedAt).getTime()) / (1000 * 60 * 60);
    if (diffHours < 2) {
      shouldExpandContext = false;
    }
  }

  if (shouldExpandContext || history.length === 0) {
    contextBody.classList.remove('hidden');
    contextToggleLink.textContent = 'Hide';
  } else {
    contextBody.classList.add('hidden');
    contextToggleLink.textContent = 'Change';
  }

  updateContextSummary();
  updateChips('location', locationInput, locationChips);
  updateChips('grade', gradeInput, gradeChips);
  renderFrequentOutcomes();
  updateOutcomesDatalist();

  customOutcomeInput.value = '';
  categorySelectorRow.style.display = 'none';
  selectedCustomCategory = null;
  catBtns.forEach((b) => (b.className = 'cat-btn'));

  modalOverlay.classList.add('active');
}

function openModalForEdit(id: string) {
  const entry = history.find((item) => item.id === id);
  if (!entry) return;

  editingId = entry.id;
  modalTitle.textContent = 'Edit Entry';
  deleteBtn.style.display = 'block';

  setKind(entry.kind || 'bouldering');
  locationInput.value = entry.location || '';
  gradeInput.value = entry.grade || '';
  if (entry.kind === 'kilterboard' && entry.boardAngle !== undefined) {
    boardAngleInput.value = String(entry.boardAngle);
  } else {
    boardAngleInput.value = '';
  }

  contextBody.classList.add('hidden');
  contextToggleLink.textContent = 'Change';
  updateContextSummary();

  updateChips('location', locationInput, locationChips);
  updateChips('grade', gradeInput, gradeChips);
  renderFrequentOutcomes();
  updateOutcomesDatalist();

  customOutcomeInput.value = '';
  categorySelectorRow.style.display = 'none';
  selectedCustomCategory = null;
  catBtns.forEach((b) => (b.className = 'cat-btn'));

  modalOverlay.classList.add('active');
}

function closeModal() {
  modalOverlay.classList.remove('active');
  editingId = null;
}

function handleOutcomeSelect(chosenOutcome: string) {
  const locVal = matchExistingCasing(history, 'location', locationInput.value);
  const gradeVal = matchExistingCasing(history, 'grade', gradeInput.value);

  if (!locVal || !gradeVal) {
    alert('Please fill in both Location and Grade before selecting an outcome.');
    return;
  }

  let angleVal: number | null = null;
  if (selectedKind === 'kilterboard') {
    const parsedAngle = Number(boardAngleInput.value);
    if (!isNaN(parsedAngle) && boardAngleInput.value.trim() !== '') {
      angleVal = parsedAngle;
    }
  }

  const isEditing = Boolean(editingId);

  if (isEditing) {
    const index = history.findIndex((item) => item.id === editingId);
    if (index !== -1) {
      history[index].kind = selectedKind;
      history[index].location = locVal;
      history[index].grade = gradeVal;
      history[index].outcome = chosenOutcome;
      if (selectedKind === 'kilterboard' && angleVal !== null) {
        history[index].boardAngle = angleVal;
      } else {
        delete history[index].boardAngle;
      }
    }
  } else {
    const newEntry: Attempt = {
      id: generateId(),
      loggedAt: new Date().toISOString(),
      kind: selectedKind,
      location: locVal,
      grade: gradeVal,
      outcome: chosenOutcome,
    };
    if (selectedKind === 'kilterboard' && angleVal !== null) {
      newEntry.boardAngle = angleVal;
    }
    history.push(newEntry);
  }

  saveData(history, outcomes);
  renderHistory();
  closeModal();
}

function exportBackup() {
  if (history.length === 0) {
    alert('No attempts to export.');
    return;
  }
  const json = JSON.stringify(createBackup(history, outcomes), null, 2);
  downloadFile(backupFileName(), json, 'application/json;charset=utf-8;');
  closeMenuModal();
}

function handleJSONImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    try {
      const backup = parseBackup(reader.result as string);

      if (backup.attempts.length === 0) {
        alert('No valid climbing attempts found in the selected file.');
        return;
      }

      if (history.length > 0) {
        const confirmReplace = confirm(
          `Importing this backup will completely REPLACE your existing ${history.length} local entries with the ${backup.attempts.length} entries from the file.\n\nProceed?`,
        );
        if (!confirmReplace) {
          importFileInput.value = '';
          return;
        }
      }

      if (backup.outcomes) {
        outcomes = backup.outcomes;
      }
      history = backup.attempts;

      saveData(history, outcomes);
      renderHistory();
      updateOutcomesDatalist();
      closeMenuModal();
      alert(`Successfully imported ${backup.attempts.length} attempts.`);
    } catch (err) {
      alert('Failed to import JSON file: ' + (err as Error).message);
    } finally {
      importFileInput.value = '';
    }
  };
  reader.readAsText(file);
}

contextHeader.addEventListener('click', () => {
  const isHidden = contextBody.classList.toggle('hidden');
  contextToggleLink.textContent = isHidden ? 'Change' : 'Hide';
});

openModalBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

openMenuBtn.addEventListener('click', openMenuModal);
closeMenuModalBtn.addEventListener('click', closeMenuModal);
menuModalOverlay.addEventListener('click', (e) => {
  if (e.target === menuModalOverlay) closeMenuModal();
});

exportJsonBtn.addEventListener('click', exportBackup);
importJsonBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', handleJSONImport);

kindTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setKind(tab.dataset.kind as Kind);
  });
});

angleChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    boardAngleInput.value = chip.dataset.angle ?? '';
  });
});

locationInput.addEventListener('input', () => {
  updateChips('location', locationInput, locationChips);
  updateContextSummary();
});
gradeInput.addEventListener('input', () => updateChips('grade', gradeInput, gradeChips));

customOutcomeInput.addEventListener('input', () => {
  const val = customOutcomeInput.value.trim();
  if (val.length > 0) {
    categorySelectorRow.style.display = 'flex';
  } else {
    categorySelectorRow.style.display = 'none';
    selectedCustomCategory = null;
    catBtns.forEach((b) => (b.className = 'cat-btn'));
  }
});

catBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    catBtns.forEach((b) => (b.className = 'cat-btn'));
    const cat = btn.dataset.cat as Category;
    selectedCustomCategory = cat;
    if (cat === 'success') btn.className = 'cat-btn selected-success';
    if (cat === 'failure') btn.className = 'cat-btn selected-failure';
    if (cat === 'skip') btn.className = 'cat-btn selected-skip';
  });
});

saveCustomOutcomeBtn.addEventListener('click', () => {
  const outcomeText = customOutcomeInput.value.trim().toLowerCase();
  if (!outcomeText) {
    alert('Please enter an outcome name.');
    return;
  }
  if (!selectedCustomCategory) {
    alert('Please select whether this outcome is a Success, Failure, or Skip.');
    return;
  }

  // 1. Add to outcomes registry if not already present
  if (!outcomes.some((o) => o.name.toLowerCase() === outcomeText)) {
    outcomes.push({ name: outcomeText, category: selectedCustomCategory });
  }

  // 2. Persist immediately to localStorage
  saveData(history, outcomes);

  // 3. Update datalist hints and chips instantly
  updateOutcomesDatalist();
  renderFrequentOutcomes();

  // 4. Log the attempt
  handleOutcomeSelect(outcomeText);
});

deleteBtn.addEventListener('click', () => {
  if (editingId) {
    history = history.filter((item) => item.id !== editingId);
    saveData(history, outcomes);
    renderHistory();
    closeModal();
  }
});

({ attempts: history, outcomes } = loadData());
renderHistory();
