# Scoring rules

The owner-approved future daily joker trial is specified in
[Daily joker trial](JOKER_TRIAL.md). It is not enabled by the current modes and
does not change existing tournament scores.

Decision for #92, agreed 6 September 2026. Each basho has its own persisted,
versioned mode. New and migrated bashos default to `wins-v0`. Administrators
may select `achievements-v1` or `achievements-v2` until picks first lock, including after teams have
been submitted. This agreed lock point supersedes the issue's initial suggestion
to freeze rules before picks open. Once locked, ordinary administrators cannot
change the mode, including when picks reopen. The explicit site-owner override
below is the owner-approved exception added after 7 November UAT. Different future values require a new
versioned mode; never change the meaning of an existing identifier.

## Site-owner correction

Only verified user IDs in the server-only `SUPER_ADMIN_USER_IDS` allowlist may
override a locked official mode, including after results or completion. The
owner confirms a full-tournament rescore and gives an 8–500 character reason.
The request includes the mode they reviewed; a conflicting current mode returns
409 rather than silently overwriting another correction. Ordinary administrators
keep the original lock policy, and league-specific roles are not introduced.

The transaction locks the basho row on Postgres (an immediate transaction on
SQLite), updates its mode and any demo/live joker base mode together, and appends
an audit entry with actor, reason, old/new mode and server time. Audit failure
rolls the entire change back. Unchanged retries do not add duplicate entries.
Picks, stored results and accepted joker allocations are retained. Scores,
per-day history, My Stable, tournament history and all-time standings are derived
again from the original facts under the new saved mode. The ordinary scoring-lock
flag remains set. The owner can inspect the latest 20 override events in Admin.

The additive `basho_scoring_overrides` table is introduced by SQLite migration
0011 and Postgres migration 0010. Older application code ignores the table and
continues respecting the saved lock; rollback never removes the audit schema.

| Event                                         |       `wins-v0` | `achievements-v1` | `achievements-v2` (achievement focus) | Timing and conditions                                                                 |
| --------------------------------------------- | --------------: | ----------------: | ------------------------------------: | ------------------------------------------------------------------------------------- |
| Regulation or default/fusen win               |              +1 |                +1 |                                    +1 | On the verified result day. Default wins count toward eight wins, but never kinboshi. |
| Kinboshi                                      |               0 |          +2 extra |                              +3 extra | Each non-default maegashira win over a yokozuna, using the saved banzuke.             |
| Kachi-koshi                                   |               0 |           +3 once |                               +1 once | On the eighth distinct verified winning day.                                          |
| Outstanding Performance / Shukun-sho          |               0 |                +1 |                                    +3 | Confirmed final award, on day 15.                                                     |
| Fighting Spirit / Kanto-sho                   |               0 |                +1 |                                    +3 | Confirmed final award, on day 15.                                                     |
| Technique / Gino-sho                          |               0 |                +1 |                                    +3 | Confirmed final award, on day 15.                                                     |
| Loss, absence, withdrawal, make-koshi         |               0 |                 0 |                                     0 | No penalty; earned points remain.                                                     |
| Missing result                                | 0 provisionally |   0 provisionally |                       0 provisionally | Never infer an outcome; live scoring stops at the contiguous verified boundary.       |
| Other upsets, championship, streaks, playoffs |         0 extra |           0 extra |                               0 extra | Regulation bouts only; no extra award.                                                |

`achievements-v2` is the owner-approved achievement-focused alternative added
on 8 November 2026, labelled **Wins + achievements · achievement focus**.
A kinboshi is worth four points in total: one for the win and three bonus.
A joker doubles those bout contributions to eight; it does not multiply the
one-point eighth-win milestone or the three-point special prizes. Existing
presets, default `wins-v0`, selected tournaments and historical results retain
their current meaning. Adding this option does not activate it for any basho.

All three presets are defined centrally in `packages/domain/src/scoring-presets.ts`.
The read-only comparison reweights category points from the official source
preset into the selected target preset, including joker kinboshi and daily
history. Displaying a comparison does not save or rescore official rules.

### Future configurable values

An admin UI for category values can build on this catalogue, but is not included
in this change. Store a complete, versioned weight snapshot per basho, show the
saved values to players, and freeze it at the existing scoring lock. Any owner
correction must use the existing explicit full-rescore confirmation and audited
old/new values. Never mutate a named preset globally or apply later edits to
historical bashos. The shared evaluator, joker exclusions, comparison and history
must all consume the same snapshot before arbitrary custom values are enabled.

Special prizes stack across distinct categories. Several recipients can receive
the same prize. Reimporting an award never adds it twice. A confirmed final
snapshot with no recipient for a category means no award in that category;
missing/invalid source data remains pending, not a confirmed zero.

A team sums its picks' contributions. Equal totals remain tied on score; existing
ordering uses display name, then team ID to provide stable numbered positions.
No bonus-specific tiebreaker applies. Day-bounded queries include only events
through that day. Correcting results or final awards recomputes both totals and
history under the original mode; removing an eighth win removes or moves its
bonus, and corrected prizes amend day 15 rather than the import date.

## Separate categories and comparison

The domain calculates potential points for wins, kinboshi, eight wins, and each
of the three prizes separately. API team and rikishi totals and per-day
contributions expose that breakdown. Stored bout results, banzuke ranks, and
award snapshots remain the facts; weighted totals are derived, not incremented
or overwritten in the database.

The official leaderboard, My Stable, tournament history, and cumulative
standings use each basho's persisted mode. Tournament, all-time, and personal
history scores stop at the same last contiguous day verified against complete
schedule publications, even if an administrator closes a basho early. Stored
wins beyond that boundary contribute no points or achievements until verified.
Only completed, non-demo bashos contribute to cumulative totals; active bashos
remain visible in personal history with their verified individual scores. The leaderboard's explicitly labelled
“What if” selector projects the same categories under any supported mode. This changes
only the displayed totals, ordering, and score chart. It makes no write request,
does not change official history, and resets to official when the page reloads
or a different basho is selected. In wins-only views, bonus columns remain
visible but crossed out and labelled as excluded.

## Source facts and special-prize import

Kinboshi requires both tournament rank facts and a verified result with neither
an absent winner nor a default/absent loser. Unknown ranks earn no inferred
kinboshi. Kachi-koshi requires eight distinct verified winning days. Neither
bonus depends on informational UI badges or current global rikishi rank.

The existing [Sumo API basho endpoint](https://sumo-api.com/api-guide) provides
`specialPrizes` with `type`, provider `rikishiId`, and `shikonaEn`. A read-only
check on 6 September 2026 found that array in all nine completed bashos from
March 2025 through July 2026. July matched the [official JSA winners](https://sumo.or.jp/EnHonbashoMain/champions/1000/).
The provider [documents final-day prize publication](https://www.sumo-api.com/webhooks),
but historical availability is not a guarantee of punctual publication or uptime.
No webhook subscription or additional paid service is required.

The isolated adapter accepts only a matching basho, a Makuuchi yusho signal,
an explicit prize array, known prize categories, unique recipient/category
pairs, and recipients matched to the persisted tournament roster. The local
basho must be complete. Provider `rikishiId` values resolve through established
Sumo API aliases to canonical local rikishi IDs; shikona is display metadata.
Unknown IDs fail closed without replacing saved awards. The source does not expose an independent completeness attestation
for its prize array; finality is inferred from its documented completed-basho
payload and our completed results. Protected reimports support later corrections.

Final-day result imports attempt prizes after results commit. Prize failures
return partial success and preserve previous awards and completed results.
The existing protected cron independently retries the latest completed live
basho's missing prize snapshot after it leaves the bout-import window. Historical
backfills/corrections use `POST /api/admin/basho/:bashoId/import-prizes`, with
`?dryRun=true` for validation; the admin page exposes this for its selected
completed live basho. Existing import authorization applies, and live source
imports reject demo IDs. No separate scheduled automation is created.

A confirmed snapshot stores source and fetch-start time. Replacement is atomic
and ignores an older in-flight response that finishes after a newer snapshot.
Missing/invalid responses never erase the last valid snapshot. Confirmed snapshots
are not polled indefinitely; rerun the protected import for source corrections.

The deterministic demo supplies fake, stable final awards, including one rikishi
with two prizes. Reset clears those awards and restores `wins-v0` with rules
editable; it affects only the fixed demo records.

## Persistence and deployment

`basho_scoring_config` is separate from team-size configuration and imported
basho facts. The migration materializes `wins-v0` for all existing bashos and
marks rules locked for non-upcoming bashos or those with previously locked teams.
Database triggers initialize new bashos and permanently mark the configuration
locked on any non-upcoming lifecycle write. This covers imports, cron, admin,
and the still-running older application during deployment. Postgres mode writes
lock the basho row, serializing with lifecycle transitions; SQLite performs the
check and write in one transaction.

`special_prize_snapshots` stores one validated JSON award list and its provenance
per basho. The two additive tables and triggers preserve the old application
schema and behavior. Deploy through the existing migration-gated workflows;
never recover using a down migration. The Postgres trigger function is one SQL
line because the current runner splits statements at semicolon/newline boundaries.

### Achievement-focus schema expansion

SQLite migration `0012_achievement_focus.sql` widens the mode checks on the two
joker trial tables and scoring override audit table by copying all rows into
equivalent tables in the migration transaction. Their columns, foreign keys,
original modes, allocations and joker events are preserved. Postgres migration
`0011_achievement_focus.sql` widens the corresponding check constraints in place.
No migration activates the new preset or changes existing scores.

The expansion accepts old application reads and writes while an old preset is
selected. An older application does not understand `achievements-v2`; once it
is explicitly selected, keep a compatible application deployed and use forward
fixes. Do not assume a schema rollback or silently reinterpret its points.
