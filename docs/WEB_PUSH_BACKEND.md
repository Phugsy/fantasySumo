# Disabled Web Push backend preparation

The owner approved code preparation under `WEB_PUSH_PILOT.md` on 1 November 2026.
This is the backend slice in #122, dependent on the reviewed joker branch in
PR #120. PR #120 remains open for human review and its remote branch is unchanged;
PR #121 remains the independently reviewed proposal.

## What is implemented

Three additive tables hold the fixed pilot roster/counters, one owned device
subscription and per-player/day opening decisions. The roster is immutable and
limited to 20. A single push transaction lock followed by the basho row lock
serializes Postgres ownership, replacement, claims and cleanup, including across
different pilots. SQLite uses an immediate transaction. The joker repository's
existing statement generators are reused inside the claim transaction, so both
paths use identical reconciliation, deadline, stable-target and allowance rules.
No duplicate scoring or eligibility implementation is introduced.

Claims reserve the day's unique decision and increment the 20/day and 300/basho
counters before any handoff. Quiet-hour and ineligible skips persist. A reserved
claim can transition to handoff only once; uncertain outcomes are not replayed.
Recheck consent revision, current eligibility and cutoff before handoff. Failure
after reservation still consumes the attempt allowance conservatively. Status
retention cannot reset aggregate counters or allow a roster rotation. Minimal
per-roster-member/day quota bits persist with the fixed pilot counters, so
deleting 30-day delivery statuses cannot create another opening opportunity.
Those bits contain no delivery outcome, timestamp, endpoint or encryption key.

The authenticated API supports private preferences, same-origin owned subscription
writes, device-specific or account-wide opt-out, and device revocation. Responses
never return endpoints, encryption keys or revocation proofs after enrollment.
The enrollment response returns a fresh 256-bit revocation-only proof once. A
signed-in device holding that proof can revoke its previous account binding
without reading or creating that account's consent. The server stores only its
hash, and device/revision guards prevent an old proof or expiry acknowledgement
from deleting a replacement. A future browser connector must persist that proof,
silence display and complete revocation before sign-out/account switching.

The bounded transport uses `web-push` 3.6.7 for standard payload encryption and
VAPID request construction, with its type package as a development dependency.
This avoids custom cryptography. The dependency is open source and introduces no
hosted provider or billing. Its [maintained interface](https://github.com/web-push-libs/web-push)
is the primary reference. Browser/service-worker behavior remains governed by
[the standards API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).

Only explicitly configured hosts from the supported Apple, Google and Mozilla
push-service families are accepted. Validate HTTPS, credentials/port/fragment,
curve points and key lengths. Resolve only IPv4, reject mixed/private/local/
link-local answers, then pin the chosen address into a certificate-verified TLS
request. DNS preparation completes before the final serialized consent/eligibility
handoff check. IPv6-only destinations are deliberately unsupported in this bounded
pilot. No redirects or retries. DNS and request wall time are bounded; recompute
TTL after DNS so it cannot extend past cutoff. No raw endpoint, key, payload,
authorization header or vendor error body enters logs or delivery records.

A post-commit repository observer covers complete schedule and combined-result
imports through admin and existing scheduled paths. It ignores incomplete and
dry-run cards. Reminder failure cannot undo the committed import. Work is awaited
in bounded batches of four; no fire-and-forget invocation, cron or queue is added.
Actual hosting headroom and real-device interoperability still require launch
measurement, rather than assuming this bound guarantees resource availability.

Cleanup disables the pilot at completion/end, removes expired capabilities and
seven-day post-basho subscriptions, and removes 30-day opening statuses while
preserving aggregate caps. Explicit opt-out removes capabilities immediately.
`cleanPushRetention` is called on configured preference reads/publications and is
also available for the owner-run cleanup specified in the approved policy. No
new scheduler is introduced. The future account-deletion integration must invoke
the same owner-wide deletion before launch; no account-deletion API exists here.

## Disabled boundary and remaining approvals

Production entrypoints pass no `pushRuntime` to `buildApp`. There is no environment
activation switch or public activation/configuration API. Without that explicit
runtime, preferences report unavailable and collection endpoints reject writes.
All persisted pilots start disabled. Operator repository methods are exercised
only with synthetic local fixtures in this preparation.

The current eligibility path additionally permits only flagged demo bashos. Live
collection/delivery remains closed until a trustworthy pre-bout publication
contract and live joker opt-in are separately reviewed. The existing adapter's
resolved-winner attestation must not be weakened to make this work. That source
dependency is described in `WEB_PUSH_PILOT.md`; this backend does not solve it.

Automatic approval review rejected authoring the browser connector because the
patch would add real permission requests, service-worker registration and
PushManager subscription calls before separately approved activation/collection.
That patch was not applied. No browser connector, permission prompt, service
worker, browser subscription storage or client collection call is included here.
Ask the owner explicitly before authoring that follow-up; do not bypass the
rejection through another tool or indirect implementation.

Before any real pilot, the remaining gates are browser-code authorization and
implementation (including account switching and staleness), trustworthy live
card attestation, account-deletion cleanup, named roster/basho/operator selection,
secret configuration, ownership/CSRF/SSRF/security review, actual deployment-SHA
approval, activation and explicit consenting-device delivery tests. No real
subscription, message, provider credential, spend or Production action is
authorized by this preparation.

## Local verification

`make check` includes the existing offline rehearsal and new backend tests. All
transport tests stub DNS and HTTP; API/database tests use synthetic endpoints and
locally generated ephemeral test keys, never a real subscription or provider.

Run actual parity against a disposable local Postgres database named `push_test`
on port 55434 via `PUSH_TEST_POSTGRES_URL`. The suite rejects non-local hosts,
other ports and other database names, and resets only that dedicated fixture.
Use two independent clients to validate races. Run the existing joker parity
suite sequentially to verify the shared executor refactor, never concurrently
against the same fixture database. Run `make check` and the full browser E2E
suite sequentially because the dev API watches shared build outputs.

SQLite migration `0010_push_pilot.sql` and Postgres migration
`0009_push_pilot.sql` retain existing tables/data. An older application can keep
running with these additive tables. No down migration, external provisioning or
production migration has been run.
