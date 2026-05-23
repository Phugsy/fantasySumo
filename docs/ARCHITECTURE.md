# Architecture Notes

## Rebuild decision

The accepted rebuild decision is recorded in [ADR 0001: Rebuild architecture and app foundation](adr/0001-rebuild-architecture.md).

In short: the current app is disposable legacy/reference, and the next foundation should be a small pnpm workspace with a Vite + React web app, Fastify API, SQLite database, Drizzle migrations, and isolated TypeScript domain package. The notes below describe the legacy app and historical target boundaries; prefer ADR 0001 for new implementation work.

## Current architecture

Fantasy Sumo now uses a small pnpm workspace:

```text
apps/
  web/          Vite + React smoke app
  api/          Fastify API
packages/
  domain/       Shared TypeScript domain types, validation, scoring
  db/           SQLite schema, migrations, repositories, seed data
```

The active app is split into:

- a React client built by Vite;
- a Fastify API compiled by TypeScript;
- a shared framework-free domain package with MVP types, pick validation, scoring, and leaderboard calculation;
- a SQLite/Drizzle data package for local-first persistence;
- root pnpm scripts for dev, build, test, lint, and formatting.

## Front end

The front end entry point is `apps/web/src/main.tsx`.

Current behaviour:

- Fetches the current basho and its ranked rikishi from the Fastify API.
- Lets a player select and deselect rikishi up to the current team size of 2.
- Captures a display/team name and submits the team to the API.
- Shows loading, empty, success, and API error states.
- Has Vitest coverage through React Testing Library.

Current limitations:

- No routing.
- No leaderboard UI yet.
- No result entry/import UI yet.
- No persistence of the last created team in browser storage yet.

## Back end

The API entry point is `apps/api/src/server.ts`.

The API package is native ESM. TypeScript source should use `.js` file extensions for local relative imports, for example `import { buildApp } from "./app.js";`. With `moduleResolution: "NodeNext"`, TypeScript resolves that to the `.ts` source during development and leaves the emitted JavaScript import valid for Node.

Current routes:

- `GET /api/health`
  - Returns a small JSON health payload.
- `GET /api/basho/current`
  - Returns the active basho, falling back to the latest available basho when none is active.
- `GET /api/basho/:bashoId/rikishi`
  - Returns a basho and its rikishi with banzuke rank data.
- `POST /api/basho/:bashoId/teams`
  - Creates a display-name-based fantasy team for the basho.
  - Request body: `displayName`, optional `ownerName`, and `rikishiIds`.
  - The current team size is 2 rikishi.
  - Validates duplicate picks, exact team size, and whether each picked rikishi is on that basho's banzuke.
- `GET /api/basho/:bashoId/teams/:teamId`
  - Returns a fantasy team and its picks.
- `GET /api/basho/:bashoId/leaderboard`
  - Returns leaderboard entries calculated with the domain scoring module.

Current limitations:

- No auth.
- No dedicated API client package.
- No result import or manual result entry endpoints yet.
- No pick-locking rules yet.

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

- Uses SQLite through `better-sqlite3`.
- Defines the MVP schema with Drizzle table definitions.
- Includes Drizzle migration SQL and metadata in `packages/db/drizzle`.
- Uses `DATABASE_URL` for the local SQLite file path, defaulting to `file:./data/fantasy-sumo.sqlite` relative to the database package scripts.
- Provides repository functions for reading and writing basho, rikishi, banzuke entries, fantasy teams, fantasy picks, and bout results.
- Provides sample seed data for one basho, four rikishi, two fantasy teams, picks, and bout results.

Current scripts:

```text
pnpm db:migrate
pnpm db:seed
pnpm --filter @fantasy-sumo/db db:generate
```

Current limitations:

- No live banzuke/results import yet.
- No production database configuration yet.

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
  status: upcoming | active | complete

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
POST   /api/admin/basho/:bashoId/import-banzuke
POST   /api/admin/basho/:bashoId/import-results
```

Admin endpoints can be protected later. For early local development, they can remain local-only but should be clearly marked as unsafe for production.

## Testing priorities

Prioritise tests for:

1. Scoring logic.
2. Pick validation.
3. Team locking rules.
4. Import parsing/mapping.
5. Leaderboard ordering.

UI tests can come later once the MVP flow stabilises.
