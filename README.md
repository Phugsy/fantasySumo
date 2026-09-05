# Fantasy Sumo

Fantasy Sumo is an unfinished fantasy sports app for professional sumo.

Players should be able to choose a team of rikishi at the start of a basho, then score points based on those rikishi's results during the tournament.

The current codebase has been reset onto the clean rebuild foundation described in `docs/adr/0001-rebuild-architecture.md`. The old React 16, webpack, Express, and MySQL prototype has been removed from active runtime code.

## Current functionality

At present, the app has the first local playable foundations:

- A routed Vite + React front end with a public current-basho leaderboard, a dedicated login page, and authenticated team and stable pages.
- A picks editor that shows each rikishi's verified previous-basho W-L-A record
  and historical rank, with distinct neutral states for unavailable history and
  confirmed non-participation.
- A private My Stable view with the signed-in player's picks, edit/lock state, rikishi details, scoring progress, and each pick's next published matchup.
- Informational rikishi tournament badges for source-reported withdrawal status and reliably derived record or gold-star milestones; these never change fantasy points.
- A Fastify API with health, basho, rikishi, team, and leaderboard endpoints.
- A shared TypeScript domain package with MVP types, lifecycle rules, validation, scoring, and leaderboard logic.
- A swappable Drizzle database package with local SQLite, production Postgres, repositories, migrations, sample seed data, and deterministic demo data.
- Automated source-backed import commands and protected admin controls for current banzuke, daily results, and published schedules.
- A role-gated `/admin` page for explicit live basho lifecycle actions, per-basho team-size configuration, and safe deterministic demo progression.
- A minimal current-user/session boundary for local development and production auth integration.
- Vitest, ESLint, and Prettier wired through pnpm scripts.

It now supports the local playable and administrator loops and includes a
manual, isolated shared-playtest deployment path. Running the first hosted
multi-user round, secondary scoring rules, and pick modifiers remain deliberate
follow-up work.

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
- `docs/PLAYTEST.md` - isolated shared-demo setup, round operation, and teardown.
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

Demo mode replaces only the fixed pickable demo basho and its dependent
banzuke, team, pick, and result data with fake but stable fixtures. It also
maintains a separate completed demo basho so the picks editor can exercise
winning, losing, absent, previous-Juryo, and confirmed non-participation record
states. Both demo bashos are replaced exactly in one transaction, while live
bashos and shared rikishi metadata are preserved. The pickable demo starts at
day 0 with picks open and no applied results. It does not use live sumo data,
but it exercises the same API, UI, database, and scoring logic as normal local
development. The explicit
`VITE_BASHO_MODE=demo` flag makes the browser request the fixed flagged demo;
without it, current-basho selection remains live-first.

`make demo` is local-only, so other people cannot reach it unless the process is
deliberately exposed. For shared testing, use the manual `Deploy Playtest`
workflow and the isolated environment runbook in `docs/PLAYTEST.md`. The
playtest must have its own Neon project, auth tenant, Vercel project, and GitHub
environment; it must not point at Preview or Production data.

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
- `GET /api/basho/:bashoId/schedule`
- `POST /api/basho/:bashoId/teams`
- `GET /api/basho/:bashoId/my-team`
- `PUT /api/basho/:bashoId/my-team`
- `GET /api/basho/:bashoId/teams/:teamId`
- `GET /api/basho/:bashoId/leaderboard`
- `POST /api/admin/demo/reset`
- `POST /api/admin/demo/start`
- `POST /api/admin/demo/advance-day`
- `POST /api/admin/demo/complete`
- `GET /api/admin/basho/current`
- `POST /api/admin/basho/:bashoId/open-picks`
- `POST /api/admin/basho/:bashoId/start`
- `POST /api/admin/basho/:bashoId/close`
- `GET /api/admin/basho/:bashoId/game-config`
- `PUT /api/admin/basho/:bashoId/game-config`
- `POST /api/admin/import-banzuke`
- `POST /api/admin/basho/:bashoId/import-results`
- `POST /api/admin/basho/:bashoId/import-schedule`
- `GET /api/cron/import-results`

Browser admin endpoints require an authenticated user whose verified user ID is
listed in the server-only `ADMIN_USER_IDS` environment variable. The Admin
navigation item and `/admin` controls appear only after the API reports that
role. `DEMO_ADMIN_TOKEN` and `ADMIN_IMPORT_TOKEN` remain optional, separate
machine credentials for scripts; neither token is sent to browser code.

Demo controls operate only on the fixed basho ID whose persisted record is
marked `isDemo`; a colliding live record fails closed. Live controls expose
only validated open, start, and close transitions rather than a generic status
setter. See `docs/DEPLOYMENT.md` for assignment and production-safety details.

## Basho lifecycle

Basho records use this lifecycle:

- `upcoming` - picks are open.
- `locked` - picks are closed before scoring starts.
- `active` - results are being applied and leaderboard scoring is in progress.
- `complete` - final scores are available.

The API enforces pick locking from persisted lifecycle state. Team creation
through `POST /api/basho/:bashoId/teams` and current-user pick replacement
through `PUT /api/basho/:bashoId/my-team` succeed only while the basho is
`upcoming`; `locked`, `active`, and `complete` bashos return `409
picks-locked`. This also allows an administrator to lock picks early by
changing the basho lifecycle. The repository rechecks that status inside the
team-and-picks transaction, which serializes with the production lock update
so an in-flight save cannot slip through the transition.
The protected daily cron normally persists the lock and stamps existing teams
on the evening before day 0, where day 0 is the calendar day before the basho.

Leaderboard entries include the latest scored day's points and chronological
score history. Each history entry contains the daily score, cumulative score,
and the win, loss, absence, or missing-result contribution for every pick. The
history includes only days with stored results, so missing imports and future
days are not presented as scored.

Useful checks:

```bash
make check
make deployment-verify
```

`make deployment-verify` checks that the preview, playtest, and production
workflows retain their environment, concurrency, migration-before-deploy,
exact-SHA, database-backed smoke-test, Vercel Git-disable, and reporting gates.
It also checks the playtest-only demo build, explicit reset, and demo smoke-test
contracts. `make check` includes this contract check.

By default, the database package writes local SQLite data to `packages/db/data/fantasy-sumo.sqlite` when run through the pnpm scripts. Override this with `DATABASE_URL` using a `file:` SQLite URL, for example:

```bash
DATABASE_URL=file:./data/dev.sqlite pnpm db:seed
```

Use a `postgres:` or `postgresql:` `DATABASE_URL` for managed production persistence.

The effective team size defaults to `TEAM_SIZE` (or `2`) until an administrator
saves a value for that basho. The persisted basho value then becomes
authoritative. It can change only while picks are open and before the first
stable is submitted.
Set `DEMO_ADMIN_TOKEN` only when scripts need a separate machine credential for
the protected demo admin API controls.
Set `ADMIN_USER_IDS` to a comma-separated list of verified API user IDs that
may open `/admin`. In local mode, sign in once and read the returned `user.id`
from `GET /api/session`, then add that ID and restart the API.
Set `CRON_SECRET` in production to authenticate Vercel's scheduled basho job.

## Auth and team ownership

Fantasy team creation requires a current user. The browser route split is:

- `/` — public current-basho summary and leaderboard.
- `/login` — dedicated sign-in and registration controls.
- `/reset-password` — Neon Auth password-reset request and completion flow.
- `/stable` — authenticated My Stable view.
- `/team` — authenticated team creation and editing.
- `/admin` — authenticated, role-gated admin controls.

Signed-out visits to protected routes return through `/login` with an allow-listed internal destination. Signing out clears private browser state and returns to `/`. Vite and the deployed SPA fallback both serve direct route visits and refreshes.

Local development uses `AUTH_MODE=local`, which exposes a simple development-only session flow through `POST /api/session` and the `/login` page. This keeps SQLite demos and tests self-contained.

Production uses Neon Auth as the identity source. The web app signs users in with `VITE_NEON_AUTH_URL`, sends the Neon JWT to the API, and the API verifies that token in `AUTH_MODE=neon` with `NEON_AUTH_JWKS_URL`. The API stores team ownership as `ownerUserId`, enforces one team per user per basho, and keeps the leaderboard public by team/display name. Signed-in users can replace only their own picks through the current-user team endpoint while the basho remains open.

Neon mode also exposes a neutral password-reset request from `/login`. Neon
emails the provider-managed reset link back to `/reset-password`, where the app
accepts the provider token and returns the player to the allow-listed intended
login route. Local auth remains passwordless and does not simulate recovery.
Configure email delivery and the exact deployed origin in Neon Auth before
testing this flow; see `docs/DEPLOYMENT.md`.

## Data import

Import current banzuke data from the Japan Sumo Association source:

```bash
make import-banzuke
```

Import daily Makuuchi results from Sumo API:

```bash
make import-results ARGS="-- --basho 2026-05 --day 1"
```

Import a published future Makuuchi schedule from the same torikumi source:

```bash
make import-schedule ARGS="-- --basho 2026-05 --day 2"
```

Both import paths support dry runs:

```bash
make import-banzuke ARGS="-- --dry-run"
make import-results ARGS="-- --basho 2026-05 --day 1 --dry-run"
make import-schedule ARGS="-- --basho 2026-05 --day 2 --dry-run"
```

Banzuke reimports replace the stored banzuke entries for that basho without deleting rikishi, teams, or picks. Result reimports replace only the imported basho/day, so rerunning day 1 cannot delete day 2 results. Schedule imports use separate publication and scheduled-bout tables; reimporting a day atomically replaces that card and never changes fantasy scores. An empty Sumo API response is treated as unpublished or unavailable and preserves any stored card; only a trusted internal import command can explicitly replace a day with an empty published card.

The picks editor derives a historical record only from the nearest earlier
completed basho in the same live/demo data mode whose 15 published schedule
days and stored results are fully verified. Incomplete history is reported as
unavailable rather than inferred from a partial import. Historical rank context
can show any division represented in stored fixture/import data. The current
automated banzuke importer remains Makuuchi-only, so a missing live historical
row is reported as unavailable rather than guessed to mean non-participation.
Available rank context comes from that basho's stored banzuke.

The API exposes equivalent local admin triggers:

```bash
curl -X POST "http://localhost:3000/api/admin/import-banzuke?dryRun=true" \
  -H "content-type: application/json" \
  -d '{}'

curl -X POST "http://localhost:3000/api/admin/basho/2026-05/import-results?dryRun=true" \
  -H "content-type: application/json" \
  -d '{"day":1,"division":"Makuuchi"}'

curl -X POST "http://localhost:3000/api/admin/basho/2026-05/import-schedule?dryRun=true" \
  -H "content-type: application/json" \
  -d '{"day":2,"division":"Makuuchi"}'
```

Production deployments expose one Vercel Cron-only path. `GET
/api/cron/import-results` locks the single eligible upcoming basho without
contacting the results source on the evening before day 0, then derives and
imports every missing basho day through the current day on days 1-15. Day 0
provides a safe lock catch-up, and a later run derives missing days from stored
bout results rather than banzuke calendar progress. After current-day results,
the same invocation attempts the published day N+1 schedule; the manual result
API and CLI do the same. Locked or active bashos can retry a missing final day
after the end date. An unavailable following-day card is reported as partial
success without undoing completed results or replacing a stored schedule. See
`docs/DEPLOYMENT.md` for timing, operator response, and authentication details.

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
- `make import-results` - import one day of results, then attempt the following published schedule.
- `make import-schedule` - import one published day of scheduled bouts from source.

## Security note

The local database uses a file path only and does not require credentials. Keep future secrets out of source control.

For Vercel deployment prep and the managed Postgres production path, see `docs/DEPLOYMENT.md`.

Preview and production releases run through GitHub Actions. Each environment
applies Postgres migrations before Vercel receives the tested build, and a
failed migration blocks deployment. Schema-changing PRs must remain compatible
with the currently running application: expand and adopt first, then remove old
schema in a later release.

## Recommended next steps

1. Provide a safe shared demo/playtest environment without using production data (#91).
2. Define the secondary scoring mode for kinboshi and special prizes (#92).
3. Select a joker, substitute, or withdrawal-handling mechanic (#93).
4. Fix the reported responsive header and initial focus regressions (#94).
5. Add display preferences after the game-rule decisions above (#73).
