# Rikishi honours

The Rikishi honours panel in the current leaderboard and archived standings
shows real tournament awards, including recipients outside every fantasy
stable. The leaderboard API returns the same honour facts in both views.
The panel explains the bonus under the selected scoring preset.

Gold stars use the same contested Maegashira-over-Yokozuna rule as scoring.
The list includes the day and defeated Yokozuna for each qualifying bout
through the last contiguous verified result day. Fusen and absent wrestlers
are excluded. A recorded gold star can exist under wins-only scoring.

Special prizes come from the existing saved Sumo API snapshot after all
tournament days are verified. A missing snapshot is pending. A confirmed
snapshot with no recipient for a category shows “No award”. Corrections to
verified bouts or the saved prize snapshot update the panel.

## Champion and runner-up follow-up

The [September 2026 official results](https://sumo.or.jp/EnHonbashoMain/champions/1000/)
publish the Makuuchi champion and special-prize recipients. The existing
[Sumo API basho endpoint](https://www.sumo-api.com/api/basho/202609) supplies a
Makuuchi yusho with a source rikishi ID, plus the special prizes. It has no
runner-up field. The current prize importer uses the presence of a Makuuchi
yusho to validate the snapshot and stores the special prizes.

To add the reigning champion for #107, retain a validated Makuuchi champion
with its source and canonical identity during that import. Backfill only
matched completed bashos and use the latest verified record on the home page,
including while the next basho is active. Jun-yusho needs a source or documented
playoff-aware derivation before it can be displayed. Any fantasy point value for
yusho or jun-yusho is a separate scoring decision.
