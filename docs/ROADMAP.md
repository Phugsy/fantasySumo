# Roadmap

This roadmap is intentionally practical. The project should become playable before it becomes polished.

## Stage 1: Documentation and repo recovery

Goal: make the project understandable and safe for future AI/human contributors.

- [x] Add AI agent guidance.
- [x] Add project brief.
- [x] Add architecture notes.
- [x] Add modernization plan.
- [ ] Add local setup instructions once verified.
- [ ] Add `.env.example`.
- [ ] Document database schema or replace it with migrations.

## Stage 2: Legacy app stabilisation

Goal: understand whether to upgrade or rebuild.

- [ ] Identify working Node version.
- [ ] Confirm dependency install works.
- [ ] Confirm TypeScript build works.
- [ ] Confirm client dev server works.
- [ ] Confirm Express server starts.
- [ ] Confirm `/api/get-rankings` works with local data.
- [ ] Confirm `/api/update-rankings` still imports banzuke data.
- [ ] Replace hard-coded DB credentials with env vars.

## Stage 3: Playable local MVP

Goal: make the core game loop work locally.

- [ ] Define MVP scoring rules.
- [ ] Add scoring module and tests.
- [ ] Model basho/tournament data.
- [ ] Model rikishi/banzuke entries.
- [ ] Model fantasy teams and picks.
- [ ] Add team selection flow.
- [ ] Add result import or manual result entry.
- [ ] Add leaderboard calculation.
- [ ] Add leaderboard UI.

## Stage 4: Friendly single-league version

Goal: make it usable by a small group of friends.

- [ ] Add simple user identity or display-name-based teams.
- [ ] Add private league concept if needed.
- [ ] Add pick-locking before basho starts.
- [ ] Add basic admin flow for importing data.
- [ ] Improve responsive UI.
- [ ] Add error/loading/empty states.

## Stage 5: Public-ready version

Goal: make it robust enough to share more widely.

- [ ] Add proper authentication.
- [ ] Add production database and migrations.
- [ ] Add deployment pipeline.
- [ ] Add monitoring/logging.
- [ ] Protect admin endpoints.
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
