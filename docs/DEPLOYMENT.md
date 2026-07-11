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
AUTH_MODE=neon
NEON_AUTH_JWKS_URL=<Neon Auth JWKS URL>
NEON_AUTH_ISSUER=<optional expected JWT issuer>
NEON_AUTH_AUDIENCE=<optional expected JWT audience>
VITE_NEON_AUTH_URL=<Neon Auth client URL>
ADMIN_IMPORT_TOKEN=<long random token>
DEMO_ADMIN_TOKEN=<long random token, only if demo admin controls are needed>
```

`DATABASE_URL` must not be a `file:` or `:memory:` SQLite URL when `NODE_ENV=production`. SQLite is only supported for local development because serverless function storage is ephemeral and cannot be used as production state.

## Production database and auth direction

Use Neon Postgres for production persistence. The app still treats Postgres as a `DATABASE_URL`-selected adapter, but Neon is the intended production provider because it can host the production database and pair naturally with Neon Auth.

The database package now treats persistence as an adapter boundary:

- `file:` and `:memory:` `DATABASE_URL` values use the local SQLite Drizzle adapter.
- `postgres:` and `postgresql:` `DATABASE_URL` values use the Postgres Drizzle adapter.
- API code depends on the async `Repositories` contract, not a concrete database driver.

Keep SQLite locally until there is a concrete reason to standardise development on local Postgres. It keeps the demo and contributor setup simple, but it does mean local smoke tests are not a perfect production proof. Any deploy-bound database change should also be validated against a real Neon Postgres database before release.

Authentication is also behind an app boundary:

- Local development and tests use `AUTH_MODE=local`, which provides a small cookie-based development session through `POST /api/session`.
- Production uses `AUTH_MODE=neon`. The React app authenticates with Neon Auth, sends the Neon JWT in `Authorization: Bearer <token>`, and the Fastify API verifies it with `NEON_AUTH_JWKS_URL`.
- The verified JWT `sub` claim is the Neon user id and becomes the stored team `ownerUserId`.

Do not set `AUTH_MODE=neon` without `NEON_AUTH_JWKS_URL`; the API will fail closed and treat requests as unauthenticated.

Neon Auth also requires each deployed app origin to be added as a trusted domain in Neon Console -> Auth -> Configuration -> Domains. Add the exact production and preview origins with protocol and no trailing slash, for example `https://fantasy-sumo.vercel.app`. Wildcard subdomains are not supported, so each Vercel preview domain that needs auth testing must be added explicitly.

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

## First deployment checklist

1. Create a Neon project with a Postgres database.
2. Add the Vercel project from the GitHub repo root.
3. Configure the environment variables above for preview and production.
4. Add the deployed Vercel app origin to Neon Auth trusted domains.
5. Run migrations against the managed database with the production `DATABASE_URL`.
6. Seed or import the initial basho and banzuke data.
7. Smoke-test health, Neon sign-in/sign-up, current basho, owned team creation, import dry-runs, result imports, and leaderboard updates.
8. Document the database backup and restore process from the chosen provider.
