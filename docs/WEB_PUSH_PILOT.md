# Proposed Pick Window Web Push pilot

Prepared for #115 after the owner requested the joker demo followed by a proposed
20-tester pilot. This is a reviewable proposal and offline rehearsal, not an
enabled notification feature. The joker demo is a separate change in PR #120.
The original comparison and investigation are in
[the issue report](https://github.com/Phugsy/fantasySumo/issues/115#issuecomment-6549746558).

## Decision to approve before live implementation

| Item                      | Proposed limit                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| Audience                  | Fixed roster of at most 20 invited, consenting testers                                       |
| Duration                  | One explicitly named basho; disable at its end                                               |
| Devices                   | One selected active device per tester; replacement disables the old one                      |
| Volume                    | At most one opening attempt per player/basho/day, 20/day and 300/basho                       |
| Quiet hours               | 22:00 inclusive to 08:00 exclusive in the player's selected IANA timezone                    |
| Quiet or missed opening   | Skip; no delayed reminder, catch-up send or retry                                            |
| Cash budget               | $0 incremental target, conditional on existing hosting/database allowances                   |
| Subscription retention    | Delete on opt-out, account deletion, permanent expiry, or seven days after the basho         |
| Delivery status retention | Non-sensitive counts/statuses only; delete after 30 days                                     |
| Stop conditions           | Owner stop, cap reached, insufficient existing resource allowance, privacy/security incident |

Preparation does not approve spending, production migration/release, actual
subscription collection or tester messages. Approving the proposal would permit
preparing the real implementation and its security review. The actual release
SHA/range, activation and consenting-device test remain explicit launch gates.
No email service or multi-device fan-out is proposed.

Twenty testers is a planning ceiling, not a claim about current player numbers.
20 × 15 days gives 300 attempts; exhausted jokers, existing selections and absent
eligible bouts reduce that number. Failed and uncertain attempts still count.
Do not rotate the roster to circumvent the cap.

## Player experience and device reach

Keep My Stable's authoritative open/closed/unavailable state, local deadline and
remaining jokers as the primary interaction. An optional **Pick Window reminders**
control explains one-device delivery and best-effort timing before offering
**Enable on this device**. Ask permission only after that action. If unsupported,
denied or installation is required, show the in-app fallback and instructions.
Never imply that a reminder extends eligibility or guarantees a timely alert.

Web Push uses a service worker and browser subscription and can reach an app
that is not loaded. On iPhone/iPad, the documented iOS/iPadOS 16.4+ route requires
a Home Screen web app and a permission request following direct interaction.
Apple does not require Developer Program membership. Feature-detect APIs and
validate the actual supported devices before invitation. Focus/OS settings can
prevent or delay display. See [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
and [WebKit's implementation guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Offer **Disable reminders everywhere** independently of browser cleanup. Disable
server-side first, then attempt browser `unsubscribe()`; failure of the latter
must not restore consent. Detach the device before completing sign-out or account
switch so a shared device cannot retain the previous player's binding. Another
account cannot silently take over an active binding. An already handed-off push
cannot be recalled; keep its payload generic. Clicking always loads current
server state. See [unsubscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/unsubscribe)
and [subscription expiration](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/expirationTime).

Suggested permission explanation: “Get up to one reminder when your daily Pick
Window opens. Delivery can be delayed. Your deadline stays the same. Reminders
are skipped between 10pm and 8am in your selected timezone. You can turn them off
at any time.” The payload itself says only: “Today's Pick Window is open. Check
the app for your deadline.” No player, stable, rikishi or account details.

## Publication and execution contract

Use the committed, validated card and the same server joker eligibility as the
game, never a timer or notification receipt to create a window. The integration
points to cover are `importScheduledBouts` and
`importScheduledBoutsAndBoutResults` in `apps/api/src/imports/service.ts` after
their repository transactions commit. These are used by explicit admin schedule
imports and the scheduled daily-update path. Dry runs, rolled-back imports and
incomplete cards emit no opening. Reimports, corrections and multiple supported
paths share one opening identity `(player, basho, day, opening)`.

The current `runScheduledResultsImport` pre-basho day -1/day 0 branch only locks
picks. It does not publish day one's card. A protected day-one admin schedule
import already exists, but reliable operation must demonstrate that complete
card before its cutoff. This is a launch dependency, not a request to add another
cron. Late or unavailable cards skip the reminder and preserve normal game rules.
The demo's preseeded cards alone do not validate the live publication path.
There is also a concrete live adapter blocker: `fetchSumoApiScheduleImport`
currently supplies no banzuke evidence to `mapSumoApiSchedulePayload`, whose
`isComplete` attestation needs that evidence. Its `hasAttestedCompleteCard`
helper additionally requires resolved winners. Ordinary future cards therefore
cannot currently satisfy the non-demo attestation used by `jokerWindow` in
PR #120. Before a live trial, implement and verify a separate trustworthy
pre-bout publication contract without weakening existing result-completeness
checks. The fixed demo-fixture exception is not evidence for live eligibility.
Treat that work as a prerequisite to real notification implementation/activation,
not something a sender can bypass by treating any source response as complete.

After the import commits, await a bounded sender within the existing invocation;
do not fire-and-forget work after responding. Notification failures never roll
back imports or valid picks. No new cron, queue or provider subscription is part
of this pilot. Existing invocation headroom must fit the maximum 20 attempts;
otherwise stop and return to the owner with measured limits.

In one serialized claim transaction, recheck consent/device revision, trial
activation, roster, card publication, server window, current own-stable target,
remaining allowance, existing daily selection, strict 12:00 JST cutoff and
global counters. Use the established basho lock order to avoid import deadlocks.
Persist an opening decision for skips too: a quiet-hours reimport must not become
a delayed reminder. Atomically reserve a unique attempt and increment the
day/basho counters before network I/O; commit with status `unknown` so a crash
cannot cause replay. Never retry `unknown`, rejected or timed-out sends during
the pilot. A confirmed service acknowledgement becomes `accepted`, which means
neither displayed nor read. A permanent invalid/expired response disables only
the matching subscription revision, preserving a replacement device.

Immediately before handoff, recheck consent and current eligibility again; skip
if changed. A change after network handoff cannot recall delivery. Bound TTL to
whole seconds remaining before cutoff; skip when less than one second remains.
The future service worker drops expired payloads before display, uses a stable
notification tag, and opens the same-origin app to fresh server state. OS display
can still occur late, so avoid promises about arrival time. No action in a push
payload can select a rikishi, modify picks or reopen a window.

## Proposed persistence and security review

The live implementation would require additive SQLite and Postgres migrations;
none are included in this preparation. Suggested records:

| Record           | Required fields and invariants                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Pilot            | Named basho, enabled/stop state, immutable caps, fixed roster and expiry                                                                |
| Consent/device   | Owner, one active device, endpoint and encryption keys, consent time, IANA timezone, nullable expiry, monotonically increasing revision |
| Opening decision | Unique owner/basho/day/opening, consent revision, skip reason or reserved attempt, coarse accepted/failed/unknown status, timestamps    |
| Counters         | Serialized per-basho/day and total attempted counts, including unknowns                                                                 |

Keep endpoints and keys server-side and redact them from logs, analytics, errors
and delivery records. Treat endpoints as capabilities; null browser expiry is
not proof of permanence. Use existing authenticated ownership and same-origin
controls for subscribe/replace/delete, never caller-supplied owner IDs. Validate
key lengths/formats and bound request bodies. Before enabling outbound requests,
review an allowlist of actual browser push-service hosts, HTTPS-only URLs,
redirect prohibition, private/local address rejection, DNS rebinding, timeouts
and response-size limits. An arbitrary supplied endpoint must not become SSRF.
VAPID credentials require protected server configuration and a reviewed signing
library; neither keys nor a dependency are introduced here.

Purge due subscriptions/statuses on the existing administrative or publication
invocation and show the last cleanup result. Since no invocation is guaranteed
after the tournament, schedule an owner-run cleanup at the seven/30-day review
and verify it, rather than promise automatic timely deletion without a runner.
Consent is disabled at basho end even if physical deletion awaits that check.
Do not launch until the owner accepts this manual retention operation or
separately approves a reliable cleanup mechanism. Account deletion and explicit
opt-out remove capability data immediately. Retained aggregate counters must not
allow a roster change or early deletion to reset the attempt budget.

## Costs and alternatives

In-app status needs no notification provider but cannot reach an absent player.
Web Push is the recommended bounded experiment. Email remains deferred: it adds
sender/domain setup, reminder consent, unsubscribe and bounce handling; existing
Neon Auth messages do not provide a game-reminder service. Recheck email pricing
and message classification only if choosing that alternative later.

The $0 incremental Web Push target is a proposed budget, not a measured cost
guarantee. Reuse current hosting/database allowances and record function time,
database/egress usage and provider outcomes. Do not upgrade a plan or provision
anything to stay running. Vercel cron invokes billed Functions; Hobby cron has
hour-level precision, and failures are not automatically retried. These limits
reinforce publication-driven best-effort delivery. Confirm the project's actual
plan/remaining allowance before activation, using the current
[cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[cron operation](https://vercel.com/docs/cron-jobs/manage-cron-jobs) and
[Function pricing](https://vercel.com/docs/functions/usage-and-pricing).
Primary browser/hosting sources were rechecked 1 November 2026.

## Offline rehearsal and launch evidence

Run `make push-pilot-rehearsal`. It uses synthetic identities, an injected clock,
in-memory consent/decision records and fixed acknowledgement outcomes. It has
no endpoints, credentials, network transport, subscriptions or app integration.
`make check` runs it too. It demonstrates caps, overlapping calls in one process,
deduplication, skip persistence, ownership/device replacement, opt-out, strict
cutoff/TTL, timezone boundaries, expiry and unknown outcomes. It does not prove
database races, cryptography, real delivery, service-worker behavior or retention.
It is deliberately not a production sender or a substitute for those tests.

Before a controlled launch, require:

1. Owner approval of this scope, quiet hours, retention operation and budget;
   name the basho, roster, operator and stop contact.
2. Real implementation with ownership/CSRF/SSRF/security review, actual
   SQLite/Postgres concurrent claims, consent-revision races, durable caps,
   cleanup and kill switch. Keep existing scoring/auth authorization intact.
3. Stub browser E2E for opt-in/out, account switching, denied/unsupported
   permission, duplicate/admin/scheduled/day-one publication, missing/late cards,
   exhausted allowance, selection, cutoff, quiet hours and unknown outcomes.
4. Owner approval of the concrete migration-containing merge/release range;
   deploy only through the existing migration-gated workflows.
5. Explicit consent from a small first group for one iPhone Home Screen and
   desktop/Android device check, then expand within the fixed 20-person roster.
   Check app-closed delivery, Focus, permission withdrawal and offline/late TTL.
6. Review at basho end: attempts by coarse outcome, skipped reasons, actual cost,
   opt-outs and tester feedback about usefulness. Do not infer delivery/read from
   service acceptance or silently add retries/devices/email. Verify seven-day
   capability deletion and 30-day status cleanup, then decide whether to repeat.
