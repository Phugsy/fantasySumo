# Shared Demo Playtests

## Purpose and status

The shared playtest is an invite-only Vercel preview deployment of the
deterministic demo. It uses a dedicated Neon project for both Postgres and Neon
Auth. It must never share the production or general preview database, auth
tenant, Vercel project, or administrator credentials.

The repository provides the deployment workflow and operating procedure. The
external environment setup and first multi-user round are deliberate operator
steps. Keep GitHub issue #91 open until a round with at least two player
accounts has completed and its evidence is recorded.

## Playtest decisions

- **Access:** enable Vercel Authentication with Standard Protection on the
  dedicated project, then send revocable Shareable Links only to invited
  testers. Do not deploy the playtest with `--prod`, because a production
  domain is not protected by Standard Protection.
- **Player identity:** testers create normal email/password accounts in the
  playtest project's Neon Auth tenant. Production accounts do not carry over.
- **Fixture reset:** reset manually between named rounds, never on a timer or
  ordinary redeploy. A reset deletes all tester stables and progression in the
  flagged demo, so capture feedback first.
- **Data visibility:** the workflow builds with `VITE_BASHO_MODE=demo`. Players
  see only the fixed flagged demo through the normal game UI.
- **Round tracking:** every workflow run requires a short `round_id`, such as
  `2026-08-a`. Use `[playtest:<round_id>]` in feedback issue titles and include
  the same ID in notes, screenshots, and the closing evidence for #91.

Shareable Links grant possession-based access to the protected deployment.
Treat them as invitations: send them privately, do not paste them into public
issues or PRs, and revoke them after the round.

## One-time environment setup

### 1. Create the isolated Neon project

Create a new Neon project specifically for Fantasy Sumo playtests. Do not use a
branch or database from the production Neon project. Enable Neon Auth
email/password sign-up and email delivery for this project.

Record the playtest-only values for:

- the Postgres connection string;
- the Auth client URL;
- the JWKS URL;
- the optional JWT issuer and audience, if configured.

No production user, team, or basho data should be copied into this project.

### 2. Create the isolated Vercel project

Create a second Vercel project rooted at the repository root, not `apps/web`.
Keep the committed `vercel.json`, including `git.deploymentEnabled: false`, so
only the migration-gated GitHub workflow can deploy it.

Configure these values for the Vercel **Preview** environment:

```text
DATABASE_URL=<playtest Neon Postgres URL>
TEAM_SIZE=2
AUTH_MODE=neon
ADMIN_USER_IDS=<empty until the administrator signs up>
NEON_AUTH_JWKS_URL=<playtest Neon Auth JWKS URL>
NEON_AUTH_ISSUER=<playtest issuer, if used>
NEON_AUTH_AUDIENCE=<playtest audience, if used>
VITE_NEON_AUTH_URL=<playtest Neon Auth client URL>
VITE_BASHO_MODE=demo
CRON_SECRET=<playtest-only random value>
```

Do not configure `ADMIN_IMPORT_TOKEN`; live imports are outside the playtest
scope. `DEMO_ADMIN_TOKEN` is also unnecessary when the administrator uses the
role-gated browser controls.

Add each deployment origin used for a round to the playtest Neon Auth trusted
domains. Keep Vercel Authentication at Standard Protection and enable a
Protection Bypass for Automation for the workflow smoke test.

### 3. Create the GitHub Playtest environment

Create a GitHub Actions environment named exactly `Playtest`. Add a required
reviewer when another maintainer is available. Configure:

| Name                              | Kind                 | Value                                                 |
| --------------------------------- | -------------------- | ----------------------------------------------------- |
| `DATABASE_URL`                    | Environment secret   | The playtest Neon URL; never preview or production    |
| `VERCEL_TOKEN`                    | Environment secret   | Least-privilege access to the playtest Vercel project |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Environment secret   | The playtest project's automation bypass secret       |
| `VERCEL_ORG_ID`                   | Environment variable | The playtest Vercel owner/team ID                     |
| `VERCEL_PROJECT_ID`               | Environment variable | The dedicated playtest project ID                     |

Before the first run, independently compare the GitHub `DATABASE_URL` target
with the Vercel Preview `DATABASE_URL`, then confirm neither matches Preview or
Production. Also confirm `VERCEL_PROJECT_ID` is not either existing deployment
project. The workflow cannot infer whether an operator pasted the wrong secret.

## Deploying a round

Run **Deploy Playtest** from GitHub Actions with:

- `sha`: a full 40-character commit SHA already on `master`;
- `round_id`: the identifier used for all feedback from this round;
- `reset_demo`: `true` for the first deployment or a deliberate new round,
  otherwise `false` so an ordinary redeploy preserves tester progress.

The workflow validates and runs browser E2E against the immutable SHA, builds
the client in demo mode, migrates the playtest database, optionally resets only
the flagged demo, deploys the prepared preview artifact, and verifies that the
hosted API returns `isDemo: true`. Migration, reset, deployment, and smoke-test
results appear in the workflow summary. It rejects a run that became stale
behind a newer playtest dispatch before touching the database and checks again
before deployment; dispatch rounds one at a time rather than relying on those
guards as an operating queue.

For the first deployment, select `reset_demo: true`. If the database is empty
and reset is false, the demo smoke test fails instead of publishing an
apparently healthy environment with no playable fixture.

After the administrator creates a playtest Neon account:

1. Read that account's verified `user.id` from `GET /api/session`.
2. Set the exact ID in the Vercel Preview `ADMIN_USER_IDS` value.
3. Redeploy the same SHA and round with `reset_demo: false`.
4. Confirm `/admin` is visible only to the administrator.

Generate a Shareable Link for the successful protected deployment and send it
privately to the invited testers. Never send the automation bypass secret,
database URL, admin ID list, or machine credentials to testers.

## Running and validating a round

Before opening picks, record the round ID, commit SHA, deployment URL (without
its Shareable Link token), reset result, and invited tester list privately.

Validate the complete shared flow with at least two distinct non-admin Neon
accounts and one administrator:

1. Each player follows the invitation, signs up, creates a stable, changes its
   picks while the demo is upcoming, and sees the saved stable.
2. The administrator starts the demo and confirms later pick writes are
   rejected.
3. The administrator advances at least one day and both players observe the
   same leaderboard and score changes.
4. The administrator completes the demo and both players see the final state.
5. A reset is performed only after feedback is captured, and a fresh invited
   player account confirms the next round starts at day 0 with picks open.

Record pass/fail evidence in #91, including account count, browsers/devices,
the round ID, and any linked feedback issues. Do not include email addresses,
Shareable Links, access tokens, or deployment-protection secrets.

## Reset cadence

- Use one reset at the beginning of each named round.
- Do not reset while testers are actively playing.
- Use ordinary deployments with `reset_demo: false` for code fixes within a
  round unless invalid test data makes a clean round necessary.
- Announce the next reset to testers and capture outstanding feedback first.
- Never create a cron, scheduled workflow, or recurring automation for resets.

## Teardown

At the end of the playtest:

1. Revoke all Vercel Shareable Links and granted deployment access.
2. Remove the deployment origin from Neon Auth trusted domains.
3. Disable the `Deploy Playtest` environment or remove its GitHub secrets.
4. Export only non-sensitive feedback needed for follow-up issues.
5. Delete the dedicated Vercel and Neon projects only after verifying their IDs
   and URLs do not match Preview or Production.

The playtest database contains disposable fixture and tester data. It is not a
backup source and must never be promoted or copied into production.
