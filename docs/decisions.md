# Clog decisions

Why the app is the way it is: the decisions, their reasons, and the alternatives that were
rejected, in the order they were made. The current design is in [design.md](design.md).

## 2026-11-15 · Tooling and structure

- **Vite + TypeScript (strict) + Vitest**, built and deployed to GitHub Pages by GitHub
  Actions. Node 26 (the current LTS) via fnm.
- **Structure:** pure logic in `core/`, storage and backups in `data/`, one store that is the
  only place state changes, views in `ui/`.
- **UI tests drive the real page** in jsdom (load the page, click, type, check), so refactors can
  be checked against unchanged behaviour. They pinned the old app's quirks until each was
  decided on deliberately.

## 2026-11-15 · Old quirks

| Quirk                                      | Decision                                                             |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Fresh install has no outcomes              | Keep; no built-in defaults (outcomes come from the form or a backup) |
| Unknown outcomes shown red                 | Can't occur any more: imports and saved data are checked             |
| Editing highlights the most recent outcome | The highlighted chip is the field's current value                    |
| Delete without confirmation                | Two-tap confirmation inside the button                               |
| Tapping an outcome saves immediately       | Keep: logging must be one tap                                        |
| Interleaving activities splits groups      | Keep: intended                                                       |
| Outcome capitalisation inconsistent        | Outcome names are normalised ids                                     |
| Attempt time can't be edited               | Low priority; only if unobtrusive                                    |
| Import replaces everything                 | Keep: merging is a job for sync                                      |

**Rejected:** an undo bar after logging (clutter; may be revisited); confirmations for adding
or editing (cost taps while training).

## 2026-11-15/16 · Data model

- **Kind → activity**, an objective type of effort; values that change often within a session
  (board angle, route style) are fields, not activities.
- **Built-in vs configured:** what the user enters (outcomes) is data in the backup; everything
  else (activities, fields, constants) is code in `config.ts`, because a code change reaches
  every device by itself while a configuration file would need importing on each one.
- **Activity fields** replace fixed grade/angle inputs: all text, all required, all with chips.
- **No grade frames, no problem identity:** the AI infers difficulty from outcomes; linking
  attempts to problems costs too many taps.
- **Fixed categories** `success`/`failure`/`work` (`work` replaces `skip`), because the analysis
  relies on their meaning.
- **Names vs values:** outcome, activity and field names are normalised lowercase ids; values keep
  their case (`6a` ≠ `6A`). The old "reuse the earlier spelling" rewrite was dropped.
- **Backup version `"clog 0.1.0"`:** one field marks and versions the file; a schema version
  (semver) independent of app releases.
- **Strict, all-or-nothing import**; broken or old files are fixed with scripts outside the app
  rather than with migration UI.

## 2026-11-16 · Switching to 0.1.0

The single existing backup (`1.2.0`, 171 attempts) was converted once by a script outside the
repo instead of an in-app migration: outcome names normalised, `skip` → `work`, kinds renamed,
`sent` and `warmup` merged into `send`, `foot out` into `foot slipped`, unused outcomes removed.
The new app reads only the `clog` key; the old keys are removed after the first successful
import on each device.

## 2026-11-16 · Saved data that can't be used

Saved data is checked like an import on every load. When the check fails, a problem screen
offers **Download saved data** and a two-tap **Start fresh**, so you can stop until fixed or reset
and keep logging.

**Rejected:**

- loading anyway with a warning (the app would run on data that breaks its rules);
- starting fresh with a hidden copy (a hidden data split);
- blocking until fixed with no way to keep logging (bad in the gym).

**Postponed:** bug reports (saving problems and unexpected errors in the browser for download).

## 2026-11-16 · Form rounds

**Round 1:** fields from the config, chip pools with backfill, required fields, outcome chips
only from the list, switching activity loads that activity's previous attempt, two-tap delete,
badge-only cards.

**Round 2** (from a UX interview: Android + Chrome; usually grade + outcome change per attempt;
mistakes are fixed by editing from the history):

- sheets open from the top, so the keyboard doesn't cover the fields;
- the keyboard's Done key closes it;
- one-line chip rows that scroll sideways, at most 8 chips;
- the outcome as a text-first field with new-outcome chips per category (replacing the
  custom-outcome block);
- later tweaks: 48px-tall, at least 64px-wide pill chips, even spacing, a chevron instead of
  Change/Hide, white headers without the pin icon, "attempt" instead of "entry" everywhere,
  activity before location in summaries, no forced capitals.

**Measured on the real log (171 attempts):** ordering chips by frequency instead of recency
gained little for fields and lost for outcomes, so all rows use recency; with 8 chips about
99% of the values a chip could offer were among them.

**Rejected:**

- a numeric keyboard for the angle (all fields stay equal);
- resizing the page when the keyboard opens (looks ugly);
- shortening long headers with "…" (postponed);
- remembering which history groups were opened.

**Messages:** the form shows no popups (red "add …" hints and faded save chips instead); the
backup menu keeps `alert`/`confirm` for now.

## 2026-11-16 · PWA

Installable as "CLog" with a climbing-holds icon, offline, persistent storage. Updates download
in the background and take over on the next launch, or right away from the menu's App Version
item; the app never reloads by itself, so an update can't interrupt logging.

## 2026-11-17 · Storage and sync

- **Stay on localStorage** (about 5 MB, roughly 20,000 attempts) until there is a concrete reason
  for IndexedDB: data near 2 MB, slow saves, or sync needing per-record writes.
- **Sync through one JSON file in Google Drive**, in the backup format, merged by id, rather than
  Google Sheets; viewing and analysis come from the separate CSV export.

## 2026-11-17 · Preact

The UI moved from hand-written DOM code to **Preact components with signals** (`preact`,
`@preact/signals`, about 8 KB gzipped): state is a few signals and everything shown is derived
from them, instead of refresh calls that must not be forgotten. The UI tests ran unchanged
before and after. Updates that must not flash on screen use layout effects.

## 2026-11-19 · Clean-up after the audit

Clearer names (`field-badge`, `attempt-status-<category>`, "sheet" ids), dead fallbacks removed,
collapsed history groups build no cards, the store holds its state in a signal read by all
views, the attempt sheet split into form state (`attemptForm.ts`) and small components.

**Testing:** real-browser tests with Playwright on the production build; Testing Library was
discussed and not adopted for now.
