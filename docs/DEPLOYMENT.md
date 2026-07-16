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

Use managed Postgres for production persistence. Supabase Postgres is the default recommendation for this hobby-scale deployment unless Neon has a stronger operational reason at setup time.

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

The root `vercel.json` configures the two daily production cron invocations
allowed by the Vercel Hobby plan:

```json
[
  {
    "path": "/api/cron/lock-picks",
    "schedule": "0 15 * * *"
  },
  {
    "path": "/api/cron/import-results",
    "schedule": "0 11 * * *"
  }
]
```

Vercel cron schedules use UTC. Japan does not observe daylight saving time, so
the pick-lock schedule runs once between **15:00-15:59 UTC / 00:00-00:59 JST**
on the following calendar day. The results schedule runs once between
**11:00-11:59 UTC / 20:00-20:59 JST**. These are hourly windows because Hobby
cron invocation precision is hourly. The results window leaves at least two
hours after the expected 18:00 JST end of the top-division bouts. Vercel does
not retry failed cron invocations.

Set `CRON_SECRET` on the production deployment. Vercel sends it to the cron
routes as `Authorization: Bearer <CRON_SECRET>`. Both routes are disabled when
the secret is missing and reject requests with a missing or incorrect bearer
token. Cron jobs run on production deployments, not previews.

### Day-before pick lock

On each authenticated `GET /api/cron/lock-picks` invocation, the route:

1. calculates the current date in `Asia/Tokyo`;
2. finds the single non-demo `upcoming` basho whose lock date has arrived;
3. atomically changes that basho to `locked` and stamps `lockedAt` on its
   existing fantasy teams;
4. skips cleanly when no basho is due and fails without mutation when more than
   one basho is eligible.

The lock date is the calendar day before `basho.startDate`. The route remains
eligible through the basho window so a missed run can catch up, and rerunning
after a successful lock is a safe no-op. Independently, team creation compares
the current Japan date with the same deadline and returns `409 picks-locked`
even if the stored basho status is stale. This prevents a missed cron from
allowing late picks. The known deterministic demo basho is excluded from both
calendar enforcement and the production lifecycle cron; its protected demo
controls remain the source of progression.

Banzuke reimports preserve the most advanced stored basho lifecycle state, so
running a refresh after this job cannot regress `locked` back to `upcoming`.

For a controlled manual lock or recovery check:

```bash
curl "https://<deployment>/api/cron/lock-picks" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Daily results import

On each authenticated invocation, the route:

1. finds schedulable bashos whose stored lifecycle status is `upcoming`,
   `locked`, or `active`;
2. excludes the deterministic demo basho;
3. allows an `upcoming` or `locked` basho to become the day-one target, and
   otherwise targets the single date-eligible `active` basho;
4. refuses to import if more than one live basho is eligible;
5. calculates the expected basho day from the current date in `Asia/Tokyo` and
   the stored basho start date;
6. skips without contacting the source when no live basho is eligible or the
   date is outside the active basho's stored date window;
7. runs the existing Sumo API adapter and transactional daily result import,
   moving `upcoming` or `locked` to `active` on day 1 and `active` to
   `complete` on day 15.

Re-running the route on the same Japan calendar day targets the same basho/day.
The importer replaces only that day's stable result IDs, so retries correct or
skip existing rows without duplicating scores, teams, or picks. The response
and Vercel function logs include the status, basho ID, day, Japan date, and skip
reason when applicable. Source, validation, or ambiguous-live-basho errors
are logged and return a non-2xx response so Vercel does not record silent
success.

For a controlled manual check, call the deployed route with the same bearer
header Vercel uses:

```bash
curl "https://<deployment>/api/cron/import-results" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## First deployment checklist

1. Create a managed Postgres database, preferably Supabase Postgres.
2. Add the Vercel project from the GitHub repo root.
3. Configure the environment variables above for preview and production.
4. Run migrations against the managed database with the production `DATABASE_URL`.
5. Seed or import the initial basho and banzuke data.
6. Smoke-test health, current basho, team creation, import dry-runs, result imports, and leaderboard updates.
7. Document the database backup and restore process from the chosen provider.
