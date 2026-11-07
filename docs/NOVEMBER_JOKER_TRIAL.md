# November 2026 live joker trial

The owner approved trying the agreed three-joker rules with the November
friends group on 7 November, including a pre-start exception to the usual
rule-configuration lock. Existing stable selections and base scoring stay
unchanged. Reopening original picks is not needed to allocate a daily joker.

Activation is an explicit, authenticated admin action for **2026-11 only**,
with the expected 8–22 November dates. It succeeds only while the basho is
upcoming or locked at day 0, before **8 November 03:00 UTC / 12:00 JST**, and
before any stored result. These checks and insertion serialize on the same
basho row as result imports and lifecycle changes. Repeated requests return
the original activation, without changing its timestamp or administrator.
There is no disable, clock override, or mid-tournament configuration path.

The owner confirms that the preset applies to every stable in this basho.
Players retain three jokers, max one per day, targeting an owned rikishi.
The existing daily deadline, points, refunds, pending outcomes and audited
revisions remain those in JOKER_TRIAL.md. Live time always comes from the
server. Only the isolated demo uses its controllable clock.

## Release and operate

1. Review the complete release range, including the schedule-verification
   prerequisite. Deploy the reviewed merged SHA through the existing
   migration-gated Production workflow after the owner's release approval.
2. Verify migration, application SHA and database-backed smoke checks. No
   migration or activation runs merely from merging the source.
3. In Admin → Live basho, inspect November and confirm the saved base mode.
   Under **November joker trial**, check the explicit all-stables confirmation
   and choose **Enable November jokers**. The server repeats every guard.
4. Dry-run and then import Day 1's published Makuuchi card through the existing
   schedule importer. Check the following card too. Never create fake outcomes
   or mark a pre-bout schedule as verified result proof.
5. Collect the group's normal stables and use **Start the basho** or the
   existing lock before play. This keeps original picks locked while the
   current-day joker window can open. Importing a schedule does not start play.
6. On My Stable, test a save, edit and remove before the deadline; check the
   same persisted selection after refresh. No late or retrospective choices.
   Missing/unpublished schedules show unavailable; missing outcomes stay pending.
7. Existing result imports settle jokers and update standings. Check the saved
   base mode: wins-only does not introduce a gold-star bonus.

The daily job imports results and then attempts the next card. Day 1 needs
the explicit initial schedule import above; failed/unpublished following cards
need the existing manual schedule retry. No new cron, billing, notifications,
or third-party integration is introduced.

## Additive persistence and recovery

SQLite migration 0010_live_joker_trial.sql and Postgres migration
0009_live_joker_trial.sql create basho_live_joker_trial with preset,
base mode, activation time and verified admin ID. They retain every existing
table and row. The demo configuration table stays demo-only.

Activation freezes the existing scoring-config mode under the same transaction;
it does not change lifecycle, reopen picks, reset teams or grant admin access.
Existing allocation and append-only event tables record player actions.

The previous app ignores this separate live configuration table, so it can
still read the expanded schema. An application rollback temporarily shows
base scores without the trial bonuses; it neither deletes allocations nor
reinterprets them. Restore the trial-capable app to restore the full score
projection. Keep the schema and audit data; never run a down migration.
