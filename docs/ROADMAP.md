# Roadmap

This roadmap is intentionally practical. The project should become playable before it becomes polished.

## Stage 1: Documentation and repo recovery

Goal: make the project understandable and safe for future AI/human contributors.

- [x] Add AI agent guidance.
- [x] Add project brief.
- [x] Add architecture notes.
- [x] Add modernization plan.
- [x] Decide rebuild architecture and app foundation.
- [x] Add local setup instructions once verified.
- [x] Add `.env.example`.
- [x] Document database schema or replace it with migrations.

## Stage 2: Rebuild foundation

Goal: replace the disposable legacy prototype with a clean pnpm workspace foundation as described in `docs/adr/0001-rebuild-architecture.md`.

- [x] Add pnpm workspace configuration.
- [x] Create Vite + React web app.
- [x] Create Fastify API with a health endpoint.
- [x] Create shared TypeScript domain package.
- [x] Add Drizzle + SQLite database package and migration setup.
- [x] Add first scoring v0 function with tests.
- [x] Update README setup commands for pnpm.
- [x] Remove legacy runtime files once the new scaffold replaces them.

## Stage 3: Playable local MVP

Goal: make the core game loop work locally.

- [x] Define MVP scoring rules.
- [x] Add scoring module and tests.
- [x] Model basho/tournament data.
- [x] Model rikishi/banzuke entries.
- [x] Model fantasy teams and picks.
- [x] Expose basho, rikishi, team, and leaderboard API routes.
- [x] Add team selection flow.
- [x] Add basho lifecycle states and pick-locking rules.
- [x] Add automated source-backed import for banzuke and results.
- [x] Add leaderboard calculation.
- [x] Add leaderboard UI.
- [x] Add deterministic demo data for local demos and future E2E fixtures.

## Stage 4: Friendly single-league version

Goal: make it usable by a small group of friends.

- [x] Add simple user identity or display-name-based teams.
- [ ] Add private league concept if needed.
- [x] Add basic admin flow for importing data.
- [ ] Improve responsive UI.
- [x] Add error/loading/empty states.

## Stage 5: Public-ready version

Goal: make it robust enough to share more widely.

- [x] Add proper authentication.
- [x] Add production database and migrations.
- [x] Add migration-gated preview and production deployment pipelines.
- [ ] Add monitoring/logging.
- [x] Protect admin endpoints.
- [ ] Add backup/restore plan.
- [ ] Add privacy/security review.

## Nice future ideas

- Rank-band drafts, e.g. one sanyaku, two maegashira, etc.
- Bonus points for upset wins.
- Penalties or substitutions for kyujo/withdrawal.
- Historical basho archives.
- Friends/private leagues.
- Discord/Slack result summaries.
- Auto-generated basho recap posts.
- Player cards with form history.
- Draft mode where rikishi can only be picked by one player per league.

## Next product decisions

Before display-preference work, make the game rules deliberate:

1. Provide a separate shared demo/playtest environment without using the
   production database, then record the first multi-user round (#91).
2. Define one secondary scoring mode, including whether kinboshi and special
   prizes award points and what source facts are required (#92).
3. Select and specify one pick modifier or withdrawal mechanic, such as a
   joker/captain or substitutes (#93).
4. Fix the reported initial-focus and mobile-header regressions (#94).
5. Continue with display preferences and theme work (#73).
