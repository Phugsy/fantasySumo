# Fantasy Sumo Issue Loop

Use this skill when the user asks to work an issue through the Fantasy Sumo repo process, for example:

```text
Use the Fantasy Sumo issue loop on #44.
```

This is a repo-local adapter for Fantasy Sumo's current architecture, data safety rules, and completion evidence. Keep it lightweight. It should help one issue become one focused draft PR; it should not automate issue intake, reviews, merges, or deployment.

## Baseline Rules

Start by reading `AGENTS.md`. It is the baseline rule set for this repo. This skill narrows that guidance into a repeatable issue-to-draft-PR loop.

Also read the current issue and any linked issues, pull requests, or review comments before planning implementation. Use GitHub issue and PR data as the source of truth for acceptance criteria when it conflicts with older local notes.

## Issue Intake

1. Fetch the target GitHub issue, including labels, body, comments, linked pull requests, and linked issues when available.
2. Identify the issue goal, acceptance criteria, blockers, dependencies, and any explicit non-goals.
3. Check the current branch and worktree. Do not revert unrelated user changes.
4. Create or switch to a focused branch for the issue, normally named `codex/issue-<number>-<short-slug>`.
5. Share a short execution plan before making edits when the work is more than a trivial documentation change.

If the issue is blocked by an unanswered product decision, missing secret, unavailable dependency, or conflicting in-progress work, state the blocker and avoid speculative implementation.

## Required Reading

Always read:

- `AGENTS.md`
- `README.md`
- `docs/PROJECT_BRIEF.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`

Read these when relevant:

- `docs/DATA_IMPORT_STRATEGY.md` before changing banzuke imports, result imports, source adapters, dry runs, or data fixtures.
- `docs/E2E_TESTING.md` before adding, changing, skipping, or relying on browser E2E tests.
- `docs/DEPLOYMENT.md` before changing Vercel, production database, environment variables, admin exposure, or deployment shape.
- `docs/MODERNISATION_PLAN.md` before upgrading dependencies, changing build tooling, or revisiting legacy code.
- `docs/adr/0001-rebuild-architecture.md` before changing workspace boundaries or architectural direction.

## Implementation Loop

1. Choose the smallest complete slice that satisfies the issue.
2. Keep changes inside the existing workspace boundaries unless the issue explicitly changes architecture:
   - `apps/web` for React UI behaviour.
   - `apps/api` for Fastify routes and application workflows.
   - `packages/domain` for framework-free scoring, lifecycle, validation, and shared domain types.
   - `packages/db` for Drizzle schema, repositories, migrations, seed data, and deterministic demo data.
3. Update tests near the changed behaviour.
4. Update docs when behaviour, setup, product rules, architecture, data model, scoring, import assumptions, deployment, or E2E expectations change.
5. Prefer Makefile commands for routine verification.
6. Keep the PR focused. Leave unrelated cleanup, automation, or broad shared-skill extraction for follow-up work unless the issue asks for it.

## Fantasy Sumo Guardrails

- Preserve basho lifecycle and pick-locking rules. UI state may mirror those rules, but the API/domain layer must enforce them.
- Keep scoring rules isolated in `packages/domain` where practical, with focused tests.
- Keep import logic separate from scoring logic.
- Keep source-specific import adapters separate from internal import commands and database writes.
- Do not let demo/admin paths mutate live or production data.
- Keep demo data scoped to demo bashos or explicitly configured demo/test storage.
- Use deterministic seed or demo data for tests and manual browser checks.
- Do not depend on live external sumo sources in default tests or E2E flows.
- Do not introduce paid services, hosted infrastructure, public admin exposure, or external APIs without documenting the trade-off.
- Do not commit secrets, local credentials, or real production data.

## Checks

Run the narrowest useful checks while iterating, then run the broader checks that match the change before opening the PR.

Default completion checks:

```bash
make test
make lint
make build
make check
```

For documentation-only changes, `make check` is usually sufficient if it covers formatting, lint, tests, and build. If a check is redundant because a later command includes it, record the broader command as evidence.

For changes that touch repo-root Vercel handlers such as `api/index.ts`, also run a direct TypeScript compile probe for that path or the relevant deployment build check, because root handlers may not be covered by package-level builds.

## E2E Rules

Read `docs/E2E_TESTING.md` before adding or relying on E2E coverage.

Run targeted E2E or `make e2e` once the harness exists when the change affects:

- team selection;
- leaderboard display or ordering;
- result entry or result import flows;
- API responses consumed by the React app;
- database seed/reset behaviour used by the browser game loop;
- basho lifecycle UI behaviour.

Use deterministic local test data and a test-only `DATABASE_URL`. Do not run default E2E against live sumo sources or production data.

If E2E is skipped, record the reason in the PR summary. Acceptable reasons include documentation-only changes, harness not yet implemented, local browser install constraints, sandbox/port constraints, or a change that has no browser game-loop impact.

## Draft PR

Open a draft PR when the issue slice is implemented and relevant checks have been attempted. The PR body should include:

- the issue number it closes or addresses;
- a concise implementation summary;
- test and check evidence, with exact commands and pass/fail/skip status;
- E2E evidence or the reason E2E was skipped;
- docs updated, if any;
- known follow-up work or explicit non-goals.

Do not mark the PR ready for review until required checks and issue-specific acceptance criteria are satisfied.

## Automation Boundary

This skill is manual or semi-manual. It does not create a fully automatic "new issue equals new PR" system.

A later queue can add automation with safer constraints:

- only labelled issues, such as `ready-for-agent`, are eligible;
- one issue is handled per branch and PR;
- PRs open as drafts;
- checks and E2E evidence are required before review;
- nothing auto-merges.

If this loop proves reusable, extract a broader shared `issue-to-pr-loop` skill later and keep this file as the Fantasy Sumo-specific adapter.
