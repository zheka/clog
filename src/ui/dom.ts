/**
 * A popup for when the browser's storage fails (full, or blocked for this site): something the
 * app can't fix itself. `what` says what didn't happen, e.g. "Couldn't save the attempt".
 */
export function alertStorageProblem(what: string, err: unknown): void {
  // A DOMException (e.g. QuotaExceededError) has a message but isn't always an Error.
  const reason = (err as { message?: unknown } | null)?.message ?? String(err);
  alert(`${what}: ${reason}\n\nThe browser's storage may be full, or blocked for this site.`);
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

/** Which sides of a sideways-scrolling row have more content to swipe to. */
export interface ScrollFades {
  left: boolean;
  right: boolean;
}

export function scrollFades(row: HTMLElement): ScrollFades {
  const more = row.scrollWidth - row.clientWidth;
  return { left: row.scrollLeft > 1, right: more - row.scrollLeft > 1 };
}
