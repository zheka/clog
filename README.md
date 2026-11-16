# clog

Climbing LOGger — a small offline-first web app for logging climbing attempts.
Data lives in the browser's `localStorage`; use the menu to export/import JSON backups.

Live: https://zheka.github.io/clog/

## Development

Requires Node 26 (see `.nvmrc`).

```bash
npm install
npm run dev        # dev server at http://localhost:5173/clog/
npm test           # unit tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
```

## Layout

```
index.html            markup
src/
  main.ts             startup: load data, create the store, mount the views
  store.ts            app state + the only functions that change it; subscribe() for updates
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
  ui/
    historyView.ts      the attempt list
    entryModal.ts       new/edit entry sheet
    menuModal.ts        backup menu
    problemScreen.ts    shown instead of the app when saved data can't be used
    dom.ts              small DOM helpers
  style.css
  app.test.ts         UI tests: the whole app in jsdom
  **/*.test.ts        unit tests next to the code they test
```

See docs/design.md for the data model and decisions.

Data flows one way: UI event → store action → new state → saved → subscribed views re-render.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) lints, tests and builds every PR,
and deploys `dist/` to GitHub Pages on every push to `main`.
