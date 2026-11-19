// @vitest-environment jsdom
/** UI tests: The backup menu: export, import, app version. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_KEYS,
  NOW,
  q,
  $,
  storedData,
  stored,
  storedOutcomes,
  attempt,
  OUTCOMES,
  alertMock,
  confirmMock,
  start,
  useAppTestSetup,
} from './test-app';

useAppTestSetup();

describe('backup menu', () => {
  it('shows the app version (updates only in the installed app)', async () => {
    await start([attempt()]);
    expect($('appUpdateStatus').textContent).toMatch(
      /^\S+ · \d{4}-\d\d-\d\d · updates work in the installed app$/,
    );
    $('appUpdateBtn').click(); // nothing to do outside a production build
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('opens and closes', async () => {
    await start([attempt()]);
    $('openMenuBtn').click();
    expect($('menuSheet').classList.contains('active')).toBe(true);
    $('closeMenuSheetBtn').click();
    expect($('menuSheet').classList.contains('active')).toBe(false);
    $('openMenuBtn').click();
    $('menuSheet').click();
    expect($('menuSheet').classList.contains('active')).toBe(false);
  });

  describe('export', () => {
    let blob: Blob | undefined;
    let downloadName: string | undefined;

    beforeEach(() => {
      blob = undefined;
      downloadName = undefined;
      URL.createObjectURL = vi.fn((b: Blob) => {
        blob = b;
        return 'blob:test';
      });
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloadName = this.getAttribute('download') ?? undefined;
      });
    });

    it('alerts when there is nothing to export', async () => {
      await start(undefined);
      $('openMenuBtn').click();
      $('exportJsonBtn').click();
      expect(alertMock).toHaveBeenCalledWith('No attempts to export.');
      expect(blob).toBeUndefined();
      expect($('menuSheet').classList.contains('active')).toBe(true);
    });

    it('downloads a clog 0.1.0 backup and closes the menu', async () => {
      const outcomes = [
        { name: 'zz', category: 'work' },
        { name: 'aa', category: 'success' },
      ];
      const kilter = attempt({
        id: 'k',
        activity: 'kilter',
        angle: '40',
        loggedAt: '2026-11-14T13:00:00Z',
        outcome: 'aa',
      });
      await start([attempt({ outcome: 'zz' }), kilter], outcomes);
      $('openMenuBtn').click();
      $('exportJsonBtn').click();
      expect(downloadName).toBe('clog_backup_2026-11-15.json');
      expect(blob!.type).toBe('application/json;charset=utf-8;');
      expect(JSON.parse(await blob!.text())).toEqual({
        version: 'clog 0.1.0',
        exportedAt: NOW.toISOString(),
        outcomes: [outcomes[1], outcomes[0]],
        attempts: [attempt({ outcome: 'zz' }), kilter],
      });
      expect($('menuSheet').classList.contains('active')).toBe(false);
    });
  });

  describe('import', () => {
    function importFile(content: string) {
      const input = $<HTMLInputElement>('importFileInput');
      Object.defineProperty(input, 'files', {
        value: [new File([content], 'backup.json')],
        configurable: true,
      });
      input.dispatchEvent(new Event('change'));
    }

    const backup = {
      version: 'clog 0.1.0',
      exportedAt: '2026-11-16T09:00:00.000Z',
      outcomes: [{ name: 'send', category: 'success' }],
      attempts: [
        attempt({ id: 'b2', loggedAt: '2026-11-10T13:00:00Z', outcome: 'send' }),
        attempt({ id: 'b1', loggedAt: '2026-11-10T12:00:00Z', outcome: 'send' }),
      ],
    };
    const legacy = { climb_attempts_history: '[]', climb_outcomes_registry: '[]' };

    it('replaces existing data after confirmation, then removes the legacy keys', async () => {
      await start([attempt()], OUTCOMES, legacy);
      $('openMenuBtn').click();
      importFile(JSON.stringify(backup));
      await vi.waitFor(() =>
        expect(alertMock).toHaveBeenCalledWith('Successfully imported 2 attempts.'),
      );
      expect(confirmMock).toHaveBeenCalledWith(
        'Importing this backup will completely REPLACE your existing 1 local attempts with the 2 attempts from the file.\n\nProceed?',
      );
      expect(storedData().version).toBe('clog 0.1.0');
      expect(stored().map((a) => a.id)).toEqual(['b1', 'b2']);
      expect(storedOutcomes()).toEqual(backup.outcomes);
      expect(document.querySelectorAll('.attempt-card')).toHaveLength(2);
      expect(q('.attempt-status-badge').className).toContain('attempt-status-success');
      expect($('menuSheet').classList.contains('active')).toBe(false);
      for (const key of LEGACY_KEYS) expect(localStorage.getItem(key)).toBeNull();
    });

    it('keeps data and legacy keys when the user cancels', async () => {
      confirmMock.mockReturnValue(false);
      await start([attempt()], OUTCOMES, legacy);
      importFile(JSON.stringify(backup));
      await vi.waitFor(() => expect(confirmMock).toHaveBeenCalled());
      expect(stored().map((a) => a.id)).toEqual(['a1']);
      expect(storedOutcomes()).toEqual(OUTCOMES);
      expect(alertMock).not.toHaveBeenCalled();
      for (const key of LEGACY_KEYS) expect(localStorage.getItem(key)).toBe('[]');
    });

    it('does not ask when there is no local data', async () => {
      await start(undefined, null);
      importFile(JSON.stringify(backup));
      await vi.waitFor(() => expect(alertMock).toHaveBeenCalled());
      expect(confirmMock).not.toHaveBeenCalled();
      expect(stored()).toHaveLength(2);
    });

    it('refuses files with problems, listing them, and keeps everything', async () => {
      await start([attempt()], OUTCOMES, legacy);
      const broken = {
        ...backup,
        attempts: [attempt({ id: 'x', outcome: 'sent', activity: 'ice' })],
      };
      importFile(JSON.stringify(broken));
      await vi.waitFor(() => expect(alertMock).toHaveBeenCalled());
      expect(alertMock.mock.calls[0][0]).toBe(
        'Failed to import JSON file: Import refused: 2 problems\n' +
          '  attempt #1 (id x…): unknown activity "ice"\n' +
          '  attempt #1 (id x…): outcome "sent" is not defined',
      );
      expect(stored().map((a) => a.id)).toEqual(['a1']);
      for (const key of LEGACY_KEYS) expect(localStorage.getItem(key)).toBe('[]');
    });

    it('refuses old-format backups', async () => {
      await start([attempt()]);
      importFile(JSON.stringify({ ...backup, version: '1.2.0' }));
      await vi.waitFor(() => expect(alertMock).toHaveBeenCalled());
      expect(alertMock.mock.calls[0][0]).toMatch(/version "1\.2\.0" is not a clog backup version/);
      expect(stored().map((a) => a.id)).toEqual(['a1']);
    });

    it('rejects files without attempts', async () => {
      await start([attempt()]);
      importFile(JSON.stringify({ ...backup, attempts: [] }));
      await vi.waitFor(() =>
        expect(alertMock).toHaveBeenCalledWith(
          'No valid climbing attempts found in the selected file.',
        ),
      );
      expect(stored().map((a) => a.id)).toEqual(['a1']);
    });

    it('reports invalid JSON', async () => {
      await start([attempt()]);
      importFile('not json');
      await vi.waitFor(() => expect(alertMock).toHaveBeenCalled());
      expect(alertMock.mock.calls[0][0]).toMatch(/^Failed to import JSON file: /);
      expect(stored().map((a) => a.id)).toEqual(['a1']);
    });
  });
});
