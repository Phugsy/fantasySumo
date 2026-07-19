# Fantasy Sumo

Fantasy Sumo is an unfinished fantasy sports app for professional sumo.

Players should be able to choose a team of rikishi at the start of a basho, then score points based on those rikishi's results during the tournament.

The current codebase has been reset onto the clean rebuild foundation described in `docs/adr/0001-rebuild-architecture.md`. The old React 16, webpack, Express, and MySQL prototype has been removed from active runtime code.

## Current functionality

At present, the app has the first local playable foundations:

- A Vite + React front end for creating a fantasy team from seeded basho data and viewing leaderboard standings.
- A Fastify API with health, basho, rikishi, team, and leaderboard endpoints.
- A shared TypeScript domain package with MVP types, lifecycle rules, validation, scoring, and leaderboard logic.
- A swappable Drizzle database package with local SQLite, production Postgres, repositories, migrations, sample seed data, and deterministic demo data.
- Automated source-backed import commands and local admin endpoints for current banzuke and daily results.
- Vitest, ESLint, and Prettier wired through pnpm scripts.

It is close to a local playable loop, but still needs a friendlier admin UI before it is useful during a real basho.

## Tech Stack

- pnpm workspace
- TypeScript
- Vite
- React
- Fastify
- SQLite for local development
- Neon Postgres for production deployment
- Drizzle
- Vitest
- ESLint
- Prettier

## Documentation

Start here:

- `AGENTS.md` - guidance for AI coding agents working on the repo.
- `skills/fantasy-sumo-issue-loop/SKILL.md` - repo-local issue-to-PR loop for agents. Invoke it with a prompt like: "Use the Fantasy Sumo issue loop on #44."
- `docs/PROJECT_BRIEF.md` - product intent and MVP definition.
- `docs/ARCHITECTURE.md` - current architecture and suggested future boundaries.
- `docs/adr/0001-rebuild-architecture.md` - accepted rebuild architecture decision.
- `docs/DATA_IMPORT_STRATEGY.md` - MVP data-source investigation and import recommendation.
- `docs/DEPLOYMENT.md` - Vercel and managed database deployment notes.
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

For demos, manual browser checks, and E2E fixtures, use the deterministic demo
basho seed instead:

```bash
make db-seed-demo
VITE_BASHO_MODE=demo make dev
```

Or reset the demo data and start both dev servers in one command:

```bash
make demo
```

Demo mode replaces only the fixed demo basho and its dependent banzuke, team,
pick, and result data with fake but stable fixtures. Live bashos and shared
rikishi metadata are preserved. The demo starts at day 0 with picks open and no
applied results. It does not use live sumo data, but it exercises the same API,
UI, database, and scoring logic as normal local development. The explicit
`VITE_BASHO_MODE=demo` flag makes the browser request the fixed flagged demo;
without it, current-basho selection remains live-first.

Progress the deterministic demo basho with:

```bash
make demo-reset        # reset to day 0, picks open, no results
make demo-start        # lock picks and start the basho without results
make demo-advance-day  # apply the next day of results
make demo-complete     # apply all results and mark the basho complete
```

`make demo-advance-day` can be run repeatedly through day 15. Leaderboard scores update from the real stored bout results as each day is applied.

Run both the API and web dev servers:

```bash
make dev
```

Run the browser E2E suite:

```bash
make e2e-install  # one-time Chromium and WebKit install
make e2e
```

The Playwright suite starts the Fastify API and Vite web app, resets deterministic demo data, and uses a dedicated SQLite database at `packages/db/data/e2e/fantasy-sumo-e2e.sqlite` by default. Override the test database with `E2E_DATABASE_URL=file:./data/e2e/another.sqlite`. Do not point E2E at the default developer database or production data.

The core journey runs in desktop Chrome, emulated mobile Chrome, and emulated
mobile Safari/WebKit. Failures retain a trace, screenshot, and video under
`test-results/`; CI also publishes the Playwright report and failure artifacts.

Local URLs:

- Web: `http://localhost:7866`
- API health: `http://localhost:3000/api/health`

Useful API endpoints:

- `GET /api/basho/current`
- `GET /api/basho/:bashoId/rikishi`
- `POST /api/basho/:bashoId/teams`
- `GET /api/basho/:bashoId/teams/:teamId`
- `GET /api/basho/:bashoId/leaderboard`
- `POST /api/admin/demo/reset`
- `POST /api/admin/demo/start`
- `POST /api/admin/demo/advance-day`
- `POST /api/admin/demo/complete`
- `POST /api/admin/import-banzuke`
- `POST /api/admin/basho/:bashoId/import-results`
- `GET /api/cron/import-results`

The demo admin endpoints require `DEMO_ADMIN_TOKEN` and an
`x-demo-admin-token` header. They operate only on the fixed basho ID whose
persisted record is marked `isDemo`; a colliding live record fails closed.
Keep the token private even though reset is scoped away from live bashos.

The admin import endpoints are local development tools for now. Do not expose them publicly without authentication/protection.

## Basho lifecycle

Basho records use this lifecycle:

- `upcoming` - picks are open.
- `locked` - picks are closed before scoring starts.
- `active` - results are being applied and leaderboard scoring is in progress.
- `complete` - final scores are available.

The API enforces pick locking from persisted lifecycle state.
`POST /api/basho/:bashoId/teams` succeeds only while the basho is `upcoming`;
`locked`, `active`, and `complete` bashos return `409 picks-locked`. This also
allows an administrator to lock picks early by changing the basho lifecycle.
The repository rechecks that status inside the team-insert transaction, which
serializes with the production lock update so an in-flight submission cannot
slip through the transition.
The protected daily cron normally persists the lock and stamps existing teams
on the evening before day 0, where day 0 is the calendar day before the basho.

Useful checks:

```bash
make check
make deployment-verify
```

`make deployment-verify` checks that the preview and production workflows
retain their environment, concurrency, migration-before-deploy, exact-SHA,
smoke-test, and reporting gates. `make check` includes this contract check.

By default, the database package writes local SQLite data to `packages/db/data/fantasy-sumo.sqlite` when run through the pnpm scripts. Override this with `DATABASE_URL` using a `file:` SQLite URL, for example:

```bash
DATABASE_URL=file:./data/dev.sqlite pnpm db:seed
```

Use a `postgres:` or `postgresql:` `DATABASE_URL` for managed production persistence.

The local team size defaults to `2`. Override it for the API with `TEAM_SIZE`.
Set `DEMO_ADMIN_TOKEN` to enable protected demo admin API controls.
Set `CRON_SECRET` in production to authenticate Vercel's scheduled basho job.

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

Banzuke reimports replace the stored banzuke entries for that basho without deleting rikishi, teams, or picks. Result reimports replace only the imported basho/day, so rerunning day 1 cannot delete day 2 results.

The API exposes equivalent local admin triggers:

```bash
curl -X POST "http://localhost:3000/api/admin/import-banzuke?dryRun=true" \
  -H "content-type: application/json" \
  -d '{}'

curl -X POST "http://localhost:3000/api/admin/basho/2026-05/import-results?dryRun=true" \
  -H "content-type: application/json" \
  -d '{"day":1,"division":"Makuuchi"}'
```

Production deployments expose one Vercel Cron-only path. `GET
/api/cron/import-results` locks the single eligible upcoming basho without
contacting the results source on the evening before day 0, then derives and
imports every missing basho day through the current day on days 1-15. Day 0
provides a safe lock catch-up, and a later run derives missing days from stored
bout results rather than banzuke calendar progress. Locked or active bashos can
retry a missing final day after the end date. Result imports reuse the manual
trigger's transactional service. See `docs/DEPLOYMENT.md` for schedule and
authentication details.

## Makefile commands

Use `make help` to list the stable development commands. The Makefile is a thin wrapper over the existing pnpm scripts.
It uses `pnpm` from `PATH` when available and can be overridden with `PNPM=/path/to/pnpm`.

Common targets:

- `make dev` - start the API and web client together.
- `make demo` - reset deterministic demo data, then start the API and web client together.
- `make dev-client` - start only the Vite web client.
- `make dev-server` - start only the Fastify API.
- `make db-seed-demo` - reset the scoped deterministic demo basho data.
- `make demo-reset` - reset demo progression to day 0 with picks open.
- `make demo-start` - lock existing demo picks and start the basho without applying results.
- `make demo-advance-day` - apply the next day of deterministic demo results.
- `make demo-complete` - apply all deterministic demo results and complete the basho.
- `make test` - run all tests.
- `make lint` - run ESLint.
- `make build` - build all packages/apps.
- `make check` - run lint, format check, tests, and build before a PR.
- `make deployment-verify` - verify the deployment workflow safety contract.
- `make e2e` - run Playwright against deterministic local demo data.
- `make e2e-ui` - open the Playwright UI runner.
- `make e2e-install` - install the Chromium browser used by the E2E suite.
- `make import-banzuke` - import current banzuke data from source.
- `make import-results` - import one day of results from source.

## Security note

The local database uses a file path only and does not require credentials. Keep future secrets out of source control.

For Vercel deployment prep and the managed Postgres production path, see `docs/DEPLOYMENT.md`.

Preview and production releases run through GitHub Actions. Each environment
applies Postgres migrations before Vercel receives the tested build, and a
failed migration blocks deployment. Schema-changing PRs must remain compatible
with the currently running application: expand and adopt first, then remove old
schema in a later release.

## Recommended next steps

1. Persist or retrieve the latest submitted team for follow-up views.
2. Decide whether the configured team size should move into database-backed basho settings.
3. Add a protected admin UI around the import service.
