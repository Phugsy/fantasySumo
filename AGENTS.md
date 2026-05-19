# AGENTS.md

This file gives AI coding agents the context and guardrails needed to work safely on Fantasy Sumo.

## Product context

Fantasy Sumo is intended to be a lightweight fantasy sports app for professional sumo tournaments (`basho`). Players pick a team of rikishi before a tournament starts, then score points based on those rikishi's results during the tournament.

The original app was an unfinished barebones prototype. Treat the removed legacy implementation as a useful historical starting point, not as a production-ready architecture.

## Current known state

- Package manager: pnpm workspace.
- Front end: Vite, React, TypeScript.
- Back end: Fastify, TypeScript, Node.
- Shared code: `packages/domain` for framework-free domain boundaries.
- Data: SQLite via `packages/db`, with Drizzle schema, migration SQL, repositories, and seed data.
- Existing behaviour: displays a foundation smoke page and exposes local MVP API routes for health, basho, rikishi, team creation/retrieval, and leaderboard data.

## Intended MVP direction

The MVP should support:

1. A tournament/basho model.
2. A rikishi list for the tournament.
3. A fantasy team selection flow before the tournament starts.
4. A points calculation model based primarily on wins.
5. A leaderboard.
6. A simple admin/update path for importing results.

Avoid overbuilding. A working single-user/local MVP is preferable to a half-finished full platform.

## Working principles for AI agents

- Prefer small, reviewable pull requests.
- Preserve user-facing behaviour unless explicitly changing it.
- Add or update docs when changing architecture, setup, data model, or scoring rules.
- Do not introduce paid services, hosted infrastructure, or external APIs without documenting the trade-off.
- Do not commit secrets or local credentials.
- Replace hard-coded credentials before any real deployment work.
- Prefer explicit domain names: `Basho`, `Rikishi`, `Banzuke`, `FantasyTeam`, `Pick`, `Bout`, `Result`, `Leaderboard`.
- Keep scoring logic isolated and well-tested.
- Keep data import logic separate from scoring logic.

## Legacy hazards to handle carefully

- The removed legacy database connection used hard-coded local credentials. Do not reintroduce credentials in source.
- The removed banzuke import used an external endpoint from sumo.or.jp; verify whether it still works before depending on it.
- `request` / `request-promise-native`, TSLint, React 16, TypeScript 3, webpack 4, MySQL X DevAPI, and `awesome-typescript-loader` were legacy dependencies.

## Suggested workflow

1. Read `README.md` for the current repo overview.
2. Read `docs/PROJECT_BRIEF.md` for product intent.
3. Read `docs/ARCHITECTURE.md` for current implementation notes.
4. Read `docs/MODERNISATION_PLAN.md` before upgrading dependencies.
5. Read `docs/ROADMAP.md` before adding features.
6. Run tests/build before and after code changes where possible.
7. Keep PRs focused on the next MVP slice; do not rebuild the full product in one change.

## Definition of done for future changes

A change is ready when:

- It has a clear purpose.
- It keeps or improves app setup reproducibility.
- It avoids new secrets in source control.
- It includes tests for scoring/data rules where practical.
- It updates docs if it changes product rules, architecture, setup, or data assumptions.
