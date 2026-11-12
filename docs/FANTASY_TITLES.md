# Fantasy basho titles

These are fantasy competition honours, separate from real rikishi yusho and
jun-yusho. The owner approved shared titles on 8 November 2026 for #128.
They do not add points or change a saved scoring mode.

## Eligibility and ties

The single domain definition uses official saved-mode standings. A live,
completed basho needs at least two entrants and a contiguous verified result
history covering every scheduled tournament day. A completion flag or calendar
date alone is insufficient. Achievement scoring also needs a confirmed final
prize snapshot, including an explicitly empty list. Every joker allocation must
be settled/removed and its budget reconciled before titles are confirmed.
Demo bashos never contribute to live honours.

All teams on the highest point total share yusho. If first is shared, no
jun-yusho is awarded. Otherwise all teams on the next distinct total share
jun-yusho. Display-name/team-ID ordering and numeric display positions never
break a title tie. Even zero totals can tie if all other verification gates
are met. One or zero entrants receive neither title.

## Derived history and corrections

The per-basho finish, announcement and all-time counts use the same definition.
Titles are derived on reads from existing facts, not inserted into a new award
table. Reimports and repeat reads cannot duplicate them. Corrections recompute
recipients and counts; a newly incomplete history withdraws confirmation until
verification is restored. Existing cumulative-points ordering is preserved.

All-time counts use the existing persistent owner identity across stable and
player name changes. Historical unowned legacy teams retain their existing
separate per-basho identities; the app never guesses an owner from a name.
The UI shows zero counts and the number of title-eligible verified tournaments,
so unverified history is not presented as a final title result.

## Announcement and discoverability

A signed-in player sees their latest eligible completed basho, even after the
next basho starts. The app checks existing public standings and private owned
history on entry, return to the tab and every two minutes while visible.
Background/overlapping requests are skipped; failures never block the game.
There is no push permission, subscription, message delivery or server cron.

Dismissal is scoped to browser, signed-in user and basho, across navigation and
refresh. Browser storage failure falls back to the mounted session. Escape and
the dismissal button close the native dialog, whose focus returns to the prior
connected element. Result corrections do not re-interrupt a dismissed basho;
the linked final standings always show the current derived outcome. Signing
in on another browser can show the announcement again. Old unseen tournaments
are not queued as a series of popups.

The current completed leaderboard and History retain an honours summary.
History archive links open `/history?basho=<id>` with official final standings;
only IDs from the loaded archive can trigger that read. Incomplete outcomes
are labelled unavailable rather than announced as final. Personal picks remain
under their existing ownership boundary.

No migration, authentication policy, scoring override, external dependency,
notification provider or new service is introduced.

## Player title achievements

Signed-in players can see four lifetime badges in History (#133). Emperor’s Cup,
Rice for the Stable and Giant Fish mark the first three career yusho. First
Runner-up marks the first jun-yusho. Shared titles count, and only confirmed
finishes joined to the player's owned team for that basho contribute. Each badge
links to the tournament that reached the threshold. The catalogue uses stable
badge IDs and derives progress from current verified history, so corrections
can move or remove a badge. Awarding a badge adds no fantasy points.

To add a title milestone, add a catalogue entry with a new ID, title and
threshold in `packages/domain/src/player-achievements.ts`, then add its artwork
mapping and a qualification case. Other badge families need their own agreed
rules and qualifying evidence.
