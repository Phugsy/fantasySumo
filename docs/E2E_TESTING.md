# End-to-End Testing Strategy

## Purpose

End-to-end tests should protect Fantasy Sumo's main player journey once the local MVP flow is stable enough to exercise through the browser.

The harness should give future agents confidence that the fantasy game loop still works after changes, without turning UI detail into brittle test noise.

Do not add broad E2E coverage before the flow under test is stable. Until then, keep using unit, domain, API, and component tests for fast feedback.

## Recommended Tool

Use Playwright for browser E2E tests.

Playwright is the right default because it can start local web servers, drive the Vite React app in a real browser, test against the Fastify API, and collect useful diagnostics such as traces, screenshots, and videos when a flow fails.

Avoid Cypress or a custom browser harness unless a future constraint makes Playwright a poor fit. There is no current constraint that does.

## When To Add E2E Tests

Add the first Playwright harness when the team-selection and leaderboard browser flows are ready to be treated as stable MVP behaviour.

That means:

- the Vite app can load current basho data from the local API;
- a player can create a fantasy team from seeded data;
- the leaderboard can render seeded or newly created teams;
- the database can be reset to a deterministic state before each run;
- the dev servers can be started reproducibly from scripts.

Do not wait for production auth, hosted deployment, live imports, or polished styling. The first E2E suite should protect the local playable loop.

## First Flows To Cover

Start with a small set of high-value tests:

1. Smoke test
   - App loads.
   - Current basho content is visible.
   - The app can reach the Fastify API, either through rendered API-backed content or a lightweight health check.

2. Create fantasy team
   - User opens the current basho.
   - User selects the configured number of valid rikishi.
   - User enters a display/team name.
   - User submits the team.
   - Confirmation or resulting team state is visible.

3. Leaderboard
   - Seeded teams and bout results exist.
   - User opens the leaderboard.
   - Teams are shown in score order.
   - Score breakdown can be inspected when the UI supports it.

4. Validation and error path
   - User cannot submit too few, too many, duplicate, or invalid picks.
   - The error state is visible and understandable.

Keep each flow focused on behaviour. Avoid asserting cosmetic details, exact layout, or implementation-specific component structure.

## Test Data And Reset

E2E tests must use deterministic local data. They must not depend on live sumo data sources, live banzuke endpoints, or the current real-world basho.

Preferred setup:

- use a dedicated SQLite database file for E2E runs, configured through `DATABASE_URL`;
- reset the database before each E2E test run by applying migrations and loading the deterministic demo seed data;
- keep E2E seed data small, explicit, and close to the MVP game loop;
- use demo progression commands to apply enough bout results to make leaderboard ordering meaningful;
- avoid mutating the default developer database at `packages/db/data/fantasy-sumo.sqlite`.

The demo seed command is the intended fixture source:

```bash
make db-seed-demo
```

For E2E, run it against a test-only `DATABASE_URL` so the reset cannot delete a developer's default local data. The demo seed uses fake data, but it flows through the real SQLite schema, repositories, Fastify API, React UI, and domain scoring code.

The deterministic demo lifecycle can be used as fixture setup:

```bash
make demo-reset        # day 0, picks open, no results
make demo-start        # picks locked, basho active, no results
make demo-advance-day  # apply the next day of results
make demo-complete     # apply all 15 days and complete the basho
```

Use `make demo-reset` before create-team flows that need picks open. Use `make demo-start` plus one or more `make demo-advance-day` runs before leaderboard flows that need scores to change incrementally.

The eventual Playwright config should set a test-only `DATABASE_URL`, for example a file under a temporary or ignored E2E data directory. If tests need to inspect persisted state, prefer API assertions over direct database queries unless direct repository checks are clearly simpler.

## Starting The App For E2E

The harness should start the same local app shape that developers use:

- build shared packages needed by the API and web app;
- run the Fastify API with the E2E `DATABASE_URL`;
- run the Vite web app against that API;
- wait for both servers before tests begin;
- shut both servers down after the run.

When implemented, add scripts at the root so agents can run E2E consistently:

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui"
  }
}
```

Also add Makefile targets as thin wrappers:

```make
e2e:
	$(PNPM) e2e

e2e-ui:
	$(PNPM) e2e:ui
```

Do not add E2E to `make check` until the suite is reliable and fast enough for routine PR validation. Before that, document it as an explicit pre-merge or feature-flow check.

## Agent Completion Loop

Once the Playwright harness exists, agents should use E2E as part of their completion loop for changes that affect the browser game flow.

For relevant tickets, a change should not be considered complete until the agent has run the targeted E2E flow or the full `make e2e` suite and reported the result. This applies especially to work that changes:

- team selection;
- leaderboard display or ordering;
- result entry/import flows;
- API responses consumed by the React app;
- database seed/reset behaviour used by the local player journey.

If E2E cannot be run because of a local environment, browser install, sandbox, or port constraint, the agent should state that clearly in the PR summary and run the closest lower-level checks instead.

Do not require E2E for documentation-only changes, isolated domain scoring changes, or API-only changes that have no browser journey impact unless the ticket explicitly asks for it.

## What Belongs In E2E

Use E2E tests for user-visible journeys that cross the browser, API, domain logic, and database together:

- loading current basho data;
- creating a fantasy team;
- seeing validation errors;
- viewing leaderboard ordering and score breakdowns;
- exercising result-entry or result-import flows once those exist.

## What Should Stay In Unit, API, Or Component Tests

Keep detailed rules and edge cases out of E2E when faster tests cover them better:

- scoring arithmetic and day-bounded scoring belong in `packages/domain` tests;
- pick validation combinations belong in domain tests;
- repository persistence behaviour belongs in `packages/db` tests;
- API status codes, request validation, and response shapes belong in API tests;
- component rendering states belong in React component tests;
- importer parsing and source mapping belong in focused importer tests.

E2E should prove that the pieces work together for the main game loop. It should not duplicate every lower-level rule.

## Follow-Up Implementation Ticket

The Playwright implementation work is tracked in GitHub issue #23. That ticket should:

- add Playwright and browser installation instructions;
- add root `pnpm e2e` and `pnpm e2e:ui` scripts;
- add `make e2e` and optionally `make e2e-ui`;
- configure deterministic E2E database setup/reset;
- cover the first smoke, create-team, leaderboard, and validation flows listed above;
- document any sandbox or port requirements needed by Codex.
