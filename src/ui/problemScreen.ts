import { byId, downloadFile, twoTapButton } from './dom';

/**
 * Shown instead of the app when the saved data can't be used. Offers only two ways out:
 * download the saved data (to fix it at the desk), or start fresh (deletes it).
 */
export function showProblemScreen(problems: string[], raw: string, onStartFresh: () => void): void {
  const screen = byId('problemScreen');
  byId('problemList').textContent = problems.join('\n');
  document.body.classList.add('problem-mode');
  screen.hidden = false;

  byId('downloadSavedDataBtn').addEventListener('click', () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`clog_saved_data_${date}.json`, raw, 'application/json;charset=utf-8;');
  });
  twoTapButton(byId('startFreshBtn'), 'Tap again to delete saved data', () => {
    screen.hidden = true;
    document.body.classList.remove('problem-mode');
    onStartFresh();
  });
}
