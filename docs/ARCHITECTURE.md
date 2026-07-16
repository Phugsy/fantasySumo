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
- a Drizzle data package with local SQLite and production Postgres adapters;
- root pnpm scripts for dev, build, test, lint, and formatting.

## Front end

The front end entry point is `apps/web/src/main.tsx`.

Current behaviour:

- Fetches the current basho and its ranked rikishi from the Fastify API.
- Fetches leaderboard standings from the Fastify API.
- Lets a player select and deselect rikishi up to the API-configured team size.
- Captures a display/team name and submits the team to the API.
- Shows ordered team standings with expandable picked-rikishi score breakdowns.
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
  - Selects the single date-eligible non-demo basho, including an upcoming or
    locked day-one basho, and derives its day from the current calendar date in
    `Asia/Tokyo`.
  - Reuses the source adapter and transactional result import service used by
    the manual admin route.
  - Moves an upcoming or locked basho to active with day 1 and completes it
    with day 15.
  - Returns structured imported/skipped status and logs success or failure.
- `GET /api/cron/lock-picks`
  - Requires Vercel's `Authorization: Bearer <CRON_SECRET>` header.
  - Selects one eligible non-demo upcoming basho from the start of the
    Japan-calendar day before its start date.
  - Atomically moves the basho to `locked` and stamps `lockedAt` on existing
    fantasy teams.
  - Is idempotent, catches up a still-upcoming basho on day one, and fails if
    more than one basho is eligible.

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
- Uses Postgres through `postgres` and Drizzle's `postgres-js` driver for production deployment.
- Defines SQLite and Postgres MVP schemas with Drizzle table definitions.
- Includes SQLite migration SQL in `packages/db/drizzle` and Postgres migration SQL in `packages/db/drizzle-pg`.
- Uses `DATABASE_URL` to select the adapter: `file:` and `:memory:` use SQLite; `postgres:` and `postgresql:` use Postgres.
- Exposes an async repository contract so API/domain workflows do not depend on a concrete database driver.
- Provides repository functions for reading and writing basho, rikishi, banzuke entries, fantasy teams, fantasy picks, and bout results.
- Provides transactional upsert helpers for banzuke and bout result imports.
- Provides sample seed data for one basho, four rikishi, two fantasy teams, picks, and bout results.
- Provides deterministic demo seed data for one pickable basho, eight rikishi, four fantasy teams, picks, and a 15-day bout result fixture.
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

`pnpm db:seed:demo` is the preferred fixture reset for local demos, browser smoke checks, and the future Playwright E2E harness. It deliberately replaces the configured SQLite database contents with fake deterministic data while using the same database schema, repositories, API routes, UI, and domain scoring logic as the regular app. It starts with the demo basho in `upcoming`, `currentDay: 0`, and no applied results; use `pnpm demo:start`, `pnpm demo:advance-day`, and `pnpm demo:complete` to exercise the lifecycle.

Current limitations:

- No banzuke/results import UI yet.
- No hosted production database has been provisioned in the repo.

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

`POST /api/basho/:bashoId/teams` is allowed only while the basho status is
`upcoming` and the current date in Japan is before the calendar day preceding
the basho start date. The date check is a backstop when the lifecycle cron is
delayed or missed. Deterministic demo data remains controlled by the protected
demo lifecycle instead of real calendar dates. The API rejects team creation
for overdue upcoming, `locked`, `active`, and `complete` production bashos with
`409 picks-locked`; the UI mirrors stored lifecycle state but is not the source
of enforcement.

Lifecycle meanings:

- `upcoming`: picks are open before the day-before lock cutoff.
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
