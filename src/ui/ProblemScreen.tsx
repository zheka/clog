import { signal } from '@preact/signals';
import { render } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { byId, downloadFile } from './dom';
import { TwoTapButton } from './TwoTapButton';

interface Problem {
  problems: string[];
  /** The saved text, unchanged. */
  raw: string;
  onStartFresh: () => void;
}

const current = signal<Problem | null>(null);

/**
 * Mounts the problem screen (hidden until `showProblemScreen`). Shown instead of the app when
 * the saved data can't be used, with two ways out: download the data, or start fresh.
 */
export function mountProblemScreen(): void {
  render(<ProblemScreen />, byId('problemRoot'));
}

export function showProblemScreen(problems: string[], raw: string, onStartFresh: () => void) {
  current.value = { problems, raw, onStartFresh };
}

function ProblemScreen() {
  const problem = current.value;
  // Hides the rest of the app (see .problem-mode in style.css), before the page is shown.
  useLayoutEffect(() => {
    document.body.classList.toggle('problem-mode', problem !== null);
  }, [problem]);
  return (
    <section id="problemScreen" class="problem-screen" hidden={!problem}>
      <h2>Saved data can't be used</h2>
      <p>
        The data saved in this browser doesn't match this version of the app. Download it to fix it
        at your desk, or start fresh to keep logging now (this deletes the saved data).
      </p>
      <pre id="problemList" class="problem-list">
        {problem?.problems.join('\n')}
      </pre>
      <button
        type="button"
        id="downloadSavedDataBtn"
        class="problem-btn"
        onClick={() => {
          if (!problem) return;
          const date = new Date().toISOString().slice(0, 10);
          downloadFile(
            `clog_saved_data_${date}.json`,
            problem.raw,
            'application/json;charset=utf-8;',
          );
        }}
      >
        Download saved data
      </button>
      <TwoTapButton
        id="startFreshBtn"
        class="problem-btn danger"
        label="Start fresh"
        confirmLabel="Tap again to delete saved data"
        onConfirm={() => {
          const startFresh = problem?.onStartFresh;
          current.value = null;
          startFresh?.();
        }}
      />
    </section>
  );
}
