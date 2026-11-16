# Clog design

Decisions for the next iterations of Clog: fixing UI quirks and the new data model
(backup format `clog 0.1.0`).

Status (2026-11-16): agreed. Steps 1–3 of the implementation plan are done; the rest
describes where the app is going. Where the app differs from this document, the code and
its tests describe the current behaviour.

## Goals and principles

- **Purpose.** Log climbing attempts so their history can be analysed over time (by an AI) to
  help with training periodization, session focus, and volume/effort recommendations.
- **Personal tool first.** Built for my own use. Friendliness to new users is secondary.
- **Fastest possible logging.** Every tap counts while training: no confirmations for adding or
  editing, prefill everything, one tap to log.
- **Concepts are still evolving.** Data must stay easy to inspect, back up, and fix with scripts.
- **Where configuration lives:**
  - what the user can **enter in the app** (outcomes and their categories) is data and lives in
    the **backup**;
  - everything else (activities, their fields, category colours, constants) is **built into the
    code**, in one explicit, typed, easy-to-edit file: `src/config.ts`.

## Names

The reference list of every name in the schema. Everything else in this document uses them.

**Backup file**

| Name         | Meaning                                                   |
| ------------ | --------------------------------------------------------- |
| `version`    | `"clog 0.1.0"`: marks the file as a Clog backup + version |
| `exportedAt` | when the file was written (ISO timestamp)                 |
| `outcomes`   | the outcome list                                          |
| `attempts`   | the log                                                   |

**Outcome**

| Name       | Meaning                                    |
| ---------- | ------------------------------------------ |
| `name`     | the outcome's id, normalised (e.g. `fell`) |
| `category` | `success`, `failure` or `work`             |

**Attempt**

| Name       | Meaning                                                  |
| ---------- | -------------------------------------------------------- |
| `id`       | random UUID, generated once, never changes               |
| `loggedAt` | when the entry was **made**, not when the climb happened |
| `activity` | `boulder`, `route` or `kilter`                           |
| `location` | gym or outdoor sector, free text                         |
| `outcome`  | the `name` of an outcome from `outcomes`                 |
| `grade`    | activity field (all activities), free text               |
| `angle`    | activity field of `kilter`, free text (e.g. `"40"`)      |

**Code configuration (`src/config.ts`)**

| Name                | Meaning                                                 |
| ------------------- | ------------------------------------------------------- |
| `fields`            | activity fields, each defined once with its properties  |
| `activities`        | the activity list, in tab order                         |
| `name`              | activity name                                           |
| `fields` (activity) | the fields this activity uses, in form order            |
| `categoryColors`    | colour of each category                                 |
| `sameSessionHours`  | how recent the last attempt must be to collapse context |
| `maxChips`          | most chips in one chip row                              |

**Elsewhere**

| Name                                                | Meaning                                                  |
| --------------------------------------------------- | -------------------------------------------------------- |
| `clog`                                              | the `localStorage` key: one value shaped like the backup |
| `climb_attempts_history`, `climb_outcomes_registry` | legacy keys of the current app (see Switching over)      |
| `npm run backup -- …`                               | backup scripts (see Fixing files)                        |

## Data model

### Attempt

An attempt has a fixed **context header** (`activity`, `location`, `loggedAt`), a fixed
**outcome footer** (`outcome`), and in between the **activity fields** its activity lists (e.g.
`grade`, or `angle` and `grade`). The record is flat:

```json
{
  "id": "6f1c…",
  "loggedAt": "2026-11-14T19:40:12.000Z",
  "activity": "kilter",
  "location": "BW Ost",
  "angle": "40",
  "grade": "v5",
  "outcome": "fell"
}
```

| Field             | In the form                          |
| ----------------- | ------------------------------------ |
| `id`              | –                                    |
| `loggedAt`        | context                              |
| `activity`        | context                              |
| `location`        | context                              |
| _activity fields_ | per attempt, in the activity's order |
| `outcome`         | per attempt; tapping it saves        |

**Context vs per-attempt.** The test is _how often a value changes during a session_:

- changes rarely (once per block) → **context**: activity, location (and time, if made
  editable);
- changes often (between attempts) → **activity fields** and the outcome.

**Grades are deliberately vague.** Scales differ between gyms and drift over time; boards are
the exception. For analysis the effective grade is `location + grade` (+ `angle`). The app does
not model grade scales or "grade frames": with enough data, the AI infers real difficulty by
comparing outcomes.

**No problem identity.** Linking attempts on the same problem is too costly in bouldering (20+
problems per session, with revisits), so attempts are not linked. Analysis works with
aggregates (send rate and volume per grade per session, over time).

**Time.** Attempts are usually logged in a batch after or late in the session, so `loggedAt`
is the entry time. Analysis should rely on the order of attempts within a group, not on gaps
between timestamps.

### Activities (built into the code)

An activity is an objective type of effort, named as a shortened activity: `boulder`(ing),
`route` (climbing), `kilter`(boarding). Values that change often within a session (like the
board angle) are **activity fields**, not separate activities.

```ts
// src/config.ts (sketch)
export const config = {
  // Each activity field, defined once. Properties are examples; see Open questions.
  fields: {
    grade: { display: 'badge' },
    angle: { display: 'tag', suffix: '°' },
  },
  // Each activity lists the fields it uses, in form order.
  activities: [
    { name: 'boulder', fields: ['grade'] },
    { name: 'route', fields: ['grade'] },
    { name: 'kilter', fields: ['angle', 'grade'] },
    // { name: 'old activity', fields: ['grade'], retired: true }, // kept for history, not offered
  ],
  categoryColors: {
    success: '#2e9e4f',
    failure: '#d64545',
    work: '#8a8a99',
  },
  sameSessionHours: 4,
  maxChips: 8,
} satisfies AppConfig;
```

- Activities appear as tabs in this order.
- Activity fields appear in the form in the listed order, between the context and the outcome.
  All are free text with recency chips, per attempt, required, and prefilled. Grade is one of
  them, not a special field, so an activity without a grade is possible.
- **Each field is defined once** in `fields`, with its properties (e.g. how it is displayed on
  history cards, a unit suffix; later perhaps label, placeholder, chip count). A field looks and
  behaves the same in every activity that uses it. The exact properties are a UX decision.
- History cards show the activity fields in the listed order, styled by their properties.
- The fixed fields (`activity`, `location`, `loggedAt`, `outcome`) have built-in presentation
  and are not listed in `fields`.
- Activity-field names are keys in the flat attempt record, next to the fixed ones, so they
  follow these rules (checked by `src/config.test.ts`):
  - **not reserved:** none of `id`, `loggedAt`, `activity`, `location`, `outcome`, or the
    future sync fields `updatedAt`, `deletedAt`. A field `location` would overwrite the context
    location;
  - **simple:** lowercase letters and digits, starting with a letter (`angle`, `holds2`), so
    they work as JSON keys, CSV columns and spreadsheet headers without quoting;
  - **defined:** every field an activity lists exists in `fields` (an unused definition is
    allowed);
  - **unique within an activity**;
  - **the same name means the same thing in every activity:** `angle` on two boards is one
    column in the export, so do not reuse a name for something different.
- Activity names are values of the `activity` field, not keys, so they cannot clash with field
  names. They must be unique and normalised like outcome names.
- Renaming or removing an activity that saved data uses needs a migration (or `retired: true`).
- Suspended for now: a `style` field for `route` (autobelay, lead, top rope, lead placing
  draws).

### Outcomes and categories (in the backup)

- **One outcome list** for all activities. Recency brings the relevant ones to the front.
- An outcome is `{ "name": "fell", "category": "failure" }`. **The name is its id.**
- **Names are normalised** (see Normalisation and matching): `Fell  At Crux` is stored as
  `fell at crux`.
- **Categories are fixed in the app**, colours included:
  - `success`: sent;
  - `failure`: a real attempt that did not go;
  - `work`: effort without a performance result (learning a route, bailing for
    non-performance reasons).
- Attempts store only the outcome name. Changing an outcome's category changes how past
  attempts are shown and analysed (intended). Renaming an outcome needs a script.
- A fresh install has **no outcomes**. They are created in the form or come from a backup.

## Normalisation and matching

User input falls into two classes: **names**, which are ids, and **values**, where letter case
can carry meaning (`6a` vs `6A`).

**Cleaning** applies to everything the user types, before it is stored or compared:

1. Unicode NFC (an accented letter typed in two different ways becomes the same characters);
2. trim spaces at both ends;
3. collapse any run of whitespace (spaces, tabs, line breaks) into one space.

A value that is empty after cleaning is empty, so a required field refuses to save.

| Class      | Examples                                              | Stored as               | Same when         |
| ---------- | ----------------------------------------------------- | ----------------------- | ----------------- |
| **Names**  | outcome names; activity and field names in the config | cleaned + **lowercase** | equal             |
| **Values** | location, grade, angle, any activity field            | cleaned, **case kept**  | **exactly** equal |

- `BW Ost` and `bw ost` are **two different locations**, and `6a` and `6A` two different grades.
  The app never rewrites the case of a value. Tapping a chip reuses an existing spelling.
- No other folding: `Öst` ≠ `Ost`, `40` ≠ `40°`, `BW Ost` ≠ `BW-Ost`.
- Chips show each distinct value once, most recent first.

**Matching in the form**

| Where                         | Rule                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Chips filter while typing     | **ignores case**: the value contains the typed text (`crux` → `fell at crux`, `6a` → `6a` and `6A`) |
| Custom outcome already exists | the normalised typed name equals an outcome name: saving is disabled                                |
| Typos                         | not handled (`flsh` does not match `flash`)                                                         |

**Import.** Files must already be clean: an outcome name that is not normalised (`Flash`) or a
value that is not cleaned (`" BW Ost"`) makes the import refuse, like any other problem. The
`check` script reports such problems and `convert-legacy` produces clean files.

## Backup format

One JSON file holds the complete backup (outcomes + attempts), for full restore and for scripts.

```json
{
  "version": "clog 0.1.0",
  "exportedAt": "2026-11-16T09:00:00.000Z",
  "outcomes": [
    { "name": "flash", "category": "success" },
    { "name": "fell", "category": "failure" },
    { "name": "learning", "category": "work" }
  ],
  "attempts": []
}
```

### Versioning

`version` is `"clog <semver>"`: one field both marks the file as a Clog backup and versions
it. It is the **schema** version, independent of app releases. The format starts at `0.1.0`.

While the version is `0.x` (the format is still settling):

- **Minor** (`0.1` → `0.2`): may break, e.g. a field renamed, removed, or changed in meaning.
  Needs a migration.
- **Patch** (`0.1.0` → `0.1.1`): a new optional field or a clarification. Older files stay
  valid.

The app accepts a file with **the same `0.minor` and a patch up to its own**. Newer files
("update the app") and older minors ("run the upgrade script") are refused. From `1.0.0` on,
the usual rules apply (major breaks, minor adds).

### Import is strict

Import **replaces all data** (no merge) and is **all-or-nothing**. Nothing is silently fixed;
a file with any problem is refused with a report of what is wrong, for example:

```
Import refused: 3 problems
  attempt #12 (id 6f1c…): outcome "flashh" is not defined
  attempt #40: missing grade
  version "1.2.0" is not supported: run `npm run backup -- convert-legacy file.json`
```

Checks include: version, unknown activity, unknown outcome, outcome with an unknown category,
missing or duplicate ids, invalid timestamps, non-text field values, and required built-in fields.

**Evolving fields.** "All fields required" is enforced by the **form** when saving, not on
stored or imported data. Attempts may lack a field added to their activity later, and
fields no longer listed for an activity are kept and exported as they are.

### Saved data: checked on load, migrated silently

The app keeps its data under the single `localStorage` key `clog`, in the same shape as the
backup. After a future schema change it is migrated automatically on load, with no migration
UI.

On every load the data is **checked exactly like an import**: version, and consistency with
`config.ts`. Until migrations exist, an older version is simply one more problem. The usual
cause would be our own mistake, e.g. removing an activity from the config that saved data
still uses.

If the check fails, the app does not start. It shows a **problem screen** with the list of
problems and two buttons:

- **Download saved data:** saves the raw data unchanged (`clog_saved_data_<date>.json`) to fix
  at the desk. The data stays in the browser.
- **Start fresh** (two-tap: "Tap again to delete saved data"): deletes the saved data and starts
  the normal app empty, so logging can continue right away.

So there are two ways forward: **stop** until it is fixed (fix the config and deploy, then
reload), or **reset** and keep logging. After a reset, restoring the downloaded data later
needs a merge with what was logged since (a future `merge` script).

Bug reports (saving problems and unexpected errors for download) were discussed and postponed.

### Fixing files: scripts, not app UI

Broken or old backups are fixed outside the app with TypeScript CLI scripts run by Node. They
reuse the app's own validation and migration code, so the app and the scripts never disagree.

```
npm run backup -- check   backup.json                      # validate, list all problems
npm run backup -- upgrade backup.json -o new.json          # migrate to the current version
npm run backup -- rename-outcome backup.json "top=send" -o new.json
npm run backup -- convert-legacy old.json [more.json…] -o new.json   # one-off, see below
```

## Switching over from the current app

The current format (`1.2.0`) is not migrated inside the app. Since there is a single user, the
existing backup is converted once by hand.

1. **Export** a backup from the current app on **every device that has entries** (each browser
   has its own data).
2. **Convert** with `convert-legacy`, which merges several files by attempt id and:
   - sets `"version": "clog 0.1.0"`;
   - normalises outcome names in the outcome list and in attempts, and cleans all values;
     category `skip` → `work`;
   - renames `kind` → `activity` with `bouldering` → `boulder`, `route` → `route`,
     `kilterboard` → `kilter`;
   - turns `boardAngle` (number) into `angle` (text);
   - accepts the legacy shapes (bare array, `entries`, `timestamp`, `customOutcomes`);
   - reports anything it cannot convert (duplicates, missing fields) for fixing by hand.
3. **Deploy** the new version. It starts empty on each device: it reads only the `clog` key.
4. **Import** the converted file on each device.

**Cleanup of the legacy keys.** `climb_attempts_history` and `climb_outcomes_registry` stay
untouched as a fallback until the **first successful import** on that device: the file passes
validation, the data is written to `clog`, and only then are the legacy keys removed. A refused
import or a failed write leaves them in place. Logging before importing does not remove them.
Keep the exported `1.2.0` files until the new version has proven itself. The cleanup code can
be deleted once every device has switched over.

## Entry form

### Prefill and context

- A new attempt is **prefilled from the previous attempt** for every field (the same or a
  similar problem is often climbed many times in a row).
- **Switching activity** in a new entry loads the previous attempt **of that activity** (location
  and fields). With no previous attempt of that activity, or when editing, the location and the
  values of fields both activities have are kept.
- The context section (activity, location) is **collapsed** when the previous attempt is recent
  (`sameSessionHours`), and expanded for the first entry of a session.

### Inputs and chips

Every input, outcome included, is **text first with a chip row below**.

- Every sheet (entry form and backup menu) **opens from the top** of the screen, so the keyboard
  (at the bottom) doesn't cover the fields and their chips.
- The keyboard's action key is **Done**: it closes the keyboard, nothing is saved.
- Each chip row is **one line that scrolls sideways** (it never wraps), with at most
  `maxChips` (8) chips. Every chip is at least 48×48px (Android's
  recommended tap target), and a row without chips takes no space. A **fade at the edge** shows on whichever side
  has more chips to swipe to.

Rules for every chip row:

- **Candidates come in pools**, most recent first within each, each distinct value (exact,
  case kept) once:

  | Chip row        | Pool 1                   | Pool 2         | Pool 3         |
  | --------------- | ------------------------ | -------------- | -------------- |
  | activity fields | same activity + location | same activity  | all activities |
  | location        | same activity            | all activities | –              |
  | outcome         | used with this activity  | used with any  | never used     |

- **Typed text ranks them:** values starting with it first, then values containing it (both
  ignoring case), then the rest as **backfill**, so a row is never empty while there is any
  history. With no text the pool order is kept. All chips look the same.
- A **prefilled value does not filter** the chips; only text the user types does.
- The **highlighted chip is the field's current value**: for a new attempt the previous
  attempt's value, when editing the entry's own value.
- Chip scope: location chips come from the same activity; activity-field chips from the same
  activity and location.
- Filtering while typing ignores case (`bw` shows `BW Ost`); tapping a chip stores exactly that
  spelling (see Normalisation and matching).
- Recency was compared with frequency ordering on the real log: frequency gained little for
  fields and lost for outcomes, so all rows use recency. With 8 chips, about 99% of the values a
  chip can offer were among them; about 85% of all entries in the first 4–5 chips.

### Outcomes

- Tapping an outcome chip **saves the attempt immediately**.
- Outcome chips come **from the outcome list only**; history decides their order.
- The outcome input **starts empty**: the tap is the save, so a prefilled value would do
  nothing. The previous outcome (when editing, the entry's own) is highlighted among the chips.
- **While typing**, the row shows only the matching outcomes (no backfill). For a name that
  doesn't exist yet, a **row of its own below** shows one chip per category (`🟢 name`,
  `🔴 name`, `⚪ name`): tapping one creates the outcome in that category and saves the attempt.
  That row is hidden otherwise, including for an exact match. There is no separate
  custom-outcome block.

### Saving, deleting, messages

- **All fields are required** when saving (location and every activity field); usually they
  are already prefilled. For now the browser `alert` names the missing fields.
- **Editing keeps fields the form doesn't show:** a field defined in `config.fields` but not
  listed for the attempt's activity is kept as it is. Fields the previous activity listed and
  the new one doesn't are dropped (kilter → boulder drops the angle).
- Adding and editing are **instant**: no confirmation, no undo bar (rejected as clutter; may be
  revisited).
- **Destructive actions use a two-tap confirmation inside the button:** "Delete Entry" →
  "Tap again to delete". No dialogs, no browser `confirm()`. The same pattern is used elsewhere,
  e.g. replacing all data on import: "Replace my 118 attempts" → "Confirm replace".
- Messages (validation errors, import results and problems) are shown **inside the form or
  menu**, not with browser `alert()`.

## History view

- Groups **consecutive** attempts by **activity + location + local date**. There is no explicit
  session concept: boulders and the board on the same day appear as two groups.
- The group header shows the date, location and activity (`Nov 15 • TK • route`), with no line
  under it, and the same outline chevron as the entry form's context bar. Cards show the time, **each field the
  activity lists as a badge** in config order, and the outcome badge in its category colour.
  No tags; fields the activity doesn't list are not shown. Decorations such as a `°` suffix
  for the angle will come from field properties.
- Each group is a **frame**, 8px apart; its attempts are borderless blocks inside it. A
  collapsed group is just its framed header. Expanding and collapsing are instant (no
  animation) and have no height limit, so long sessions are shown in full.
- Only the newest group starts expanded. Session summaries (counts, send rate) are for later.
- Unknown outcomes can't appear: imports and saved data are checked, and the form only offers
  outcomes from the list.

## UI quirks: decisions

| Quirk (current app)                           | Decision                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Fresh install has no outcomes                 | Keep. Outcomes come from the form or a backup                                                 |
| Unknown outcomes shown red (as failures)      | Can no longer occur: imports and saved data are checked; the form offers only listed outcomes |
| Editing highlights the most recent outcome    | Highlighted chip = the field's current value                                                  |
| Delete without confirmation                   | Two-tap confirm in the button                                                                 |
| Tapping an outcome saves immediately          | Keep: logging must be one tap                                                                 |
| Interleaving activities splits history groups | Keep: intended                                                                                |
| Outcome capitalisation inconsistent           | Normalised outcome names                                                                      |
| Entry time cannot be edited                   | Low priority; only if very unobtrusive                                                        |
| Import replaces everything                    | Keep: backups are restored as a whole; merging is a job for sync                              |
| Browser `alert()` / `confirm()` popups        | Inline messages and two-tap confirmations                                                     |

## Later

- **Sync (Google Sheets).** Not needed yet: backup/restore replaces everything. Stable unique
  ids are already in place. `updatedAt` and `deletedAt` (tombstones) will be added as optional
  fields (a patch version); until then deletes are real deletes.
- **CSV export for analysis.** One-way. Outcomes are expanded (`fell`, `failure`) so nothing has
  to be guessed. Activity descriptions and other insights are given to the AI separately, not
  stored in the app.

## Open questions

- After real-life testing: the top sheet, outcomes on one line or two, chips above the fields,
  the chip count, whether the edge fade is clear enough (or needs a small arrow).
- Long headers (history and context bar) and long card values wrap for now; shortening with
  "…" was discussed and postponed. Field properties (`suffix`, labels…) when a need shows up.
- Editing an entry's time: how to make it unobtrusive.
- Switching activity in the form loads that activity's previous attempt: confirm.
- A `style` field for `route`: suspended until needed.

## Implementation plan

1. **Done:** `src/config.ts`, the `clog 0.1.0` schema, the `clog` storage key with legacy-key
   cleanup, and strict import (problems are listed in the existing alert for now). The single
   existing backup was converted by a one-off script outside the repo, so a `convert-legacy`
   script is no longer needed.
2. **Done (round 1):** the problem screen for unusable saved data; the generic form (activity
   fields from the config, chip pools with backfill, cleaning without case changes, required
   fields, outcome chips from the list with current-value highlight and filtering, switching
   activity, keeping unlisted fields on edit); badge-only cards; two-tap delete.
3. **Done (round 2, from a UX interview):** entry sheet at the top, Done closes the keyboard,
   one-line chip rows (8, recency), outcome as a text-first field with new-outcome chips,
   spacing cleanup. To test in real life: the top sheet, outcomes on one line vs two, chips above
   the fields, the chip count.
4. **Done: PWA.** Installable as "CLog" (full-screen, climbing-hold icon), works offline,
   asks for persistent storage. Updates download in the background and take over on the next
   launch; the menu's **App Version** item shows the version and can check for and install an
   update right away. The app never reloads by itself.
5. **Next round:** messages inside the form instead of `alert`/`confirm`, two-tap import
   confirmation; field properties when a need shows up.
6. **Later:** the `npm run backup` scripts (`check`, `upgrade`, `rename-outcome`, `merge`), bug
   reports, CSV export, Google Sheets sync.

Each step keeps the current safety net: behaviour changes update the UI tests that pin the
old behaviour.
