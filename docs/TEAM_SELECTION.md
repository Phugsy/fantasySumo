# Team selection rules

The composition limits approved for #132 apply to live bashos with canonical
IDs from `2027-01` onward, and to the deterministic demo. November 2026 and
earlier live tournaments retain `open-v0`, including creation and editing while
picks remain open. The fixed tournament-ID boundary does not move with the
wall clock, late imports, or corrected start dates. No existing teams or
historical scores are rewritten. No schema migration is required.

The API publishes `pickCompositionMode` on the current basho and the banzuke
response. `heya-sanyaku-v1` requires:

- No more than two sanyaku picks in total: Yokozuna, Ozeki, Sekiwake and
  Komusubi all count towards that same cap. There is no minimum.
- No more than one rikishi per real-world stable (heya), across all ranks.
- The configured total team size, distinct rikishi, ownership and existing
  lifecycle/per-team locking rules still apply.

Rank and heya come from that basho's stored banzuke snapshot. Current shared
rikishi metadata is never a validation fallback. Full English rank labels are
matched explicitly, with optional rank number, `#`, and East/West suffix;
case, whitespace and romanisation diacritics are normalized. Unknown or
ambiguous rank/roster data cannot be picked under the new rules.

Heya comparison normalizes Unicode, case, diacritics, whitespace and dashes,
and optional trailing `beya`, `heya`, `stable` or `部屋`. Empty and known
placeholder labels are unavailable. This handles formatting variants of the
same label; it does not guess at translations, mergers or unrelated names.
Importers/operators must reconcile genuinely different aliases to a consistent
tournament snapshot before picks can be accepted. Missing snapshot heya blocks
that pick even if global metadata happens to contain a stable.

Both API create and replacement routes enforce composition inside the same
transaction that checks lifecycle and saves the team/picks. Postgres locks the
basho row, serializing with banzuke imports and lifecycle transitions; SQLite
keeps the synchronous read/check/write sequence in one transaction. Validation
errors return `400 invalid-picks` with structured details, before changing the
team name, picks or fallback configuration. Team-size conflicts and pick locks
retain their existing `409` responses.

The editor mirrors the API's mode, displays both limits, explains blocked
choices and keeps selected rikishi removable. A corrected banzuke can make an
existing open selection invalid; the editor requires a legal replacement but
does not silently remove picks. Locked teams and scored history remain intact.

## Verification

Domain tests cover rank/heya normalization, both caps, unavailable data and the
rollout boundary. API tests cover create/replacement rejection, atomic
preservation and legacy rules. Persistence tests cover SQLite by default and
can run against a disposable Postgres database:

```sh
PICK_COMPOSITION_TEST_POSTGRES_URL=postgres://postgres@127.0.0.1:55435/fantasy_sumo_selection_test \
  pnpm --filter @fantasy-sumo/db exec vitest run src/pick-composition-repositories.test.ts
```

That database is reset by the tests. The harness rejects other hosts, ports
and database names. Postgres checks use two clients and verify actual lock
waiting before committing a changed roster or closed lifecycle.

`e2e/pick-composition.spec.ts` uses the configured dedicated E2E SQLite file,
temporarily gives only the flagged demo three slots, and restores its previous
configuration afterward. It verifies both limits, removal/replacement, saves,
API rejection preserving an existing stable, and locking on desktop Chromium,
mobile Chromium and mobile WebKit.
