# Architecture Notes

## Rebuild decision

The accepted rebuild decision is recorded in [ADR 0001: Rebuild architecture and app foundation](adr/0001-rebuild-architecture.md).

In short: the current app is disposable legacy/reference, and the next foundation should be a small pnpm workspace with a Vite + React web app, Fastify API, SQLite database, Drizzle migrations, and isolated TypeScript domain package. The notes below describe the legacy app and historical target boundaries; prefer ADR 0001 for new implementation work.

## Current architecture

Fantasy Sumo now uses a small pnpm workspace:

```text
apps/
  web/          Vite + React app shell
  api/          Fastify API
packages/
  domain/       Shared TypeScript domain types, validation, scoring
  db/           Drizzle database adapters, migrations, repositories, seed data
```

The active app is split into:

- a React client built by Vite;
- a Fastify API compiled by TypeScript;
- a shared framework-free domain package with MVP types, pick validation, scoring, and leaderboard calculation;
- a Drizzle data package with local SQLite and a production Neon Postgres
  adapter;
- root pnpm scripts for dev, build, test, lint, and formatting.
- GitHub Actions deployment workflows that validate an immutable commit, apply
  environment-scoped Postgres migrations, deploy the prepared Vercel build only
  after migration success, and smoke-test the resulting URL.

## Front end

The front end entry point is `apps/web/src/main.tsx`.

Current behaviour:

- Fetches the current basho and its ranked rikishi from the Fastify API.
- Fetches leaderboard standings from the Fastify API.
- Lets a player select and deselect rikishi up to the API-configured team size.
- Captures a display/team name and submits the team to the API.
- Shows ordered team standings with the latest daily score, compact five-day
  team form, and expandable picked-rikishi tournament totals. Each rikishi row
  shows up to five recent outcomes and expands to the full result history.
- Shows loading, empty, success, and API error states.
- Has Vitest coverage through React Testing Library.

Current limitations:

- No routing.
- No result import UI yet.
- No persistence of the last created team in browser storage yet.

## Back end

The API entry point is `apps/api/src/server.ts`.

The API package is native ESM. TypeScript source should use `.js` file extensions for local relative imports, for example `import { buildApp } from "./app.js";`. With `moduleResolution: "NodeNext"`, TypeScript resolves that to the `.ts` source during development and leaves the emitted JavaScript import valid for Node.

Current routes:

- `GET /api/health`
  - Returns a small JSON health payload.
- `GET /api/basho/current`
  - Returns the active basho and configured team size, falling back to the latest locked basho, then the latest available basho.
- `GET /api/basho/:bashoId/rikishi`
  - Returns a basho and its rikishi with banzuke rank data.
- `POST /api/basho/:bashoId/teams`
  - Creates a display-name-based fantasy team for the basho.
  - Request body: `displayName`, optional `ownerName`, and `rikishiIds`.
  - The current team size defaults to 2 rikishi and can be changed with `TEAM_SIZE`.
  - Validates duplicate picks, exact team size, and whether each picked rikishi is on that basho's banzuke.
- `GET /api/basho/:bashoId/teams/:teamId`
  - Returns a fantasy team and its picks.
- `GET /api/basho/:bashoId/leaderboard`
  - Returns leaderboard entries calculated with the domain scoring module.
  - Includes the latest scored day's points and chronological daily/cumulative
    history for each team.
  - Each day records every pick's `win`, `loss`, `absent`, or `no-result`
    outcome and fantasy-point contribution. Days without stored results are
    omitted rather than presented as scored.
- `POST /api/admin/import-banzuke`
  - Fetches current Makuuchi banzuke data from the Japan Sumo Association `indexAjax` endpoint.
  - Maps source payloads into local `Basho`, `Rikishi`, and `BanzukeEntry` records.
  - Replaces stale banzuke rows for the imported basho without deleting rikishi, teams, or picks.
  - Preserves the most advanced stored basho lifecycle state so a reimport
    cannot reopen picks after locking.
  - Supports `?dryRun=true`.
- `POST /api/admin/basho/:bashoId/import-results`
  - Fetches one day of Makuuchi results from Sumo API by default.
  - Request body: `day` and optional `division`.
  - Maps source payloads into local `BoutResult` records using local shikona-based rikishi ids.
  - Replaces stale result rows only for the imported basho/day.
  - Supports `?dryRun=true`.
- `POST /api/admin/demo/reset`
  - Requires `DEMO_ADMIN_TOKEN`.
  - Resets deterministic demo data to day 0 with picks open and no applied results.
- `POST /api/admin/demo/start`
  - Requires `DEMO_ADMIN_TOKEN`.
  - Locks existing demo picks and starts the demo basho without applying results.
- `POST /api/admin/demo/advance-day`
  - Requires `DEMO_ADMIN_TOKEN`.
  - Applies the next day of deterministic demo results.
- `POST /api/admin/demo/complete`
  - Requires `DEMO_ADMIN_TOKEN`.
  - Applies all deterministic demo results and marks the demo basho complete.
- `GET /api/cron/import-results`
  - Requires Vercel's `Authorization: Bearer <CRON_SECRET>` header.
  - On the evening before day 0, locks the single eligible non-demo upcoming
    basho and its existing teams without contacting the results source.
  - Catches up the same lock on day 0 if the earlier invocation was missed.
  - On days 1-15, selects the single date-eligible basho, derives its day from
    the current calendar date in `Asia/Tokyo`, and sequentially imports every
    day missing from stored bout results through that day, while refreshing the
    current day on every run.
  - Keeps locked or active bashos eligible after their end date until the final
    day's results complete them.
  - Reuses the source adapter and transactional result import service used by
    the manual admin route.
  - Moves an upcoming or locked basho to active with day 1 and completes it
    with day 15.
  - Returns structured locked/imported/skipped status and logs success or
    failure.

Current limitations:

- No auth.
- No dedicated API client package.
- No admin UI yet.

## Domain package

The domain package entry point is `packages/domain/src/index.ts`.

Current behaviour:

- Exports shared TypeScript types for `Basho`, `Rikishi`, `BanzukeEntry`, `FantasyTeam`, `FantasyPick`, `BoutResult`, and `LeaderboardEntry`.
- Scores a rikishi as one point per win.
- Scores a team as the sum of all wins by the team's picked rikishi.
- Supports optional day-bounded scoring with `throughDay` so callers can calculate standings after a specific basho day without relying on an implicit "latest" result.
- Derives chronological team score history from stored bout results, including
  daily and cumulative totals plus per-pick outcomes, for reuse by the
  leaderboard and future progress visualisations.
- Calculates a leaderboard ordered by score descending.
- Allows tied team scores and orders ties deterministically by display name, then team id.
- Validates duplicate picks and exact team size when a team size is supplied.

Current limitations:

- No scoring bonuses yet.
- No rank-band or budget validation yet.
- No persistence or API dependency by design.

## Data layer

The data package entry point is `packages/db/src/index.ts`.

Current behaviour:

- Uses SQLite through `better-sqlite3` for local development.
- Uses Neon Postgres through `postgres` and Drizzle's `postgres-js` driver for
  production deployment.
- Defines SQLite and Postgres MVP schemas with Drizzle table definitions.
- Includes SQLite migration SQL in `packages/db/drizzle` and Postgres migration SQL in `packages/db/drizzle-pg`.
- Preserves the production-applied `owner_user_id` compatibility column and
  unique index in the Postgres schema and migration history. The paused auth
  feature does not currently read or write this nullable field. Retaining it
  avoids rewriting deployed history or applying a destructive rollback.
- Uses `DATABASE_URL` to select the adapter: `file:` and `:memory:` use SQLite; `postgres:` and `postgresql:` use Postgres.
- Exposes an async repository contract so API/domain workflows do not depend on a concrete database driver.
- Provides repository functions for reading and writing basho, rikishi, banzuke entries, fantasy teams, fantasy picks, and bout results.
- Provides transactional upsert helpers for banzuke and bout result imports;
  banzuke writes preserve the furthest stored lifecycle state inside the
  transaction so concurrent refreshes cannot reopen picks.
- Provides sample seed data for one basho, four rikishi, two fantasy teams, picks, and bout results.
- Provides deterministic demo seed data for one pickable basho, eight rikishi, four fantasy teams, picks, and a 15-day bout result fixture.
- Classifies bashos explicitly with `isDemo`. The fixed demo reset transaction
  requires both the known demo ID and `isDemo: true`, replaces only that
  basho's dependent data, and preserves live bashos and shared rikishi metadata.
- Keeps normal current-basho selection live-first. Local demo mode explicitly
  requests the fixed flagged demo with `VITE_BASHO_MODE=demo`, so mixed live and
  demo data cannot silently change which environment the browser displays.
- Provides demo progression API routes and commands that reset to day 0, start/lock picks, advance one day at a time, and complete the basho.
- Stores basho lifecycle status and current day progress.

Current scripts:

```text
pnpm db:migrate
pnpm db:seed
pnpm db:seed:demo
pnpm demo:reset
pnpm demo:start
pnpm demo:advance-day
pnpm demo:complete
pnpm import:banzuke
pnpm import:results -- --basho 2026-05 --day 1
pnpm --filter @fantasy-sumo/db db:generate
```

`pnpm db:seed:demo` is the preferred fixture reset for local demos, browser
smoke checks, and the Playwright E2E harness. It replaces only the fixed demo
basho with fake deterministic data while using the same database schema,
repositories, API routes, UI, and domain scoring logic as the regular app. It
starts with the demo basho in `upcoming`, `currentDay: 0`, and no applied
results; use `pnpm demo:start`, `pnpm demo:advance-day`, and
`pnpm demo:complete` to exercise the lifecycle. Whole-database reset remains a
local/test-only helper used by the separate sample seed command.

Current limitations:

- No banzuke/results import UI yet.
- No hosted production database has been provisioned in the repo.

## Release boundary

`.github/workflows/deploy-preview.yml` and
`.github/workflows/deploy-production.yml` own hosted release ordering. They
serialize each shared `Preview` and `Production` database environment
independently and keep migrations
out of serverless startup. The production workflow accepts an exact commit from
`master` or the commit behind a published GitHub Release, then builds, migrates,
deploys, and smoke-tests that same SHA.

The migration ledger and transactional Postgres runner remain in
`packages/db`; the workflows only invoke the existing `pnpm db:migrate`
boundary. Ledger rows include a content checksum so identical filenames with
different SQL fail closed instead of silently skipping a branch's migration.
Because a migration advances the database before new code is live,
deploy-bound schema changes must use expand/contract compatibility across
releases. Recovery is a forward migration or an application rollback that is
compatible with the advanced schema, never an automatic down migration.

The accepted MVP import direction is documented in [Data Import Strategy](DATA_IMPORT_STRATEGY.md). Prefer automated source-backed imports first, with manual triggers, dry runs, and JSON fixtures available for testing and emergency fallback.

## Legacy stack snapshot

The removed prototype used older tooling:

- React 16.
- TypeScript 3.
- webpack 4.
- webpack-dev-server 3.
- TSLint.
- Jest 24.
- `request` / `request-promise-native`.
- `awesome-typescript-loader`.

Treat that code as historical reference only.

## Legacy banzuke import reference

The removed prototype imported banzuke data from:

```text
http://sumo.or.jp/EnHonbashoBanzuke/index_ajax/1/1/
```

The response shape used by the old importer was `BanzukeTable`, with rows shaped roughly as:

```text
banzuke_id
rikishi_id
shikona
banzuke_name
heya_name
```

The old database write mapped those fields into a `rankings` table as:

```text
position <- banzuke_id
rikishi_id <- rikishi_id
shikona <- shikona
rank <- banzuke_name
heya <- heya_name
```

This should be treated as implementation reference only. Before reintroducing an importer, verify the endpoint still works, isolate import parsing from scoring, and avoid writing credentials or external source assumptions into active runtime code.

## Recommended target architecture for MVP

A clean MVP should grow within the current workspace boundaries:

```text
apps/
  web/
    src/
      app/
      features/
      api/
  api/
    src/
      routes/
      services/
      repositories/
      importers/
packages/
  domain/
    src/
      scoring/
      basho/
      rikishi/
  db/
    drizzle/
    src/
      schema.ts
      client.ts
      repositories/
```

Recommended boundaries:

- `routes`: HTTP request/response handling only.
- `services`: application workflows, e.g. create team, import results.
- `repositories`: database access only.
- `domain`: pure business rules, especially scoring.
- `shared/types`: API/domain types shared by client and server where useful.

## Suggested domain model

Start with these concepts:

```text
Basho
  id
  name
  startDate
  endDate
  status: upcoming | locked | active | complete
  currentDay optional

Rikishi
  id
  shikona
  heya

BanzukeEntry
  id
  bashoId
  rikishiId
  rank
  rankOrder

FantasyTeam
  id
  bashoId
  ownerName or userId
  displayName
  createdAt
  lockedAt

FantasyPick
  id
  teamId
  rikishiId

BoutResult
  id
  bashoId
  day
  winnerRikishiId
  loserRikishiId
  kimarite optional
  winnerAbsent optional
  loserAbsent optional
```

## API sketch

Potential MVP endpoints:

```text
GET    /api/basho/current
GET    /api/basho/:bashoId/rikishi
POST   /api/basho/:bashoId/teams
GET    /api/basho/:bashoId/teams/:teamId
GET    /api/basho/:bashoId/leaderboard
POST   /api/admin/import-banzuke
POST   /api/admin/basho/:bashoId/import-results
```

Admin endpoints can be protected later. For early local development, they can remain local-only but should be clearly marked as unsafe for production.

`POST /api/basho/:bashoId/teams` is allowed only while the persisted basho
status is `upcoming`. The API rejects team creation for `locked`, `active`, and
`complete` bashos with `409 picks-locked`. Basho read endpoints expose the same
persisted status, keeping the UI and API aligned and allowing an administrator
to lock picks early when needed. Team creation rechecks the status while
holding the basho row in the same transaction as the team insert, so it
serializes with the scheduled lock update.

Lifecycle meanings:

- `upcoming`: picks are open.
- `locked`: picks are closed before scoring starts.
- `active`: results are being applied day by day.
- `complete`: final scores are available.

The first import implementation should follow [Data Import Strategy](DATA_IMPORT_STRATEGY.md): fetch through source-specific adapters, validate source-agnostic import commands, write them transactionally, and keep import adapters separate from scoring.

## Testing priorities

Prioritise tests for:

1. Scoring logic.
2. Pick validation.
3. Team locking rules.
4. Import parsing/mapping.
5. Leaderboard ordering.

Browser E2E tests should follow the strategy in [E2E Testing Strategy](E2E_TESTING.md). Add Playwright once the core team-selection and leaderboard flows are stable enough to protect through the browser.
