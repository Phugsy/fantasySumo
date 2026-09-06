# Scoring rules

Decision for #92, agreed 6 September 2026. Each basho has its own persisted,
versioned mode. New and migrated bashos default to `wins-v0`. Administrators
may select `achievements-v1` until picks first lock, including after teams have
been submitted. This agreed lock point supersedes the issue's initial suggestion
to freeze rules before picks open. Once locked, the mode cannot change, including
when an administrator reopens picks. Different future values require a new
versioned mode; never change the meaning of either existing identifier.

| Event                                              |       `wins-v0` | `achievements-v1` | Timing and conditions                                                                               |
| -------------------------------------------------- | --------------: | ----------------: | --------------------------------------------------------------------------------------------------- |
| Regulation win                                     |              +1 |                +1 | On the verified result day.                                                                         |
| Default/fusen win                                  |              +1 |                +1 | Counts toward eight wins; never a kinboshi.                                                         |
| Kinboshi                                           |               0 |          +2 extra | Each non-default maegashira victory over a yokozuna, using this basho's stored banzuke.             |
| Kachi-koshi                                        |               0 |           +3 once | On the day of the eighth verified win. No further bonus for nine or more wins.                      |
| Outstanding Performance / Shukun-sho               |               0 |                +1 | Confirmed final award, applied to day 15.                                                           |
| Fighting Spirit / Kanto-sho                        |               0 |                +1 | Confirmed final award, applied to day 15.                                                           |
| Technique / Gino-sho                               |               0 |                +1 | Confirmed final award, applied to day 15.                                                           |
| Loss, fusen loss, absence, withdrawal, make-koshi  |               0 |                 0 | No penalty; previously earned wins/bonuses remain.                                                  |
| Missing result                                     | 0 provisionally |   0 provisionally | Never infer a win, absence, or achievement. Live scoring stops at the last contiguous verified day. |
| Other rank upsets, championship, streaks, playoffs |         0 extra |           0 extra | No additional bonuses. The import boundary accepts regulation bouts only.                           |

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
standings use each basho's persisted mode. The leaderboard's explicitly labelled
“What if” selector projects the same categories under either mode. This changes
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
basho must be complete. Source names map using the existing shikona identity
boundary; ambiguous/unmatched winners fail closed. Rename-safe provider aliases
remain #102. The source does not expose an independent completeness attestation
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
