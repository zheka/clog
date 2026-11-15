const STORAGE_KEY = 'climb_attempts_history';
const OUTCOMES_KEY = 'climb_outcomes_registry';
const CURRENT_VERSION = '1.2.0';

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

function loadData() {
  // Load history
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      const rawAttempts = Array.isArray(parsed) ? parsed : (parsed.attempts || parsed.entries || []);
      history = rawAttempts.map(item => {
        const entry = {
          id: item.id || generateId(),
          loggedAt: item.loggedAt || item.timestamp || new Date().toISOString(),
          kind: ['bouldering', 'route', 'kilterboard'].includes(item.kind) ? item.kind : 'bouldering',
          location: String(item.location || 'Unknown').trim(),
          grade: String(item.grade || '').trim(),
          outcome: String(item.outcome || '').trim()
        };
        if (entry.kind === 'kilterboard' && item.boardAngle !== undefined && item.boardAngle !== null && item.boardAngle !== '') {
          entry.boardAngle = Number(item.boardAngle);
        }
        return entry;
      });
    } catch (e) {
      history = [];
    }
  }

  // Load outcomes registry
  const outcomesData = localStorage.getItem(OUTCOMES_KEY);
  if (outcomesData) {
    try {
      outcomes = JSON.parse(outcomesData);
    } catch (e) {
      outcomes = [];
    }
  } else {
    outcomes = [];
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  localStorage.setItem(OUTCOMES_KEY, JSON.stringify(outcomes));
}

function exportToJSON() {
  if (history.length === 0) {
    alert('No attempts to export.');
    return;
  }
  const cleanAttempts = history.map(item => {
    const attempt = {
      id: item.id,
      loggedAt: item.loggedAt,
      kind: item.kind,
      location: item.location,
      grade: item.grade,
      outcome: item.outcome
    };
    if (item.kind === 'kilterboard' && item.boardAngle !== undefined && item.boardAngle !== null && !isNaN(item.boardAngle)) {
      attempt.boardAngle = Number(item.boardAngle);
    }
    return attempt;
  });

  const sortedOutcomes = [...outcomes].sort((a, b) => a.name.localeCompare(b.name));
  const backupPayload = {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    outcomes: sortedOutcomes,
    attempts: cleanAttempts
  };

  const jsonContent = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `clog_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  closeMenuModal();
}

function handleJSONImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      const importedAttempts = Array.isArray(parsed) ? parsed : (parsed.attempts || parsed.entries || []);
      const validAttempts = importedAttempts.filter(item => {
        return item && (item.loggedAt || item.timestamp) && item.location && item.grade && item.outcome;
      });

      if (validAttempts.length === 0) {
        alert('No valid climbing attempts found in the selected file.');
        return;
      }

      if (history.length > 0) {
        const confirmReplace = confirm(`Importing this backup will completely REPLACE your existing ${history.length} local entries with the ${validAttempts.length} entries from the file.\n\nProceed?`);
        if (!confirmReplace) {
          importFileInput.value = '';
          return;
        }
      }

      if (parsed.outcomes && Array.isArray(parsed.outcomes)) {
        outcomes = parsed.outcomes;
      } else if (parsed.customOutcomes && Array.isArray(parsed.customOutcomes)) {
        outcomes = parsed.customOutcomes;
      }

      const seenIds = new Set();
      history = validAttempts.map(entry => {
        let id = entry.id;
        if (!id || seenIds.has(String(id))) {
          id = generateId();
        }
        seenIds.add(String(id));
        const mapped = {
          id: id,
          loggedAt: entry.loggedAt || entry.timestamp,
          kind: ['bouldering', 'route', 'kilterboard'].includes(entry.kind) ? entry.kind : 'bouldering',
          location: String(entry.location).trim(),
          grade: String(entry.grade).trim(),
          outcome: String(entry.outcome).trim()
        };
        if (mapped.kind === 'kilterboard' && entry.boardAngle !== undefined && entry.boardAngle !== null && entry.boardAngle !== '') {
          mapped.boardAngle = Number(entry.boardAngle);
        }
        return mapped;
      });

      history.sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt));
      saveData();
      renderHistory();
      updateOutcomesDatalist();
      closeMenuModal();
      alert(`Successfully imported ${validAttempts.length} attempts.`);
    } catch (err) {
      alert('Failed to import JSON file: ' + err.message);
    } finally {
      importFileInput.value = '';
    }
  };
  reader.readAsText(file);
}