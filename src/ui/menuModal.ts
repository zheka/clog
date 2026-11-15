import { backupFileName, createBackup, parseBackup } from '../data/backup';
import type { Store } from '../store';
import { byId, downloadFile } from './dom';

/** The "Data & Backup" sheet: JSON export and import. */
export function mountMenuModal(store: Store): void {
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

  byId('openMenuBtn').addEventListener('click', open);
  byId('closeMenuModalBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  byId('exportJsonBtn').addEventListener('click', exportBackup);
  byId('importJsonBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', onFileChosen);
}
