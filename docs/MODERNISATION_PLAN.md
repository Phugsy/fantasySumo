# Modernisation Plan

## Goal

Bring Fantasy Sumo up to date without losing the useful parts of the old prototype or getting trapped in a huge dependency-upgrade swamp.

The safest approach is to separate work into two streams:

1. **Stabilise and document the legacy app.**
2. **Modernise or rebuild deliberately.**

## Current risk profile

The current stack is old enough that a direct dependency upgrade may be more expensive than a controlled rebuild:

- React 16 -> current React.
- TypeScript 3 -> current TypeScript.
- webpack 4 -> Vite or current webpack.
- TSLint -> ESLint.
- `request` -> native `fetch`, `undici`, or another maintained HTTP client.
- `awesome-typescript-loader` -> no longer needed with Vite, or replace with modern loaders.
- MySQL X DevAPI usage should be reassessed.

## Recommended path

Update: [ADR 0001](adr/0001-rebuild-architecture.md) has chosen the controlled rebuild path. The legacy app should now be treated as disposable reference rather than something to stabilise before feature work.

Update: the rebuild foundation now exists as a pnpm workspace with Vite + React, Fastify, TypeScript, Vitest, ESLint, and Prettier. The old webpack, TSLint, Express, and MySQL runtime files have been removed from active code.

Update: the local MVP persistence layer now uses SQLite with Drizzle schema definitions, migration SQL, repository functions, and seed data in `packages/db`.

Update: the web app now supports team selection plus a leaderboard view backed by the local API.

### Phase 0: Preserve current knowledge

- Add docs describing product intent, current architecture, and roadmap.
- Record known legacy hazards.
- Avoid feature work until setup can be reproduced.

### Phase 1: Make the existing app runnable if practical

- Identify a Node version that can install the current dependencies.
- Add `.nvmrc` or `.tool-versions`.
- Add `.env.example`.
- Remove hard-coded DB credentials from source.
- Document local MySQL setup.
- Confirm whether the banzuke import endpoint still works.

Exit criteria:

- `npm install` works on the documented Node version.
- `npm test` works, or known test blockers are documented.
- App can start locally, or blockers are captured.

This phase is now optional. Do it only if a future ticket needs to recover specific legacy behaviour, such as the old banzuke import shape.

### Phase 2: Decide upgrade vs rebuild

Make a conscious decision between:

#### Option A: Incremental upgrade

Useful if the app runs and the codebase is still close to viable.

Suggested order:

1. Move secrets/config to env vars.
2. Replace TSLint with ESLint.
3. Upgrade TypeScript.
4. Replace deprecated HTTP client.
5. Upgrade test tooling.
6. Upgrade front-end build tooling.
7. Upgrade React.

#### Option B: Controlled rebuild

Likely attractive because the current app is small and unfinished.

Accepted target:

- Vite + React + TypeScript for the client.
- Fastify API server.
- pnpm workspace with small `apps/*` and `packages/*` boundaries.
- SQLite for the first local MVP.
- Drizzle for schema and migrations.
- Vitest/Jest for tests.

Do not rebuild blindly. First preserve:

- Product intent.
- Existing banzuke/rikishi display behaviour.
- Any useful parsing/import logic.
- Domain naming.

## Suggested modern MVP stack

For the quickest useful hobby-project version:

- TypeScript throughout.
- Vite + React for the client.
- Fastify API server.
- SQLite for local-first development, moving to Postgres if deploying publicly.
- Drizzle for schema/migrations.
- Vitest for domain/service tests.
- Playwright later for core user flows.

## Security and config cleanup

Before any deployment:

- Remove hard-coded DB credentials.
- Add `.env.example`.
- Add local-only defaults where safe.
- Keep production secrets outside source control.
- Do not expose admin import endpoints without protection.

## Data-source investigation

The accepted MVP data-source recommendation is documented in [Data Import Strategy](DATA_IMPORT_STRATEGY.md).

The old app imported banzuke data from sumo.or.jp. Before relying on live sources:

- Verify the endpoint still exists.
- Check whether results data is available in a stable machine-readable format.
- Consider a manual CSV/JSON import path as a fallback.
- Keep data import adapters isolated so the data source can change.

Current recommendation: build manual JSON/CSV import first, then add optional JSA or Sumo API adapters once the local import path is tested.

## Recommended first engineering tickets

1. Add a pure scoring module with tests.
2. Add a minimal domain model for basho, rikishi, teams, picks, and results.
3. Create a first team selection screen using seeded data.
4. Add a result import or manual result entry path.

## Avoid initially

- Building complete auth before the game loop works.
- Complex private league management.
- Real-time updates.
- Overly clever scoring.
- Large dependency upgrades mixed with feature work.
