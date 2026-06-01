# Fantasy Sumo

Fantasy Sumo is an unfinished fantasy sports app for professional sumo.

Players should be able to choose a team of rikishi at the start of a basho, then score points based on those rikishi's results during the tournament.

The current codebase has been reset onto the clean rebuild foundation described in `docs/adr/0001-rebuild-architecture.md`. The old React 16, webpack, Express, and MySQL prototype has been removed from active runtime code.

## Current functionality

At present, the app has the first local playable foundations:

- A Vite + React front end for creating a fantasy team from seeded basho data and viewing leaderboard standings.
- A Fastify API with health, basho, rikishi, team, and leaderboard endpoints.
- A shared TypeScript domain package with MVP types, validation, scoring, and leaderboard logic.
- A local SQLite + Drizzle database package with schema, migration, repositories, and sample seed data.
- Automated source-backed import commands and local admin endpoints for current banzuke and daily results.
- Vitest, ESLint, and Prettier wired through pnpm scripts.

It is close to a local playable loop, but still needs pick locking and a friendlier admin UI before it is useful during a real basho.

## Tech Stack

- pnpm workspace
- TypeScript
- Vite
- React
- Fastify
- SQLite
- Drizzle
- Vitest
- ESLint
- Prettier

## Documentation

Start here:

- `AGENTS.md` - guidance for AI coding agents working on the repo.
- `docs/PROJECT_BRIEF.md` - product intent and MVP definition.
- `docs/ARCHITECTURE.md` - current architecture and suggested future boundaries.
- `docs/adr/0001-rebuild-architecture.md` - accepted rebuild architecture decision.
- `docs/DATA_IMPORT_STRATEGY.md` - MVP data-source investigation and import recommendation.
- `docs/E2E_TESTING.md` - intended Playwright E2E strategy for the MVP game loop.
- `docs/MODERNISATION_PLAN.md` - safe path for updating or rebuilding the app.
- `docs/ROADMAP.md` - staged product/engineering roadmap.

## Local setup

Use Node 24 and pnpm. The repo declares its Node version in `.nvmrc` and its package manager in `package.json`.

Install dependencies:

```bash
make install
```

Create a local database and seed sample MVP data:

```bash
make db-migrate
make db-seed
```

Run both the API and web dev servers:

```bash
make dev
```

Local URLs:

- Web: `http://localhost:5173`
- API health: `http://localhost:3000/api/health`

Useful API endpoints:

- `GET /api/basho/current`
- `GET /api/basho/:bashoId/rikishi`
- `POST /api/basho/:bashoId/teams`
- `GET /api/basho/:bashoId/teams/:teamId`
- `GET /api/basho/:bashoId/leaderboard`
- `POST /api/admin/import-banzuke`
- `POST /api/admin/basho/:bashoId/import-results`

The admin import endpoints are local development tools for now. Do not expose them publicly without authentication/protection.

Useful checks:

```bash
make check
```

By default, the database package writes local SQLite data to `packages/db/data/fantasy-sumo.sqlite` when run through the pnpm scripts. Override this with `DATABASE_URL` using a `file:` SQLite URL, for example:

```bash
DATABASE_URL=file:./data/dev.sqlite pnpm db:seed
```

The local team size defaults to `2`. Override it for the API with `TEAM_SIZE`.

## Data import

Import current banzuke data from the Japan Sumo Association source:

```bash
make import-banzuke
```

Import daily Makuuchi results from Sumo API:

```bash
make import-results ARGS="-- --basho 2026-05 --day 1"
```

Both import paths support dry runs:

```bash
make import-banzuke ARGS="-- --dry-run"
make import-results ARGS="-- --basho 2026-05 --day 1 --dry-run"
```

The API exposes equivalent local admin triggers:

```bash
curl -X POST "http://localhost:3000/api/admin/import-banzuke?dryRun=true" \
  -H "content-type: application/json" \
  -d '{}'

curl -X POST "http://localhost:3000/api/admin/basho/2026-05/import-results?dryRun=true" \
  -H "content-type: application/json" \
  -d '{"day":1,"division":"Makuuchi"}'
```

## Makefile commands

Use `make help` to list the stable development commands. The Makefile is a thin wrapper over the existing pnpm scripts.
It uses `pnpm` from `PATH` when available and can be overridden with `PNPM=/path/to/pnpm`.

Common targets:

- `make dev` - start the API and web client together.
- `make dev-client` - start only the Vite web client.
- `make dev-server` - start only the Fastify API.
- `make test` - run all tests.
- `make lint` - run ESLint.
- `make build` - build all packages/apps.
- `make check` - run lint, format check, tests, and build before a PR.
- `make import-banzuke` - import current banzuke data from source.
- `make import-results` - import one day of results from source.

## Security note

The local database uses a file path only and does not require credentials. Keep future secrets out of source control.

## Recommended next steps

1. Persist or retrieve the latest submitted team for follow-up views.
2. Decide pick locking and whether the configured team size should move into database-backed basho settings.
3. Add a protected admin UI or scheduled job around the import service.
