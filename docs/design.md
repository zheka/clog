# Clog design

How the app works and why, as it is now. Planned work is marked **Planned**. The reasoning
behind the choices, the alternatives that were rejected and the history of the changes are in
[decisions.md](decisions.md). The code layout is in the [README](../README.md).

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
  - everything else (activities and their fields, constants) is **built into the code**, in one
    explicit, typed file: `src/config.ts`. Category colours are in `src/style.css`.

## Names

The reference list of every name in the schema. The rest of this document uses them.

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

| Name       | Meaning                                                      |
| ---------- | ------------------------------------------------------------ |
| `id`       | random UUID, generated once, never changes                   |
| `loggedAt` | when the attempt was **logged**, not when the climb happened |
| `activity` | `boulder`, `route` or `kilter`                               |
| `location` | gym or outdoor sector, free text                             |
| `outcome`  | the `name` of an outcome from `outcomes`                     |
| `grade`    | activity field (all activities), free text                   |
| `angle`    | activity field of `kilter`, free text (e.g. `"40"`)          |

**Code configuration (`src/config.ts`)**

| Name                | Meaning                                                     |
| ------------------- | ----------------------------------------------------------- |
| `fields`            | activity fields, each defined once (no properties yet)      |
| `activities`        | the activity list, in tab order                             |
| `name`              | activity name                                               |
| `fields` (activity) | the fields this activity uses, in form order                |
| `sameSessionHours`  | how recent the last attempt must be to collapse the context |
| `maxChips`          | most chips in one chip row                                  |

**Elsewhere**

| Name                                                | Meaning                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `clog`                                              | the `localStorage` key: one value shaped like the backup          |
| `climb_attempts_history`, `climb_outcomes_registry` | keys of the pre-0.1.0 app; removed after the first import         |
| `--chip-*`                                          | CSS variables for every chip's size, shape and text (`style.css`) |

## Data model

### Attempt

An attempt has a fixed **context** (`activity`, `location`, `loggedAt`), the **activity fields**
its activity lists (e.g. `grade`, or `angle` and `grade`), and the **outcome**. The record is
flat:

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

**Context vs per-attempt.** The test is _how often a value changes during a session_:

- changes rarely (once per block) → **context**: activity, location;
- changes often (between attempts) → **activity fields** and the outcome.

**Grades are deliberately vague.** Scales differ between gyms and drift over time; boards are
the exception. For analysis the effective grade is `location + grade` (+ `angle`). The app does
not model grade scales: with enough data, the AI infers real difficulty by comparing outcomes.

**No problem identity.** Attempts on the same problem are not linked (too costly to log in
bouldering). Analysis works with aggregates: send rate and volume per grade per session.

**Time.** Attempts are usually logged in a batch after or late in the session, so `loggedAt`
is the logging time. Analysis should rely on the order of attempts within a group, not on the
gaps between timestamps.

### Activities (in the code)

An activity is an objective type of effort, named as a shortened activity: `boulder`(ing),
`route` (climbing), `kilter`(boarding). Values that change often within a session (like the
board angle) are **activity fields**, not separate activities.

```ts
// src/config.ts
export const config: AppConfig = {
  fields: { grade: {}, angle: {} },
  activities: [
    { name: 'boulder', fields: ['grade'] },
    { name: 'route', fields: ['grade'] },
    { name: 'kilter', fields: ['angle', 'grade'] },
  ],
  sameSessionHours: 4,
  maxChips: 8,
};
```

- Activities appear as tabs in this order, named exactly as written (lowercase).
- Activity fields appear in the form in the listed order, between the context and the outcome.
  All are free text with chips, per attempt, required, and prefilled. Grade is one of them, not
  a special field.
- Each field is defined once in `fields`, so it means the same in every activity that uses it.
  **Planned:** field properties (a `°` suffix, a label, a placeholder) when a need shows up.
- Field names are keys in the flat attempt record, so (checked by `src/config.test.ts`) they
  are lowercase letters and digits, not one of `id`, `loggedAt`, `activity`, `location`,
  `outcome`, `updatedAt`, `deletedAt`, defined in `fields`, and unique within an activity.
- Activity names must be unique and normalised like outcome names.
- Renaming or removing an activity or field that saved data uses needs a migration of the data;
  otherwise the next load shows the problem screen.

### Outcomes and categories (in the backup)

- **One outcome list** for all activities. Recency brings the relevant ones to the front.
- An outcome is `{ "name": "fell", "category": "failure" }`. **The name is its id**, normalised:
  `Fell  At Crux` is stored as `fell at crux`.
- **Categories are fixed:**
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

**Cleaning** applies to everything the user types: Unicode NFC, trim, and collapse any run of
whitespace into one space. A value that is empty after cleaning is empty.

| Class      | Examples                                              | Stored as               | Same when         |
| ---------- | ----------------------------------------------------- | ----------------------- | ----------------- |
| **Names**  | outcome names; activity and field names in the config | cleaned + **lowercase** | equal             |
| **Values** | location, grade, angle, any activity field            | cleaned, **case kept**  | **exactly** equal |

- `BW Ost` and `bw ost` are **two different locations**. The app never changes the case of a
  value, also not when displaying it. Tapping a chip reuses an existing spelling.
- No other folding: `Öst` ≠ `Ost`, `40` ≠ `40°`.
- Chip filtering while typing **ignores case**: a value matches if it contains the typed text.
  Typos are not handled (`flsh` does not match `flash`).

## Backup format

One JSON file holds the complete backup (outcomes + attempts), for full restore and for scripts.

```json
{
  "version": "clog 0.1.0",
  "exportedAt": "2026-11-16T09:00:00.000Z",
  "outcomes": [
    { "name": "flash", "category": "success" },
    { "name": "fell", "category": "failure" }
  ],
  "attempts": []
}
```

### Versioning

`version` is `"clog <semver>"`: one field marks the file as a Clog backup and versions it. It
is the **schema** version, independent of app releases. While it is `0.x`:

- **Minor** (`0.1` → `0.2`): may break (a field renamed, removed, or changed in meaning); needs a
  migration.
- **Patch** (`0.1.0` → `0.1.1`): a new optional field or a clarification; older files stay valid.

The app accepts **the same `0.minor` with a patch up to its own**. Newer files ("update the
app") and older minors ("upgrade the file") are refused.

### Import is strict

Import **replaces all data** (no merge) and is **all-or-nothing**: nothing is fixed silently.
A file with any problem is refused with a list of what is wrong, e.g.
`attempt #12 (id 6f1c…): outcome "flashh" is not defined`. Checked: version, unknown activity,
field or outcome, outcome with an unknown category, missing or duplicate ids, invalid times,
non-text values, values or names that are not cleaned or normalised.

"All fields required" is enforced by the **form**, not on stored data: attempts may lack a
field added to their activity later, and a field still defined in `fields` but no longer listed
for an activity is kept (and not shown).

### Saved data

The app keeps its data under the `localStorage` key `clog`, in the same shape as the backup.
On every load it is **checked exactly like an import**. **Planned:** after a schema change, old
saved data is migrated silently on load.

If the check fails, the app shows only a **problem screen**: the list of problems and two
buttons, **Download saved data** (the raw data, unchanged) and a two-tap **Start fresh** (deletes
it and starts the app empty). So you can either stop until it is fixed (usually a config
mistake: fix and deploy) or reset and keep logging.

## Attempt form

### Prefill and context

- A new attempt is **prefilled from the previous attempt** for every field.
- **Switching activity** in a new attempt loads the previous attempt **of that activity**. With
  none, or when editing, the location and the values of fields both activities have are kept.
- The context section (activity, location) is **collapsed** when the previous attempt is recent
  (`sameSessionHours`). An empty location keeps it open.

### Inputs and chips

- Every input, outcome included, is **text first with a chip row below**.
- Sheets (attempt form and backup menu) **open from the top**, so the keyboard (at the bottom)
  doesn't cover the fields. The keyboard's action key is **Done**: it closes the keyboard and
  saves nothing.
- A chip row is **one line that scrolls sideways**, with at most `maxChips` chips, an edge fade
  on the side with more, and no space when empty. All chips are pills of the same size (at least
  64×48px); outcome chips are bold and coloured by category.
- **Candidates come in pools**, most recent first within each, each distinct value once:

  | Chip row        | Pool 1                   | Pool 2         | Pool 3         |
  | --------------- | ------------------------ | -------------- | -------------- |
  | activity fields | same activity + location | same activity  | all activities |
  | location        | same activity            | all activities | –              |
  | outcome         | used with this activity  | used with any  | never used     |

- **Typed text ranks them:** values starting with it, then values containing it, then the rest
  (backfill). A prefilled value does not filter; only typed text does.
- The **highlighted chip is the field's current value**.

### Outcomes

- Tapping an outcome chip **saves the attempt immediately**.
- Outcome chips come **from the outcome list only**; history decides their order.
- The outcome input **starts empty** (the tap is the save); the previous outcome, or when editing
  the attempt's own, is highlighted.
- **While typing**, only matching outcomes are shown (no backfill). For a name that doesn't
  exist yet, a row below offers `🟢 name`, `🔴 name`, `⚪ name`: tapping one creates the outcome
  in that category and saves the attempt.

### Saving and deleting

- **All fields are required.** An empty field shows a red hint ("add grade"), which is never
  part of the value. While any field is empty, the outcome chips are faded and inactive. The
  form shows no popups.
- **Editing keeps fields the form doesn't show** (defined but not listed for the activity).
  Fields the previous activity listed and the new one doesn't are dropped (kilter → boulder
  drops the angle).
- Adding and editing are **instant**: no confirmation.
- **Delete** uses a two-tap confirmation inside the button: "Delete" → "Tap again to delete".

## History view

- Groups **consecutive** attempts by **activity + location + local date**. Boulders and the
  board on the same day appear as two groups.
- A group is a **frame** with a header `Nov 15 • route • TK` (date, activity, location, in the
  form's order, names as stored) and a chevron. Cards show the time, each field the activity
  lists as a badge, and the outcome badge in its category colour.
- Only the newest group starts expanded; groups reset to that whenever attempts change. A
  collapsed group builds no cards. Expanding is instant.

## Backup menu

Export (JSON), import (JSON) and **App Version**, which shows the build and can check for and
install an update. Import and export still report with the browser's `alert`/`confirm`.

## Planned

- **Messages in the menu** instead of `alert`/`confirm`, with a two-tap import confirmation
  showing what the file contains ("Replace my 118 attempts" → "Tap again to replace").
- **Backup scripts** (`npm run backup -- check | upgrade | rename-outcome | merge`), reusing the
  app's own validation, when first needed.
- **CSV export for analysis**, one-way, with outcomes expanded (`fell`, `failure`).
- **Sync** through one JSON file in Google Drive's app folder, in the backup format, merged by
  id. Needs `updatedAt` and `deletedAt` (a patch version); until then deletes are real deletes.

## Open questions

- After real-life use: the top sheets, outcomes on one line or two, chips above the fields, the
  chip count, whether the edge fade is clear enough.
- Long headers and card values wrap; shortening them with "…" was postponed.
- Editing an attempt's time, if it can be made unobtrusive.
- A `style` field for routes (autobelay, lead, top rope…), on hold.
