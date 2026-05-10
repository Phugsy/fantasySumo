# Fantasy Sumo

Fantasy Sumo is an unfinished fantasy sports app for professional sumo.

Players should be able to choose a team of rikishi at the start of a basho, then score points based on those rikishi's results during the tournament.

The current codebase has been reset onto the clean rebuild foundation described in `docs/adr/0001-rebuild-architecture.md`. The old React 16, webpack, Express, and MySQL prototype has been removed from active runtime code.

## Current functionality

At present, the app has only foundation smoke functionality:

- A Vite + React front-end smoke page.
- A Fastify API with `GET /api/health`.
- A shared TypeScript domain package placeholder.
- Vitest, ESLint, and Prettier wired through pnpm scripts.

It is not yet a playable fantasy game.

## Tech Stack

- pnpm workspace
- TypeScript
- Vite
- React
- Fastify
- Vitest
- ESLint
- Prettier

## Documentation

Start here:

- `AGENTS.md` - guidance for AI coding agents working on the repo.
- `docs/PROJECT_BRIEF.md` - product intent and MVP definition.
- `docs/ARCHITECTURE.md` - current architecture and suggested future boundaries.
- `docs/adr/0001-rebuild-architecture.md` - accepted rebuild architecture decision.
- `docs/MODERNISATION_PLAN.md` - safe path for updating or rebuilding the app.
- `docs/ROADMAP.md` - staged product/engineering roadmap.

## Local setup

Use Node 24 and pnpm. The repo declares its Node version in `.nvmrc` and its package manager in `package.json`.

Install dependencies:

```bash
pnpm install
```

Run both the API and web dev servers:

```bash
pnpm dev
```

Local URLs:

- Web: `http://localhost:5173`
- API health: `http://localhost:3000/api/health`

Useful checks:

```bash
pnpm build
pnpm test
pnpm lint
pnpm format:check
```

## Security note

No database or secrets are used by the active foundation. Keep secrets out of source control as data import and persistence are added later.

## Recommended next steps

1. Decide the first concrete MVP slice after the foundation.
2. Add scoring v0 in the domain package with focused tests.
3. Add the database package and migration setup when persistence work starts.
4. Implement the smallest playable MVP: pick a team, enter/import results, calculate scores, show leaderboard.
