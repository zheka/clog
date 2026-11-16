/** Element by id; throws if index.html doesn't have it (a bug, not a runtime condition). */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

export function escapeHtml(str: string): string {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Triggers a browser download of a text file. */
export function downloadFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Updates which sides of a sideways-scrolling row have more content (see .scroll-fade-*). */
export function updateScrollFades(row: HTMLElement): void {
  const more = row.scrollWidth - row.clientWidth;
  row.classList.toggle('scroll-fade-left', row.scrollLeft > 1);
  row.classList.toggle('scroll-fade-right', more - row.scrollLeft > 1);
}

/** Keeps a row's edge fades in sync with its scrolling; call `updateScrollFades` after filling it. */
export function trackScrollFades(row: HTMLElement): void {
  row.addEventListener('scroll', () => updateScrollFades(row), { passive: true });
}

/** The keyboard's action key shows "Done" and closes the keyboard; nothing is submitted. */
export function closeKeyboardOnDone(input: HTMLInputElement): void {
  input.enterKeyHint = 'done';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });
}

/** How long a two-tap button waits for the confirming second tap. */
const CONFIRM_MS = 4000;

/**
 * Two-tap confirmation inside the button itself: the first tap changes its label to
 * `confirmLabel`; a second tap within a few seconds runs `action`, otherwise it resets.
 * Returns a function that resets the button (e.g. when its sheet closes).
 */
export function twoTapButton(
  button: HTMLElement,
  confirmLabel: string,
  action: () => void,
): () => void {
  const label = button.textContent;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reset = () => {
    clearTimeout(timer);
    timer = undefined;
    button.textContent = label;
    button.classList.remove('confirming');
  };
  button.addEventListener('click', () => {
    if (timer === undefined) {
      button.textContent = confirmLabel;
      button.classList.add('confirming');
      timer = setTimeout(reset, CONFIRM_MS);
      return;
    }
    reset();
    action();
  });
  return reset;
}
