/**
 * Cleaning for everything the user types: Unicode NFC, collapse runs of whitespace into one
 * space, trim. Letter case is kept, so `6a` and `6A` stay different values.
 */
export function cleanText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Names (ids such as outcome names) are cleaned and lowercased: `Fell  At` → `fell at`. */
export function normalizeName(text: string): string {
  return cleanText(text).toLowerCase();
}
