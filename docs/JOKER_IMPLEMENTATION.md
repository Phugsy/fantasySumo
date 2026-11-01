# Joker demo implementation

The owner authorized a demo implementation of #114 on 31 October and a fresh
two-hour session on 1 November 2026. This prepares a reviewable change; it does
not authorize merging/releasing migrations, live activation, or real reminders.
The player contract remains `JOKER_TRIAL.md`.

## Additive persistence model

- `basho_joker_trial`: one explicit `three-joker-v1` opt-in for the fixed flagged
  demo basho, with its saved base mode and a controllable server demo clock.
  Enable only while original rules are still configurable. The base mode must
  still match the saved scoring mode; a mismatch fails closed. No live enable
  path is supplied. The clock can advance but cannot rewind; demo reset removes
  all trial state with the isolated fixture.
- `joker_allocations`: one row per team/day, recording the original rikishi,
  opponent and matchup identity, revision, server selection time and lifecycle
  projection. Removal keeps a tombstone. Editing needs the latest revision.
- `joker_events`: append-only repository operations with globally unique event
  IDs, team-owned request IDs, action payload fingerprints and saved responses.
  Retrying the same command returns its original response; reusing a request ID
  with another payload is rejected. Reconciliation appends resolution changes,
  including correction-driven reversals, without deleting accepted allocations.

Every mutation and reconciliation locks the basho row in Postgres; SQLite uses
an immediate transaction. The server reads clock, ownership, original picks,
published card, results, rule lock, revisions and the complete team allocation
budget within that transaction. Pending allocations count; refunded/removed rows
do not. A correction that restores consumption after later allocations have
been accepted exposes a budget discrepancy and blocks further allocations until
the facts or an explicit reconciliation resolve it. No later selection is erased.

Resolution is derived from exact original participants and verified results;
schedule replacements never silently change the target. Confirmed cancellation
requires an attested matching cancelled card. Missing/ambiguous facts stay
locked/pending. Scoring adds a separate joker category to team-owned scores and
history through the same contiguous verified-day boundary. The public rikishi
score remains an unmodified base score.

Notifications remain separate #115. The subsequent preparation uses a stub
transport and the proposed 20-tester/one-device/one-basho caps. Real sends,
subscriptions, provisioning, spending and production release require the
corresponding owner approvals.

## Run the isolated demo

1. Use a dedicated local SQLite or local test Postgres database, migrate it and
   seed the deterministic demo. Do not reset live or production data.
2. Sign in as the configured demo administrator. Choose the base scoring mode
   before starting. In Admin -> Demo fixture, enable **Joker trial** while picks
   are still open. The named preset starts the demo clock at 11:00 JST on day 1;
   it then advances with elapsed server time. Base scoring can change only until
   the existing permanent scoring-rule lock, and the preset follows it.
3. Create a normal stable, then start the demo to lock original picks. My Stable
   shows each daily Pick Window, deadline/countdown, owned targets, current
   allocation, remaining allowance and allocation history. Refresh the window to
   reconcile newly imported facts. Original picks cannot be replaced by a joker.
4. The administrator can advance the UTC ISO demo clock, then advance results.
   Time cannot rewind. Day 2's first bout is a synthetic fusen win (refund); day
   4's first bout is a synthetic Ura win over Onosato (gold star). These changes
   apply only when the trial is enabled; normal demo fixtures remain unchanged.
   Other days retain contested wins/losses and the existing withdrawal fixture.
5. Reset deletes this demo's preset, clock, allocations and audit fixture, while
   live data and existing tournament rules remain intact.

The authenticated player endpoint is `GET/PUT /api/basho/:id/my-jokers`. Writes
include day, canonical rikishi, original opponent/bout IDs, expected revision and
an idempotency request ID. The existing protected demo-admin boundary guards
`GET/PUT /api/admin/demo/jokers`; the only write options are enable or advance
clock. No browser timestamp can override player deadlines. This has no live
activation endpoint.

SQLite migration `0009_joker_trial.sql` and Postgres migration
`0008_joker_trial.sql` add three tables. Existing schema/data are retained. Audit
updates are rejected by database triggers; repository operations only append.
The deliberate isolated demo reset can cascade-delete fixture audit records.
Reads reconcile the lifecycle projection and append changed resolution events
within the same transaction, so correction/refund observations are durable.

Run `make check` then `make e2e` sequentially (the E2E dev API watches shared build
outputs). The default DB suite covers SQLite. To exercise actual Postgres races,
point `JOKER_TEST_POSTGRES_URL` at a disposable local database on port 55434; the
suite rejects non-local targets and resets only that dedicated test database.
It uses two independent clients for the concurrency checks. Do not use hosted
or production credentials. An application rollback can retain the additive
schema; no down migration is needed or authorized.
