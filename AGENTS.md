# AGENTS.md

This file gives AI coding agents the context and guardrails needed to work safely on Fantasy Sumo.

## Product context

Fantasy Sumo is intended to be a lightweight fantasy sports app for professional sumo tournaments (`basho`). Players pick a team of rikishi before a tournament starts, then score points based on those rikishi's results during the tournament.

The original app was an unfinished barebones prototype. Treat the removed legacy implementation as a useful historical starting point, not as a production-ready architecture.

## Current known state

- Package manager: pnpm workspace.
- Front end: Vite, React, TypeScript.
- Back end: Fastify, TypeScript, Node.
- Shared code: `packages/domain` for framework-free domain boundaries, including basho lifecycle and pick-locking rules.
- Data: SQLite via `packages/db`, with Drizzle schema, migration SQL, repositories, sample seed data, and deterministic demo seed data.
- Existing behaviour: displays team selection and leaderboard views, and exposes local game API routes for health, basho, rikishi, team creation/retrieval, and leaderboard data.

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
- Keep basho lifecycle and pick-locking rules in the domain/API layer; UI state should mirror those rules, not replace API enforcement.
- Keep data import logic separate from scoring logic.
- Once an E2E harness exists, use it to validate completion for changes that affect the browser game loop.

## Review guidelines

- Prioritize correctness, security, data integrity, basho lifecycle enforcement, transactional races, missed-cron recovery, deployment authentication, and SQLite/Postgres parity.
- Require focused regression coverage when a change affects scoring, imports, pick locking, persistence, or production scheduling.
- Treat unsupported product expansion, style-only preferences, and cleanup unrelated to the PR as non-blocking follow-up work.
- Flag any path that can reopen picks, lose or duplicate results, partially commit imports, expose protected admin actions, or behave differently on Neon Postgres.

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
6. Read `docs/DATA_IMPORT_STRATEGY.md` before adding or changing banzuke/result import behaviour.
7. Read `docs/E2E_TESTING.md` before adding browser end-to-end tests.
8. Use `make db-seed-demo` or `make demo` when a deterministic browser-flow fixture is useful, especially for future E2E validation. These commands reset the configured local SQLite data.
9. Prefer the Makefile command layer for common workflows: `make test`, `make lint`, `make build`, and `make check`.
10. Keep PRs focused on the next MVP slice; do not rebuild the full product in one change.
11. Before calling a non-trivial code change ready, use `skills/fantasy-sumo-pr-review-loop/SKILL.md` to run a dedicated review against the base branch.

For issue-to-PR work, use the repo-local process in `skills/fantasy-sumo-issue-loop/SKILL.md`. It can be invoked with a prompt such as: "Use the Fantasy Sumo issue loop on #44."

For pre-handoff review, PR comment follow-up, or scheduled PR babysitting, use `skills/fantasy-sumo-pr-review-loop/SKILL.md`.

After opening a `codex/*` pull request, start a PR-scoped scheduled babysitter when Codex automations are available. Run it in an isolated worktree, limit automatic fixes to the safe scope in the review-loop skill, and stop it when the PR is merged or closed. Never auto-merge.

## Definition of done for future changes

A change is ready when:

- It has a clear purpose.
- It keeps or improves app setup reproducibility.
- It avoids new secrets in source control.
- It includes tests for scoring/data rules where practical.
- It runs relevant E2E coverage when browser game-loop behaviour changes and an E2E harness exists.
- It updates docs if it changes product rules, architecture, setup, or data assumptions.
- It has passed a dedicated review against the base branch, with accepted findings fixed and revalidated.
- It has no unresolved actionable P1/P2 review threads; ambiguous or higher-risk findings are explicitly handed back to the user.
