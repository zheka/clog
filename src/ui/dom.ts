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
