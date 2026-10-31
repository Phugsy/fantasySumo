# Daily joker trial

Product decision for #93, agreed with the owner on 31 October 2026.
This is the contract for a future opt-in trial; jokers are not implemented or
enabled by this documentation change. See [Scoring rules](SCORING.md) for the
currently implemented modes.

## Player rules

Each player receives **three jokers per basho**, with **at most one per basho
day**. Each joker targets one scheduled bout of a rikishi in that player's own
stable. Jokers cannot target an unpicked rikishi, stack on a bout, transfer
between players, or replace a stable member. The original stable remains
subject to the existing tournament pick lock. This replaces the proposed fixed
captain and substitute mechanics for the first trial.

A player can select, change, or remove that day's joker while its daily Pick
Window is open. An unremoved selection locks at the deadline. A player may skip
a day and retain unused jokers; there is no requirement to act every day.
Editing a selection does not consume another joker. Pending allocations count
toward the three-joker allowance, preventing a player from reserving more than
they can use. A refund is available only for a future open day, never for a
second choice on a day whose window has already closed.

## Daily Pick Window

The window opens once the day's validated matchup card is available, potentially
on the previous evening, and closes at **12:00 Asia/Tokyo / 03:00 UTC on the
bout's Japan calendar date**. Derive the calendar date from the basho start date
and day number, not the result-import time or the player's timezone. Display
the deadline in the player's local time, with the Japan date/day clearly shown.

The server accepts a change only strictly before the deadline; a request at or
after it is late. Notifications, browser clocks, delayed cron runs, or an admin
reopening original stable picks cannot extend or reopen the daily window.
No schedule means no eligible selection. A card published after the deadline
does not create a late window. Show unavailable data separately from a closed
window or a confirmed cancelled bout.

The cutoff is a deliberately conservative trial policy, not a claim that
individual bouts have exact start timestamps. The current schedule model
stores a day and participants but no bout-start timestamp. Evaluate the
cutoff against supported tournament schedules before activating the trial;
any later policy needs a new version for future tournaments.

## Points and refunds

The joker doubles only the selected bout's win points and any eligible
kinboshi/gold-star bonus under that tournament's saved base rules. It does not
introduce a kinboshi bonus into a wins-only mode. Kachi-koshi, special prizes,
and other tournament-level bonuses are not multiplied.

| Outcome                        | Joker effect                                                 |
| ------------------------------ | ------------------------------------------------------------ |
| Contested win                  | Double the bout's included win and kinboshi points.          |
| Contested loss                 | Consume the joker for zero additional points.                |
| Confirmed cancellation/no bout | Refund the joker for a future open day; no joker points.     |
| Default/fusen outcome          | Refund the joker; preserve ordinary scoring without a boost. |
| Missing or unverified result   | Keep the allocation pending; do not assume a loss or refund. |

For example, under `achievements-v1` a normal win contributes 2 instead of 1,
and a kinboshi contributes 6 instead of 3. If that win also earns the existing
3-point kachi-koshi award, the combined contribution is 9, not 12. A default
win retains its ordinary 1 point and returns the joker.

Withdrawal never silently substitutes a rikishi or moves a joker. An explicit
cancelled/unplayed or default outcome follows the refund rule above; a missing
result remains pending. A returning rikishi can be selected for a later open
day if the player still has a joker available.

## Versioning, persistence, and enforcement

- Add an explicitly named, opt-in versioned trial preset retaining its saved
  base scoring mode and joker/window policy. Freeze those rules at the normal
  permanent scoring-rule lock; do not change `wins-v0`, `achievements-v1`, or
  existing tournaments. A daily joker action is distinct from changing rules.
- Retain original stable picks and canonical rikishi identity. Store each
  allocation's team, basho/day, target rikishi and matchup identity, rule
  version, server timestamp, and lifecycle state. Preserve an audit history
  of selection, edits, removal, locking, consumption and refund.
- Recheck authenticated ownership, stable membership, published matchup,
  deadline, tournament eligibility, per-day uniqueness and remaining budget
  in the same transaction as each allocation write. Serialize concurrent
  requests in both SQLite and Postgres; retries must be idempotent.
- A changed or withdrawn matchup cannot silently retarget a locked choice.
  Preserve the original choice and resolve it from verified source facts;
  ambiguous replacements remain pending until attested. Reject a stale
  matchup submission while the window is open and ask the player to refresh.
- Derive bonus totals and per-day history from the original allocation and
  verified results, retaining the existing contiguous verified-day boundary.
  Reimports/corrections must not duplicate points, refunds or token grants.
  Never delete or reinterpret a previously accepted later allocation to hide
  a correction conflict; record and surface any resulting budget discrepancy
  for reconciliation rather than silently changing stable history.
- Use backward-compatible additive migrations with SQLite/Postgres parity.
  Test the older application against the expanded schema. Production release
  approval must cover the actual migration-bearing SHA and whole unreleased
  range. Never use a down migration for recovery.

## Validation and rollout

Implement and verify the complete flow before calling the trial ready:

- Domain: 3-token budget, 1-per-day rule, owned-pick eligibility, exact cutoff
  boundary, Japan dates/local display, win/loss/gold-star calculations,
  kachi-koshi exclusion, fusen/cancellation refunds, withdrawal/return, pending
  facts and corrected results.
- Persistence/API: cross-user rejection, stable and rule locking, concurrent
  submits and changes on the same/different days, idempotent retries, atomic
  budget enforcement, immutable audit events and SQLite/Postgres parity.
- E2E: select/change/remove a joker, lock at the deadline, reject stale/late
  writes, exhaust the allowance over three days, refund and reuse on a future
  day, preserve pending results, and reconcile leaderboard/stable/history.
- Demo: deterministic owned and unowned targets, contested win/loss, kinboshi,
  default and cancelled bouts, withdrawal/return, missing/corrected cards and
  controllable server time. Keep all fixtures isolated from live data.
- Run focused tests, `make check`, full relevant E2E and a desktop/mobile visual
  pass, then independent and final-SHA automatic review. Trial in the demo
  before enabling it for a future live basho; keep past tournaments unchanged.

## Notifications follow-up

Ship a visible daily window state, local deadline/countdown, current selection
and remaining allowance as part of the joker UI. External notifications are a
separate investigation and must not be required for eligibility or enforcement.

Compare opt-in browser push and email using expected player count and at most
one opening notification per day. Document permission/device support,
subscription storage and deletion, unsubscribe controls, deduplication,
late/missed sends, delivery limitations, provider and execution costs, and an
approved budget before enabling a service. Notify on actual eligible window
opening, not an assumed fixed time; skip stale closed windows. Do not provision
services, enable billing or send messages as part of this decision ticket.

Current app inspection found no push subscription/service-worker layer. Browser
push is technically possible; iPhone support requires a Home Screen web app and
permission. Authentication email configuration does not by itself implement
game reminders. See [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
and [WebKit's iOS support](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
