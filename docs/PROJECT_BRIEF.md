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
- **Make-koshi**: More losses than wins in a tournament.

## Open product decisions

These should be decided before implementing the full MVP:

1. Team size: how many rikishi does a player choose?
2. Selection constraints: can players pick any ranks, or must they choose from rank bands?
3. Scoring:
   - 1 point per win only?
   - Bonus for kinboshi/upsets?
   - Bonus for kachi-koshi?
   - Penalty for absent/withdrawn rikishi?
4. Timing: when do picks lock?
5. Leagues: global leaderboard only, or private friend leagues?
6. Auth: no auth, magic link, OAuth, or simple username for early MVP?
7. Data source: official sumo.or.jp endpoints, manual CSV import, or another maintained API?

## Recommended MVP scoring v0

Start with something simple and transparent:

- +1 point for each win by a picked rikishi.
- 0 points for a loss or absence.
- Team score is the sum of all picked rikishi points.
- Ties are allowed initially.

Keep this in an isolated scoring module so future bonuses can be added safely.
