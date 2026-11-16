import { backupFileName, createBackup, parseBackup } from '../data/backup';
import { removeLegacyData } from '../data/storage';
import type { UpdateStatus, Updates } from '../pwa';
import type { Store } from '../store';
import { byId, downloadFile } from './dom';

const UPDATE_TEXT: Record<UpdateStatus, string> = {
  unavailable: 'updates work in the installed app',
  'up-to-date': 'up to date · tap to check',
  checking: 'checking for updates…',
  ready: 'update ready · tap to install',
  offline: "couldn't check (offline?) · tap to retry",
};

/** The "Data & Backup" sheet: JSON export and import, and the app version with updates. */
export function mountMenuModal(store: Store, updates: Updates): void {
  const overlay = byId('menuModalOverlay');
  const fileInput = byId<HTMLInputElement>('importFileInput');

  const open = () => overlay.classList.add('active');
  const close = () => overlay.classList.remove('active');

  function exportBackup() {
    const { attempts, outcomes } = store.getState();
    if (attempts.length === 0) {
      alert('No attempts to export.');
      return;
    }
    const json = JSON.stringify(createBackup(attempts, outcomes), null, 2);
    downloadFile(backupFileName(), json, 'application/json;charset=utf-8;');
    close();
  }

  function importBackup(text: string) {
    const backup = parseBackup(text);
    if (backup.attempts.length === 0) {
      alert('No valid climbing attempts found in the selected file.');
      return;
    }
    const existing = store.getState().attempts.length;
    if (
      existing > 0 &&
      !confirm(
        `Importing this backup will completely REPLACE your existing ${existing} local entries with the ${backup.attempts.length} entries from the file.\n\nProceed?`,
      )
    ) {
      return;
    }
    store.replaceAll(backup.attempts, backup.outcomes);
    // The data is now saved under the new key, so the pre-0.1.0 copy is no longer needed.
    removeLegacyData();
    close();
    alert(`Successfully imported ${backup.attempts.length} attempts.`);
  }

  function onFileChosen() {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importBackup(reader.result as string);
      } catch (err) {
        alert('Failed to import JSON file: ' + (err as Error).message);
      } finally {
        fileInput.value = ''; // allow choosing the same file again
      }
    };
    reader.readAsText(file);
  }

  const updateStatus = byId('appUpdateStatus');
  const showUpdateStatus = (status: UpdateStatus) => {
    updateStatus.textContent = `${__APP_VERSION__} · ${UPDATE_TEXT[status]}`;
  };
  showUpdateStatus(updates.status());
  updates.subscribe(showUpdateStatus);
  byId('appUpdateBtn').addEventListener('click', () => {
    if (updates.status() === 'ready') updates.apply();
    else updates.check();
  });

  byId('openMenuBtn').addEventListener('click', open);
  byId('closeMenuModalBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  byId('exportJsonBtn').addEventListener('click', exportBackup);
  byId('importJsonBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', onFileChosen);
}
