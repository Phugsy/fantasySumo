# Deployment

## Vercel target

Fantasy Sumo is prepared for a Vercel deployment with:

- the Vite web app built from `apps/web` and served from `apps/web/dist`;
- a Node serverless function at `api/index.ts` that mounts the existing Fastify app;
- relative browser calls to `/api/...`, with `vercel.json` rewriting those calls to the serverless function;
- the existing pnpm workspace boundaries retained.

The root `vercel.json` is the deployment contract:

```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "outputDirectory": "apps/web/dist",
  "git": {
    "deploymentEnabled": false
  }
}
```

Create or reconfigure the Vercel project with the repository root as its root directory. A project rooted at `apps/web` will ignore the root `vercel.json` and deploy only the Vite app, not the `/api` serverless function.

## Automated release path

Hosted deployments are owned by GitHub Actions:

- `.github/workflows/deploy-preview.yml` runs for same-repository pull request
  commits and can also be dispatched for a specific ref. It resolves the ref to
  an immutable SHA, runs `make check` and `make e2e`, enters the `preview`
  environment, builds with Vercel CLI, migrates the preview database, deploys
  that same build, and smoke-tests `/`, `/api/health`, and the database-backed
  `/api/basho/current` route.
- `.github/workflows/deploy-production.yml` runs for a published, non-prerelease
  GitHub Release or a manual dispatch with an exact SHA. It rejects commits
  outside `master`, validates the resolved SHA, waits at the protected
  `production` environment, prepares the production build, migrates, deploys
  that same SHA, and runs the same smoke tests.

The workflows remain separate because their trust boundaries and release
inputs differ: preview accepts same-repository PR heads and manual refs, while
production accepts only exact `master` ancestors behind the protected
`Production` environment. Keeping those policies explicit is more valuable
than sharing the comparatively small setup/deploy sequence.

The deploy jobs use constant, environment-specific concurrency groups. Only one
preview migration/deployment and one production migration/deployment can run at
a time. Validation jobs may overlap because they do not touch a shared hosted
database. `cancel-in-progress` is disabled so an in-flight migration or release
is never interrupted by a newer run.

Immediately before an automatic release can migrate production, the deploy job
also verifies that its GitHub Release is still the latest published full
release. This prevents an older validation run from replacing a newer release.
Explicit manual dispatches remain exempt so an operator can intentionally
deploy an older compatible `master` SHA for recovery.

After preview validation and build preparation, the deploy job checks that a
pull-request run still targets the current PR head before touching the shared
database. This rejects an older run from the same PR without constraining the
order in which different PRs are reviewed or merged. Manual preview dispatches
remain explicit operator actions and are not subject to the PR-head check.

Migration is a normal failing workflow step before `vercel deploy --prebuilt`.
GitHub will therefore skip deployment when `pnpm db:migrate` fails. Each run's
summary records the environment, immutable commit SHA, migration result,
deployment URL, smoke-test result, and the recovery warning when the database
may have advanced before a later failure.

Both deployment workflows load the smoke-test script from the workflow
revision rather than the selected application SHA. This keeps post-deployment
verification available when an operator intentionally selects an older preview
or production commit that predates the smoke tooling.

### One-time GitHub and Vercel setup

Use the existing GitHub environments named exactly `Preview` and `Production`.
Configure each environment independently with:

| Name                              | Kind                 | Requirement                                               |
| --------------------------------- | -------------------- | --------------------------------------------------------- |
| `DATABASE_URL`                    | Environment secret   | The Neon URL for only that environment                    |
| `VERCEL_TOKEN`                    | Environment secret   | A least-privilege token allowed to deploy the project     |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Environment secret   | The Vercel Deployment Protection automation bypass secret |
| `VERCEL_ORG_ID`                   | Environment variable | The Vercel owner/team ID                                  |
| `VERCEL_PROJECT_ID`               | Environment variable | The Vercel project ID                                     |

`VERCEL_TOKEN` is a Vercel API token used only by the Vercel CLI running in
GitHub Actions. Create a least-privilege token for the owning Vercel account or
team, then store its value as an Actions environment secret named
`VERCEL_TOKEN` in both `Preview` and `Production`. It is not a Vercel runtime
environment variable and it is not the short-lived `VERCEL_OIDC_TOKEN` exposed
to deployed functions. `DATABASE_URL` is also an Actions environment secret;
the matching URL must separately exist in the corresponding Vercel runtime
environment.

`VERCEL_AUTOMATION_BYPASS_SECRET` is generated in the Vercel project's
Deployment Protection settings, but its value belongs in the matching GitHub
Actions environments. The workflow exposes it only to the smoke-test step,
which sends it in the `x-vercel-protection-bypass` request header. This lets CI
verify the protected deployment without disabling Deployment Protection or
adding the secret to the deployed application's runtime environment.

The preview and production `DATABASE_URL` values must be different and must
match the database used by the corresponding Vercel runtime environment. Do not
put either URL in repository-level variables, workflow YAML, or PR comments.
Restrict the `production` environment to `master` and release tags, add a
required reviewer, and prevent self-review when another maintainer is
available. The workflow's environment reference is the approval gate; its
secrets are unavailable until GitHub grants that approval.

The committed `git.deploymentEnabled: false` setting disables Vercel's automatic
Git deployments while retaining the connected project for CLI deployments.
Without it, the Vercel Git integration creates a second deployment for every
push and can publish code before GitHub's blocking migration job. Keep the
Vercel project itself and its separate preview/production runtime variables;
only Actions should initiate releases.

Before enabling pull-request deployment, run the preview workflow manually for
a known commit and confirm the workflow summary points at the preview Neon
database and a Vercel preview URL. Then publish a release or manually dispatch
the production workflow with the full SHA that passed review. Never type a
branch name into the production SHA input.

## Required Vercel environment variables

Set these in Vercel before exposing the app:

```text
DATABASE_URL=<managed Postgres connection string>
TEAM_SIZE=2
AUTH_MODE=neon
NEON_AUTH_JWKS_URL=<Neon Auth JWKS URL>
NEON_AUTH_ISSUER=<optional expected JWT issuer>
NEON_AUTH_AUDIENCE=<optional expected JWT audience>
VITE_NEON_AUTH_URL=<Neon Auth client URL>
ADMIN_IMPORT_TOKEN=<long random token>
CRON_SECRET=<long random token>
DEMO_ADMIN_TOKEN=<long random token, only if demo admin controls are needed>
```

`DATABASE_URL` must not be a `file:` or `:memory:` SQLite URL when `NODE_ENV=production`. SQLite is only supported for local development because serverless function storage is ephemeral and cannot be used as production state.

## Production database and auth direction

Production uses managed Neon Postgres. Keep the generic `DATABASE_URL` and
repository adapter boundary so the application remains portable, while Neon
also supplies the intended production identity provider through Neon Auth.

The database package now treats persistence as an adapter boundary:

- `file:` and `:memory:` `DATABASE_URL` values use the local SQLite Drizzle adapter.
- `postgres:` and `postgresql:` `DATABASE_URL` values use the Postgres Drizzle adapter.
- API code depends on the async `Repositories` contract, not a concrete database driver.

Keep SQLite locally until there is a concrete reason to standardise development on local Postgres. It keeps the demo and contributor setup simple, but it does mean local smoke tests are not a perfect production proof. Any deploy-bound database change should also be validated against a real Neon Postgres database before release.

Authentication is also behind an app boundary:

- Local development and tests use `AUTH_MODE=local`, which provides a small cookie-based development session through `POST /api/session`.
- Production uses `AUTH_MODE=neon`. The React app authenticates with Neon Auth, sends the Neon JWT in `Authorization: Bearer <token>`, and the Fastify API verifies it with `NEON_AUTH_JWKS_URL`.
- The verified JWT `sub` claim is the Neon user id and becomes the stored team `ownerUserId`.

The API rejects `AUTH_MODE=local` when `NODE_ENV=production` so the unsigned
development session cannot be enabled on a production deployment.

Do not set `AUTH_MODE=neon` without `NEON_AUTH_JWKS_URL`; the API will fail closed and treat requests as unauthenticated.

When Neon accepts a login but the app cannot establish its API session, inspect
the production runtime logs for these warning events:

- `event=auth-client-session-failed` with
  `reason=access-token-unavailable` means the browser could not obtain a session
  token, so it sent a safe diagnostic session request without an authorization
  header.
- `event=neon-jwt-verification-failed` with
  `reason=verification-error` includes only the safe JOSE error name and code,
  which distinguishes claim, signature, JWKS, and missing-verifier failures.
- `event=neon-jwt-verification-failed` with `reason=token-rejected` means
  verification returned no authenticated user.

Never add the JWT, its claims, provider error message, or authorization header
to these logs. Provider and JOSE error messages are uncontrolled text that can
contain request-derived values; runtime logs also persist and may later be
forwarded to other systems. The stable error name and code provide the useful
failure classification without that exposure.

Neon Auth also requires each deployed app origin to be added as a trusted domain in Neon Console -> Auth -> Configuration -> Domains. Add the exact production and preview origins with protocol and no trailing slash, for example `https://fantasy-sumo.vercel.app`. Wildcard subdomains are not supported, so each Vercel preview domain that needs auth testing must be added explicitly.

The Postgres migration ledger records each filename and a SHA-256 checksum of
its SQL. Identical reruns are skipped; if two branches reuse a filename for
different SQL, the runner fails before applying that file. Existing
filename-only ledger rows with a missing checksum fail closed because their
historical SQL cannot be inferred from the current checkout. SQL line endings
are normalized before hashing so LF and CRLF checkouts of the same migration
produce the same checksum.

Production applied `0001_team_owner_user.sql` before its auth feature rollout
was paused until after the current tournament. The nullable `owner_user_id`
column and its unique `(basho_id, owner_user_id)` index now back the resumed
authentication feature. That immutable production history remains canonical,
so the demo classification change follows it as `0002_basho_demo_flag.sql`.
That migration tolerates the demo column already existing in an environment
that applied the superseded demo migration identity.
Do not delete the ownership ledger row or reuse its filename for different SQL.

### Legacy checksum investigation

If migration stops because an existing ledger row has no checksum, do not copy
the reported hash into the database immediately. The row proves only that its
filename was previously marked as applied; it does not prove which SQL content
ran.

1. Take or verify a backup of the affected database.
2. Check out the exact trusted application revision and inspect the reported
   migration file.
3. Compare every schema and data effect of that SQL with the database. If the
   result cannot be verified, leave the checksum empty and repair the schema
   with an explicit forward migration or restore a known-good database.
4. Only after verification, record the checksum printed by the migration error
   using the database console:

   ```sql
   UPDATE "__fantasy_sumo_migrations"
   SET "checksum" = '<verified checksum from the migration error>'
   WHERE "id" = '<verified migration filename>'
     AND "checksum" IS NULL;
   ```

5. Confirm exactly one intended row changed, then rerun the same blocked
   workflow SHA.

### Schema compatibility rule

Migrations run while the previous deployment may still be serving traffic.
Every deploy-bound schema change must therefore be compatible with both the old
and new application versions:

1. Expand: add nullable columns, tables, or indexes without removing or changing
   data the current application needs.
2. Adopt: deploy code that writes/reads the expanded schema and backfill data in
   an explicit, observable operation where required.
3. Contract: remove old schema only in a later release after no deployed code or
   recovery target depends on it.

PRs with schema changes must call out this sequence and exercise the migration
against preview Postgres. The workflows never run down migrations.

## Admin endpoints

The demo admin endpoints already require `DEMO_ADMIN_TOKEN` unless explicitly opened in tests.

Demo administration is also protected at the data boundary. The application
supports one fixed deterministic demo basho. Reset and progression require its
known ID and a persisted `isDemo: true` flag; reset fails closed if a live basho
uses that ID. The scoped reset transaction deletes and recreates only the demo
basho and its dependent banzuke, teams, picks, and results. It does not clear
live bashos or overwrite shared rikishi metadata. Scheduled production imports
exclude every basho marked as demo.

The demo-flag migration deliberately classifies every existing basho as live.
It never infers destructive permissions from an ID alone. If an operator has a
verified legacy demo row, they must explicitly mark that row as demo after
backing up the database, or recreate the deterministic demo fixture in a local
database that does not contain an ID collision.

`make demo` sets `VITE_BASHO_MODE=demo`, so the browser explicitly requests the
fixed, flagged demo basho even when the same database also contains live data.
Normal builds omit this flag and `/api/basho/current` continues to prefer live
bashos. The explicit demo query still verifies both the fixed ID and `isDemo`
classification before returning a basho.

The source-backed import endpoints require `ADMIN_IMPORT_TOKEN` by default. They can run without a token only when `NODE_ENV` is `development` or `test`.

```bash
curl -X POST "https://<deployment>/api/admin/import-banzuke?dryRun=true" \
  -H "x-admin-import-token: $ADMIN_IMPORT_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'
```

The same token can also be supplied with `Authorization: Bearer <token>`.

## Scheduled production jobs

The root `vercel.json` configures one daily production cron invocation:

```json
[
  {
    "path": "/api/cron/import-results",
    "schedule": "0 11 * * *"
  }
]
```

Vercel cron schedules use UTC. Japan does not observe daylight saving time, so
the job runs once between **11:00-11:59 UTC / 20:00-20:59 JST**. The window
leaves at least two hours after the expected 18:00 JST end of the top-division
bouts. Hobby cron invocation precision is hourly. Vercel does not retry failed
cron invocations.

Set `CRON_SECRET` on the production deployment. Vercel sends it to the cron
route as `Authorization: Bearer <CRON_SECRET>`. The route is disabled when
the secret is missing and rejects requests with a missing or incorrect bearer
token. Cron jobs run on production deployments, not previews.

### Day-before pick lock and daily results

On each authenticated invocation, the route calculates the current date in
`Asia/Tokyo` and selects at most one non-demo basho:

1. on the evening before day 0, two calendar days before `basho.startDate`, it
   atomically changes the upcoming basho to `locked` and stamps `lockedAt` on
   existing teams;
2. on day 0, it applies that same lock as a catch-up if the earlier invocation
   was missed;
3. on days 1-15, it derives the basho day and sequentially runs the
   source-backed, transactional result import for every day absent from stored
   bout results through the derived day, including a refresh of the current
   day;
4. after the end date, it keeps a locked or active basho eligible for final-day
   recovery until day 15 completes it;
5. it fails without mutation when more than one live basho is eligible.

Rerunning after a successful lock is a safe no-op. Team creation and basho
reads use only the persisted lifecycle status: `upcoming` keeps picks open,
while `locked`, `active`, and `complete` close them. This lets an administrator
lock earlier when needed and keeps the client and API aligned. The final team
status check takes a Postgres row lock in the same transaction as its insert,
so it serializes with the cron's basho update. The deterministic demo basho is
exempt from the production cron; its protected controls remain the source of
progression.

Banzuke reimports preserve the most advanced stored basho lifecycle state
inside the database transaction, so even a concurrent refresh cannot regress
`locked` back to `upcoming`.

Re-running the route on the same Japan calendar day always refreshes that day.
A delayed run backfills every earlier day absent from stored bout results;
`currentDay` remains useful lifecycle/calendar metadata but is not treated as a
results cursor. Each day commits independently, so if a later source request
fails, the next invocation sees the earlier stored days and resumes with the
remaining gaps. The importer replaces only each day's stable result IDs, so
retries correct or skip existing rows without duplicating scores, teams, or
picks. The response and Vercel function logs include the status, basho ID,
derived day, imported days, Japan date, and skip reason when applicable.
Source, validation, or ambiguous-live-basho errors are logged and return a
non-2xx response so Vercel does not record silent success.

This job necessarily reads and sometimes writes the authoritative Neon
database. A Redis cache would add another network dependency without removing
that database wake-up, so it is not used to address cron cold starts. On a
scale-to-zero plan, occasional Neon connection wake-up latency is expected;
keeping this as one daily function invocation avoids a second scheduled cold
start while preserving database correctness.

For a controlled manual check, call the deployed route with the same bearer
header Vercel uses:

```bash
curl "https://<deployment>/api/cron/import-results" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## First deployment checklist

1. Create separate preview and production Neon Postgres databases.
2. Add the Vercel project from the GitHub repo root.
3. Configure the Vercel runtime variables for preview and production, including
   Neon Auth, and add each deployed origin to Neon Auth trusted domains.
4. Configure and protect the matching GitHub environments and secrets described
   above, including a production required reviewer.
5. Manually dispatch a preview deployment and verify its migration, deployment,
   URL, and smoke-test summary.
6. Verify Vercel skips automatic Git deployments because
   `git.deploymentEnabled` is `false`; only the GitHub Actions CLI path should
   create a deployment.
7. Seed or import the initial basho and banzuke data through an explicit operator
   action.
8. Dispatch the production workflow for an exact reviewed `master` SHA and
   approve the environment gate.
9. Smoke-test Neon sign-in/sign-up, current basho, owned team creation and
   retrieval, import dry-runs, result imports, and leaderboard updates beyond
   the automated health check.
10. Document and test the database backup and restore process from Neon.

## Emergency migration and recovery

The automated workflows are the normal release path. Use a manual migration
only to recover a blocked workflow or repair an environment under explicit
operator control:

1. Confirm the intended environment and exact application SHA in the failed
   workflow. Take or verify a recent database backup before any high-risk fix.
2. Export only that environment's Neon URL in a clean shell. Do not paste it into
   an issue, PR, command transcript, or committed file.
3. Check out the exact release SHA and install with
   `pnpm install --frozen-lockfile`.
4. Run `DATABASE_URL="<environment Neon URL>" pnpm db:migrate` once. The existing
   ledger and transactional Postgres runner make a successful retry idempotent.
5. Re-run the failed GitHub workflow for the same SHA. Do not deploy another SHA
   merely to get past the gate.

If migration fails, stop: production deployment has not occurred. Inspect the
transaction error, correct the migration with a forward-compatible migration,
and rerun. Never automatically apply a down migration.

If deployment or smoke testing fails after migration succeeds, assume the
database may already be advanced. Prefer a forward fix. If service must be
restored immediately, redeploy a previous application SHA only after confirming
that it is compatible with the advanced schema. Record the migration result,
deployed SHA, failed URL/check, and operator action in the release or incident
notes.
