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
  "outputDirectory": "apps/web/dist"
}
```

Create or reconfigure the Vercel project with the repository root as its root directory. A project rooted at `apps/web` will ignore the root `vercel.json` and deploy only the Vite app, not the `/api` serverless function.

## Required Vercel environment variables

Set these in Vercel before exposing the app:

```text
DATABASE_URL=<managed Postgres connection string>
TEAM_SIZE=2
ADMIN_IMPORT_TOKEN=<long random token>
CRON_SECRET=<long random token>
DEMO_ADMIN_TOKEN=<long random token, only if demo admin controls are needed>
```

`DATABASE_URL` must not be a `file:` or `:memory:` SQLite URL when `NODE_ENV=production`. SQLite is only supported for local development because serverless function storage is ephemeral and cannot be used as production state.

## Production database direction

Production uses managed Neon Postgres. Keep the generic `DATABASE_URL` and
repository adapter boundary so the application remains portable.

The database package now treats persistence as an adapter boundary:

- `file:` and `:memory:` `DATABASE_URL` values use the local SQLite Drizzle adapter.
- `postgres:` and `postgresql:` `DATABASE_URL` values use the Postgres Drizzle adapter.
- API code depends on the async `Repositories` contract, not a concrete database driver.

Keep SQLite locally until there is a concrete reason to standardise development on local Postgres. It keeps the demo and contributor setup simple, but it does mean local smoke tests are not a perfect production proof. Any deploy-bound database change should also be validated against a real Postgres database before release.

## Admin endpoints

The demo admin endpoints already require `DEMO_ADMIN_TOKEN` unless explicitly opened in tests.

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
   source-backed, transactional result import for every day after stored
   `currentDay` through the derived day;
4. it skips without contacting the results source outside that window;
5. it fails without mutation when more than one basho is eligible.

Rerunning after a successful lock is a safe no-op. Team creation and basho
reads use only the persisted lifecycle status: `upcoming` keeps picks open,
while `locked`, `active`, and `complete` close them. This lets an administrator
lock earlier when needed and keeps the client and API aligned. The final team
status check takes a Postgres row lock in the same transaction as its insert,
so it serializes with the cron's basho update. The deterministic demo basho is
exempt from the production cron; its protected controls remain the source of
progression.

Banzuke reimports preserve the most advanced stored basho lifecycle state, so
running a refresh after this job cannot regress `locked` back to `upcoming`.

Re-running the route on the same Japan calendar day reimports that day when no
days are missing. A delayed run backfills from the day after stored
`currentDay`; a locked basho therefore recovers from day 1, while an active
basho resumes from its last successful day. Each day commits independently, so
if a later source request fails, the next invocation resumes after the earlier
successful days. The importer replaces only each day's stable result IDs, so
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

1. Create the managed Neon Postgres database.
2. Add the Vercel project from the GitHub repo root.
3. Configure the environment variables above for preview and production.
4. Run migrations against the managed database with the production `DATABASE_URL`.
5. Seed or import the initial basho and banzuke data.
6. Smoke-test health, current basho, team creation, import dry-runs, result imports, and leaderboard updates.
7. Document the database backup and restore process from the chosen provider.
