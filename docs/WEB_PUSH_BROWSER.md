# Disabled browser reminder preparation

Issue #124 builds on backend PR #123. The owner authorized the browser source
code on 3 November 2026. This is manual implementation work; it does not renew
the expired delivery pilot or authorize a schedule, merge, release or activation.

## Player flow

My Stable includes **Pick Window reminders**. The existing authenticated
preferences response controls availability. Production still supplies no
`pushRuntime`, returns unavailable, and rejects enrollment. This change adds no
runtime activation flag, server credentials, provider, dependency or migration.
Rendering the UI or signing in never requests notification permission, registers
a worker or subscribes a device.

When separately activated in a later approved release, **Enable on this device**
requests permission directly from the click. Secure context, Notification,
PushManager, service workers, CacheStorage and Web Locks are required. iPhone/iPad
also requires Home Screen installation. A minimal linked web manifest supplies stable
app identity, scope and standalone display for that installation; it adds no
install prompt or offline caching. The OS can supply its fallback monogram icon.
See [WebKit's Home Screen requirements](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
Unsupported or denied permission keeps
the game usable without reminders. Existing reminders show their saved IANA
timezone, including after travel. New enrollment uses the browser's current zone;
turn off and re-enable to change the selected device's zone. Quiet hours are shown;
quiet openings are skipped rather than deferred. Enabling replaces the account's
previous selected device. **Turn off on this device** and **Disable reminders
everywhere** are explicit controls; the latter works without native Push APIs.

The client refreshes authenticated availability and checks the expected owner
before enrollment. It persists a muted recovery identity before writing, stores
the returned revocation-only proof, then confirms the server's device and
revision before enabling local display. Unknown enrollment stays muted and
disconnects its native endpoint; explicit retry/opt-out can recover it. There
is no automatic subscription refresh or background re-enrollment.

## Consent and account changes

`push-browser.ts` and the standalone `/push-worker.js` share one origin-scoped
Web Lock and one CacheStorage entry. Stored metadata is device/owner identity,
revision, revocation-only proof, named basho/end, timezone, local enabled state
and a 15-bit displayed-day mask. No endpoint, push encryption key, password or
auth bearer token is copied there. Native subscription data remains browser
managed and is sent only to the existing authenticated same-origin API.

Device opt-out first mutes local display and closes existing notifications, then
revokes the server binding and unsubscribes the native endpoint. Account-wide
server deletion precedes all optional storage/browser work, so storage failure
cannot prevent it. Sign-in/out and reset cleanup hold the shared lock through the
awaited auth mutation, preventing another tab from enrolling during a delayed
sign-out. The same lock covers enrollment before it creates local metadata.
Active/unknown consent cleanup failures preserve credentials and recovery proof.
Ordinary game startup isolates optional storage errors and attempts native
disconnection; it never enrolls or renews. Server opt-out remains accessible when
local storage is unavailable, while device enrollment is disabled.

Restoring an anonymous session silences/disconnects locally and retains the proof
for the next authenticated cleanup. A changed signed-in account can use that
proof only to revoke the old binding; it cannot read or create the old account's
consent. An uncertain write without a received proof can be deleted only by its
original authenticated owner, using a matching expected-owner guard. Account-wide
deletion has the same guard so a stale tab cannot disable a newly signed-in
account accidentally. Existing authentication/authorization policy is unchanged.

## Worker behavior

The worker has no fetch handler, offline page cache, auth token or subscription
renewal handler. A push is shown only when persistent local consent is enabled,
the subscription revision matches, the named basho matches, day is 1–15, the
deadline and basho end are still in the future, and local time is outside quiet
hours. Malformed payloads/storage failures are suppressed without logging data.
The worker reserves a displayed-day bit before showing, so duplicate or uncertain
display is not retried. Shared locking serializes display with mute/close.

Payloads now carry an opaque subscription revision in addition to the existing
generic reminder. No player or stable identity enters them. Content and click
navigation are fixed by the worker: Fantasy Sumo, the generic Pick Window text,
and same-origin `/stable`. Payload-controlled links are ignored. Clicks recheck
consent/expiry before focusing/navigating the app, whose API remains authoritative
about current eligibility. Notifications never change a pick or deadline.

An already handed-off push and OS presentation cannot be recalled or guaranteed.
Physical-device behavior, permission withdrawal, Focus, app-closed/offline/late
delivery, browser-managed subscription expiry, and account deletion remain
explicit launch validation. The server's seven/30-day verified manual retention
operation and live pre-bout attestation prerequisite in `WEB_PUSH_PILOT.md` remain
unchanged. Client metadata is removed on successful opt-out; browser storage
clearing also removes it and fails closed. No real pilot has been activated.

## Verification boundary

Connector tests replace Notification, service-worker registration, PushManager,
storage, locks and HTTP with synthetic doubles. Worker tests run the standalone
script in a VM with fake events, storage and display/navigation, covering quiet
hours, exact expiry, stale revisions, malformed payloads and duplicates.
Playwright's `push-browser.spec.ts` replaces every permission/registration/
subscription call before the app loads and stubs configured notification HTTP.
Its default-backend case proves zero permission/registration calls. Existing
game-loop tests still use the real local API and isolated SQLite fixture.

No test requests real permission, registers a real worker, collects a real push
subscription, sends a notification or provisions credentials. Before launch,
require the remaining policy/security/source/retention gates and separate
approval for real consenting-device tests and production activation.

Primary references: [gesture-based subscription](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe),
[worker notifications](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification),
and [notification click handling](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/notificationclick_event).
