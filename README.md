# Fantasy Sumo

Fantasy Sumo is an unfinished fantasy sports app for professional sumo.

Players should be able to choose a team of rikishi at the start of a basho, then score points based on those rikishi's results during the tournament.

The current codebase has been reset onto the clean rebuild foundation described in `docs/adr/0001-rebuild-architecture.md`. The old React 16, webpack, Express, and MySQL prototype has been removed from active runtime code.

## Current functionality

At present, the app has the first local MVP foundations:

- A Vite + React front-end smoke page.
- A Fastify API with health, basho, rikishi, team, and leaderboard endpoints.
- A shared TypeScript domain package with MVP types, validation, scoring, and leaderboard logic.
- A local SQLite + Drizzle database package with schema, migration, repositories, and sample seed data.
- Vitest, ESLint, and Prettier wired through pnpm scripts.

It is not yet a playable fantasy game.

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
- `docs/MODERNISATION_PLAN.md` - safe path for updating or rebuilding the app.
- `docs/ROADMAP.md` - staged product/engineering roadmap.

## Local setup

Use Node 24 and pnpm. The repo declares its Node version in `.nvmrc` and its package manager in `package.json`.

Install dependencies:

```bash
pnpm install
```

Create a local database and seed sample MVP data:

```bash
pnpm db:migrate
pnpm db:seed
```

Run both the API and web dev servers:

```bash
pnpm dev
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

Useful checks:

```bash
pnpm build
pnpm test
pnpm lint
pnpm format:check
```

By default, the database package writes local SQLite data to `packages/db/data/fantasy-sumo.sqlite` when run through the pnpm scripts. Override this with `DATABASE_URL` using a `file:` SQLite URL, for example:

```bash
DATABASE_URL=file:./data/dev.sqlite pnpm db:seed
```

## Security note

The local database uses a file path only and does not require credentials. Keep future secrets out of source control.

## Recommended next steps

1. Wire API routes to the database repositories.
2. Build the first team selection flow against seeded data.
3. Implement the smallest playable MVP: pick a team, enter/import results, calculate scores, show leaderboard.
