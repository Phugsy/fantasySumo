# ADR 0001: Rebuild architecture and app foundation

## Status

Accepted.

## Context

Fantasy Sumo is an unfinished prototype. The existing app can display banzuke/ranking data from a local MySQL database, but it does not yet implement the fantasy game loop. Its stack is also old: React 16, TypeScript 3, webpack 4, Express 4, TSLint, `request`, and MySQL X DevAPI.

The project brief prioritises a small playable MVP over a large platform:

- one active basho at a time;
- a fixed team size;
- simple win-based scoring;
- basic banzuke/results import or admin update path;
- a leaderboard;
- local-first development before public deployment.

The current code is therefore useful as historical reference for domain names, banzuke display, and the old sumo.or.jp import shape, but it should not constrain the rebuild.

## Decision

Rebuild Fantasy Sumo as a clean, modern TypeScript web app. Treat the old app as disposable legacy/reference and replace the runtime foundation rather than incrementally upgrading the current webpack/Express/MySQL prototype.

Use `pnpm` for package management, matching the approach used in Super Tiro and avoiding further investment in the current `npm`/`package-lock.json` setup.

Use a pnpm workspace from the start, but keep it small:

```text
apps/
  web/          Vite + React client
  api/          Fastify API server
packages/
  domain/       Pure domain logic, scoring, validation, shared types
  db/           SQLite schema, migrations, repositories
```

This is slightly more structure than a single package, but it keeps the client, API, scoring rules, and persistence boundaries explicit without turning the project into a platform. It also lets the MVP share TypeScript domain types without coupling the React app directly to server internals.

Use Fastify for the API instead of keeping Express temporarily. The existing Express server is only a thin route wrapper, so keeping it would preserve little value. Fastify gives a modern TypeScript-friendly foundation, straightforward validation hooks, good test ergonomics, and enough performance/headroom without adding platform complexity.

Use SQLite for the first MVP database. The app should be local-first while the core game loop is being proven, and SQLite avoids local MySQL/Postgres setup as a blocker for contributors. Revisit Postgres when the app needs a shared hosted deployment, concurrent public users, or production backup/operations work.

Use Drizzle for persistence and migrations. Drizzle keeps the schema close to TypeScript, has a lighter runtime footprint than Prisma, works well with SQLite, and is enough for the MVP's simple relational model. Raw SQL can still be used for small reporting queries where it is clearer, but schema changes should go through migrations.

Use Vitest for unit tests, with the first test coverage focused on `packages/domain` scoring, pick validation, team lock rules, and leaderboard ordering. Add Playwright later when the browser flow stabilises.

## Proposed Source Structure

The implementation ticket should replace the legacy layout with this structure:

```text
apps/
  web/
    src/
      app/
      features/
        basho/
        team-selection/
        leaderboard/
      api/
      main.tsx
  api/
    src/
      server.ts
      config/
      routes/
      services/
      repositories/
      importers/
packages/
  domain/
    src/
      basho/
      rikishi/
      fantasy-team/
      scoring/
      leaderboard/
      index.ts
  db/
    drizzle/
      migrations/
    src/
      schema.ts
      client.ts
      repositories/
docs/
  adr/
```

Boundary rules:

- `packages/domain` must stay persistence-free and framework-free.
- `apps/api` owns HTTP request/response handling, application workflows, and admin import endpoints.
- `packages/db` owns schema, migrations, database client creation, and repository implementations.
- `apps/web` owns browser UI and calls the API rather than importing server code.
- Import logic stays separate from scoring logic.

## Initial MVP Data Model

Start with tables and domain objects for:

- `Basho`
- `Rikishi`
- `BanzukeEntry`
- `FantasyTeam`
- `FantasyPick`
- `BoutResult`

Keep scoring v0 simple:

- +1 point for each win by a picked rikishi;
- 0 points for a loss or absence;
- team score is the sum of picked rikishi points;
- ties are allowed initially.

## Trade-offs

A single package would be slightly faster to scaffold, but it would blur the API/domain/persistence boundaries that matter most for this app. A small workspace is the better default because scoring and data import should remain isolated and testable.

Postgres would be a better first choice for a public hosted app, but it adds setup overhead before the MVP is playable. SQLite is the right first choice for a local-first rebuild and can be replaced later behind repository boundaries.

Prisma would provide a polished ORM experience, but it is heavier than the MVP needs. Drizzle is a better fit for explicit schema, lightweight migrations, and simple SQL-shaped data access.

Keeping Express would reduce one dependency decision, but the legacy Express app has no meaningful structure to preserve. Fastify is the cleaner baseline for the rebuild.

## Consequences

- The next implementation ticket should scaffold the pnpm workspace and minimal apps/packages only; it should not attempt the full product rebuild.
- The legacy `src/`, webpack config, npm lockfile, and MySQL connection can be removed during the scaffold ticket once the replacement skeleton is in place.
- Documentation and setup should move from npm commands to pnpm commands.
- Any retained banzuke import knowledge should be copied into a new importer module or fixture before deleting legacy code.
- No production deployment assumptions are made by this decision.

## Next Implementation Ticket

Issue #5 should scaffold the rebuild foundation:

1. Add `pnpm-workspace.yaml`, root package scripts, and a current TypeScript baseline.
2. Create `apps/web` with Vite + React.
3. Create `apps/api` with a minimal Fastify health endpoint.
4. Create `packages/domain` with a tested scoring v0 function.
5. Create `packages/db` with Drizzle + SQLite configured and an initial empty migration setup.
6. Update README setup commands for the new pnpm workflow.

Do not implement the full team selection flow, importer, or leaderboard UI in that ticket unless it is explicitly rescoped.
