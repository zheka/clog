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

- `index.html` — markup
- `src/main.ts` — UI and event handling
- `src/storage.ts` — localStorage persistence, JSON backup export/import
- `src/types.ts` — data model types
- `src/style.css` — styles

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) lints, tests and builds every PR,
and deploys `dist/` to GitHub Pages on every push to `main`.
