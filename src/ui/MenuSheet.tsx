import { signal } from '@preact/signals';
import { render } from 'preact';
import { useRef } from 'preact/hooks';
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
  const open = signal(false);
  const updateStatus = signal(updates.status());
  updates.subscribe((status) => (updateStatus.value = status));
  byId('openMenuBtn').addEventListener('click', () => (open.value = true));

  function MenuSheet() {
    const fileInput = useRef<HTMLInputElement>(null);
    const close = () => (open.value = false);

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
          `Importing this backup will completely REPLACE your existing ${existing} local attempts with the ${backup.attempts.length} attempts from the file.\n\nProceed?`,
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
      const input = fileInput.current!;
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importBackup(reader.result as string);
        } catch (err) {
          alert('Failed to import JSON file: ' + (err as Error).message);
        } finally {
          input.value = ''; // allow choosing the same file again
        }
      };
      reader.readAsText(file);
    }

    return (
      <div
        id="menuModalOverlay"
        class={open.value ? 'modal-overlay active' : 'modal-overlay'}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div class="modal-sheet">
          <div class="modal-header">
            <span class="modal-title">Data & Backup</span>
            <button id="closeMenuModalBtn" class="close-btn" onClick={close}>
              &times;
            </button>
          </div>
          <div class="menu-actions">
            <MenuAction
              id="exportJsonBtn"
              title="Export Backup (JSON)"
              sub="Download versioned file with all attempts"
              icon="↑"
              onClick={exportBackup}
            />
            <MenuAction
              id="importJsonBtn"
              title="Import Backup (JSON)"
              sub="Restore attempts from a backup file"
              icon="↓"
              onClick={() => fileInput.current?.click()}
            />
            <MenuAction
              id="appUpdateBtn"
              title="App Version"
              sub={`${__APP_VERSION__} · ${UPDATE_TEXT[updateStatus.value]}`}
              subId="appUpdateStatus"
              icon="↻"
              onClick={() => (updates.status() === 'ready' ? updates.apply() : updates.check())}
            />
          </div>
          <input
            type="file"
            id="importFileInput"
            ref={fileInput}
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={onFileChosen}
          />
        </div>
      </div>
    );
  }

  render(<MenuSheet />, byId('menuRoot'));
}

interface ActionProps {
  id: string;
  title: string;
  sub: string;
  subId?: string;
  icon: string;
  onClick: () => void;
}

function MenuAction({ id, title, sub, subId, icon, onClick }: ActionProps) {
  return (
    <button type="button" id={id} class="menu-action-btn" onClick={onClick}>
      <div class="menu-action-info">
        <span>{title}</span>
        <span class="menu-action-sub" id={subId}>
          {sub}
        </span>
      </div>
      <span class="menu-action-icon">{icon}</span>
    </button>
  );
}
