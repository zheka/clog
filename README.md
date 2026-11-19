# clog

Climbing LOGger — a small offline-first web app for logging climbing attempts.
Data lives in the browser's `localStorage`; use the menu to export/import JSON backups.

Live: https://zheka.github.io/clog/

## Development

Requires Node 26 (see `.nvmrc`).

```bash
npm install
npm run dev        # dev server at http://localhost:5190/clog/
npm test           # unit tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ at http://localhost:4190/clog/ (try offline mode and updates)
npm run icons      # regenerate the app icons in public/ from public/icon.svg
```

## Layout

```
index.html            page head and the #app mount point
src/
  main.tsx            startup: load data, create the store and views, render the App
  store.ts            app state (a signal) + the only functions that change it
  config.ts           what the app offers: activities and their fields (edit here)
  core/               pure logic, no DOM or storage
    types.ts            Attempt, Outcome, Kind, Category
    attempt.ts          create and update attempts
    text.ts             cleaning and normalising typed text
    outcomes.ts         outcome categories
    suggestions.ts      location/grade suggestions, quick-pick outcomes
    sessions.ts         grouping attempts into sessions
  data/
    storage.ts          localStorage read/write
    backup.ts           JSON backup format "clog 0.1.0" (export, strict import)
  ui/                 Preact components
    App.tsx             the page: header, problem screen, history, + button, sheets
    HistoryView.tsx     the attempt list, grouped into sessions
    attemptForm.ts      the attempt form's state (signals) and actions, no markup
    AttemptSheet.tsx    new/edit attempt sheet (context, activity fields, outcome, delete)
    TextField.tsx       a required text field with its chip row
    OutcomeField.tsx    outcome input, outcome chips and new-outcome chips
    ChipRow.tsx         one-line chip row that scrolls sideways, with edge fades
    DoneInput.tsx       text input whose keyboard key is "Done"
    MenuSheet.tsx       backup menu and app version
    ProblemScreen.tsx   shown instead of the app when saved data can't be used
    TwoTapButton.tsx    two-tap confirmation inside a button
    Chevron.tsx, dom.ts small shared pieces
  style.css
  app.test.ts         UI tests: the whole app in jsdom
  **/*.test.ts        unit tests next to the code they test
```

See docs/design.md for the data model and decisions.

Data flows one way: UI event → store action → new state → saved → views that read it update.

## Installing on a phone

CLog is a PWA: open https://zheka.github.io/clog/ in Chrome and choose **Install app** (or
**Add to Home screen**). It then opens full-screen and works offline; the data stays on the
device. A new version downloads in the background and takes over on the next launch, or right
away from the menu (**App Version**).

## Dependencies

The only runtime dependencies are `preact` and `@preact/signals` (the UI); everything else
in `package.json` is build tooling. CI runs
`npm audit --omit=dev`, which covers what ships. For the tooling, `overrides` in `package.json`
force patched `minimatch` and `glob`. The remaining low advisory (`deepmerge`, used by Workbox
to build the offline cache) has no patched release; it only merges our own build config.
Drop the overrides once the tools depend on fixed versions themselves.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) lints, tests and builds every PR,
and deploys `dist/` to GitHub Pages on every push to `main`.
