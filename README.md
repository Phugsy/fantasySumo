# Fantasy Sumo

Fantasy Sumo is an unfinished fantasy sports app for professional sumo.

Players should be able to choose a team of rikishi at the start of a basho, then score points based on those rikishi's results during the tournament.

The current codebase is a historical prototype. It has a React/TypeScript front end, an Express/TypeScript back end, and MySQL-backed banzuke/ranking import/display logic. It is not yet a complete playable fantasy game.

## Current functionality

At present, the app can display a table of sumo rankings from the local database.

Existing server endpoints:

- `GET /api/get-rankings` - returns rankings from MySQL.
- `GET /api/update-rankings` - imports banzuke data from sumo.or.jp into MySQL.

## Tech stack snapshot

- React 16
- TypeScript 3
- styled-components 4
- Express 4
- MySQL X DevAPI
- webpack 4
- Jest 24
- TSLint

This stack is old and should be treated carefully. See `docs/MODERNISATION_PLAN.md` before attempting dependency upgrades.

## Documentation

Start here:

- `AGENTS.md` - guidance for AI coding agents working on the repo.
- `docs/PROJECT_BRIEF.md` - product intent and MVP definition.
- `docs/ARCHITECTURE.md` - current architecture and suggested future boundaries.
- `docs/adr/0001-rebuild-architecture.md` - accepted rebuild architecture decision.
- `docs/MODERNISATION_PLAN.md` - safe path for updating or rebuilding the app.
- `docs/ROADMAP.md` - staged product/engineering roadmap.

## Local setup

Local setup still needs to be re-verified against the legacy dependency stack.

Historically, the app used:

```bash
npm install
npm run build
npm start
```

And for client development:

```bash
npm run start:dev
```

Before relying on this, identify a working Node version and document it in this README.

## Security note

The legacy data layer currently contains hard-coded local database credentials. These must be moved to environment variables before any serious development or deployment.

## Recommended next steps

1. Scaffold the pnpm workspace described in `docs/adr/0001-rebuild-architecture.md`.
2. Add Vite + React, Fastify, shared domain, and Drizzle + SQLite packages.
3. Add scoring v0 in the domain package with tests.
4. Implement the smallest playable MVP: pick a team, enter/import results, calculate scores, show leaderboard.
