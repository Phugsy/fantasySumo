# Fantasy Sumo Project Brief

## One-line summary

Fantasy Sumo is a fantasy sports game for professional sumo where players select rikishi before a basho and score points from their performance.

## Why this exists

Sumo has a compact tournament structure, a rich ranking system, memorable personalities, and clear win/loss outcomes. That makes it ideal for a small fantasy game that can be played casually by friends during each basho.

## Target experience

A player should be able to:

1. See the upcoming/current basho.
2. Browse rikishi and their ranks.
3. Pick a fantasy team before the tournament starts.
4. Follow their team's score during the tournament.
5. Compare scores on a leaderboard.

## MVP scope

The first useful version should be intentionally small:

- One active basho at a time.
- A fixed team size.
- Simple scoring based on wins.
- A leaderboard.
- Basic data import/update for banzuke and results.
- A simple local/dev deployment path.

## Out of scope for the first MVP

- Complex authentication.
- Payments.
- Public leagues with moderation tools.
- Mobile apps.
- Live push updates.
- Rich historical analytics.
- Complex scoring modifiers unless intentionally added later.

## Domain language

- **Basho**: A tournament.
- **Rikishi**: A professional sumo wrestler.
- **Banzuke**: The official ranking list for a tournament.
- **Heya**: A sumo stable.
- **Shikona**: A rikishi's ring name.
- **Bout/Torikumi**: A match.
- **Kimarite**: Winning technique.
- **Kachi-koshi**: More wins than losses in a tournament.
- **Make-koshi**: Eight verified not-wins (losses, fusen losses, or absences),
  meaning eight wins are no longer reachable.

## Open product decisions

These should be decided before implementing the full MVP:

1. Team size: how many rikishi does a player choose?
2. Selection constraints: can players pick any ranks, or must they choose from rank bands?
3. Scoring:
   - 1 point per win only?
   - Bonus for kinboshi/upsets?
   - Bonus for kachi-koshi?
   - Penalty for absent/withdrawn rikishi?
4. Timing beyond the MVP day-before cutoff: should leagues support a custom
   earlier lock time?
5. Leagues: global leaderboard only, or private friend leagues?
6. Auth: no auth, magic link, OAuth, or simple username for early MVP?
7. Data source: official sumo.or.jp endpoints, manual CSV import, or another maintained API?

## Recommended MVP scoring v0

Start with something simple and transparent:

- +1 point for each win by a picked rikishi.
- 0 points for a loss or absence.
- Team score is the sum of all picked rikishi points.
- Scores can be calculated from all supplied results or through a specific basho day.
- Leaderboard entries are ordered by score descending.
- Tied teams are allowed and are ordered deterministically by display name, then team id.

Keep this in an isolated scoring module so future bonuses can be added safely.

## Basho lifecycle

The MVP lifecycle is:

- `upcoming`: picks are open.
- `locked`: picks are closed before results are scored.
- `active`: results are being applied day by day.
- `complete`: final scores are available.

Fantasy teams and picks can be created or edited only while the persisted basho
status is `upcoming`. Moving the basho to `locked` closes picks immediately,
including when an administrator chooses to lock earlier than the scheduled
transition. The final status check and team-and-picks write must be one database
transaction so a concurrent lifecycle update cannot admit a save after
locking.

## Optional achievement scoring

The accepted `achievements-v1` mode adds kinboshi, eight-win, and final
special-prize bonuses to the original `wins-v0` mode. Rules are saved per basho
and freeze when picks first lock. See [Scoring rules](SCORING.md) for the exact
points, timing, missing-data treatment, and comparison behavior.
