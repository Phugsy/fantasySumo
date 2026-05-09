# Architecture Notes

## Current architecture

Fantasy Sumo currently has a simple full-stack TypeScript structure:

```text
src/
  client/
    app/
      index.tsx
      components/
        App.tsx
        HeaderBar.tsx
        SumoRanking.tsx
  server/
    app.ts
    database.ts
```

The app is split into:

- A React client bundled by webpack.
- An Express server compiled by TypeScript.
- A MySQL-backed data access layer.

## Front end

The front end entry point is `src/client/app/index.tsx`.

Current behaviour:

- Loads Google fonts via `webfontloader`.
- Renders the root `App` component into `#root`.
- `App` renders:
  - `HeaderBar`
  - `SumoRankTable`
- `SumoRankTable` fetches `/api/get-rankings` and displays rank, shikona, and heya.

Current limitations:

- No routing.
- No state management beyond component state.
- No fantasy team selection flow yet.
- No leaderboard UI yet.
- No explicit error/loading design beyond basic text.

## Back end

The server entry point is `src/server/app.ts`.

Current routes:

- `GET /api/get-rankings`
  - Reads rankings from MySQL.
- `GET /api/update-rankings`
  - Fetches banzuke data from sumo.or.jp and stores it in MySQL.

Current limitations:

- No auth.
- No validation.
- No typed API contracts.
- No error handling middleware.
- No environment-based configuration.
- No fantasy team, tournament, scoring, result, or leaderboard endpoints yet.

## Data layer

The current data access code lives in `src/server/database.ts`.

Current behaviour:

- Connects to a local MySQL X Protocol server.
- Reads and writes to schema `sumo`, table `rankings`.
- Imports banzuke data from an external endpoint.

Current limitations:

- DB credentials are hard-coded and must be removed before serious development/deployment.
- No migrations.
- No seed data.
- No schema documentation.
- No test database setup.
- Import and persistence logic are mixed together.

## Legacy stack snapshot

The repository currently uses older tooling:

- React 16.
- TypeScript 3.
- webpack 4.
- webpack-dev-server 3.
- TSLint.
- Jest 24.
- `request` / `request-promise-native`.
- `awesome-typescript-loader`.

Treat modernization as its own workstream rather than mixing it with product feature work.

## Recommended target architecture for MVP

A clean MVP can still be a simple monolith:

```text
src/
  client/
    ... UI application
  server/
    app.ts
    config/
    routes/
    services/
    repositories/
    domain/
      scoring/
      basho/
      rikishi/
  shared/
    types/
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
