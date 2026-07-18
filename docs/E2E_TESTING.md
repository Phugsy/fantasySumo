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

For E2E, still run against a test-only `DATABASE_URL` so tests remain isolated
from developer state. Demo reset itself is scoped to the known basho marked
`isDemo` and cannot clear live bashos. The demo seed uses fake data, but it
flows through the real SQLite schema, repositories, Fastify API, React UI, and
domain scoring code. The Playwright web server sets `VITE_BASHO_MODE=demo` so
the browser explicitly selects that fixture even if live records are also
present.

The deterministic demo lifecycle can be used as fixture setup:

```bash
make demo-reset        # day 0, picks open, no results
make demo-start        # picks locked, basho active, no results
make demo-advance-day  # apply the next day of results
make demo-complete     # apply all 15 days and complete the basho
```

Use `make demo-reset` before create-team flows that need picks open. Use `make demo-start` plus one or more `make demo-advance-day` runs before leaderboard flows that need scores to change incrementally.

Once the API server is running, E2E setup can call the equivalent local admin endpoints instead of shelling out:

```bash
curl -X POST http://localhost:3000/api/admin/demo/reset \
  -H "x-demo-admin-token: $DEMO_ADMIN_TOKEN"
curl -X POST http://localhost:3000/api/admin/demo/start \
  -H "x-demo-admin-token: $DEMO_ADMIN_TOKEN"
curl -X POST http://localhost:3000/api/admin/demo/advance-day \
  -H "x-demo-admin-token: $DEMO_ADMIN_TOKEN"
curl -X POST http://localhost:3000/api/admin/demo/complete \
  -H "x-demo-admin-token: $DEMO_ADMIN_TOKEN"
```

Prefer the API endpoints inside browser/API integration tests because they exercise the same local app boundary a user-facing workflow depends on. Use the Make targets for pre-server fixture setup or manual development loops.

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
    "e2e:ui": "playwright test --ui",
    "e2e:install": "playwright install chromium"
  }
}
```

Also add Makefile targets as thin wrappers:

```make
e2e:
	$(PNPM) e2e

e2e-ui:
	$(PNPM) e2e:ui

e2e-install:
	$(PNPM) e2e:install
```

Do not add E2E to `make check` until the suite is reliable and fast enough for routine PR validation. Before that, document it as an explicit pre-merge or feature-flow check.

## Current Playwright Harness

The initial harness for issue #23 lives in `e2e/` and is configured by `playwright.config.ts`.

Run it with:

```bash
make e2e-install
make e2e
```

The suite starts the local Fastify API and Vite web app and runs with one worker
because the tests reset shared deterministic demo data. The core journey runs
through three Playwright projects:

- desktop Chromium using the Desktop Chrome device profile;
- mobile Chromium using the Pixel 5 device profile;
- mobile WebKit using the iPhone 13 device profile.

These mobile projects emulate mobile browser behaviour, including their
viewport, user agent, device scale, touch support, and browser engine. They are
not substitutes for occasional testing on physical devices.

By default the harness writes to a test-only SQLite file:

```bash
file:./data/e2e/fantasy-sumo-e2e.sqlite
```

That relative URL resolves inside `packages/db`, so it does not mutate the default developer database at `packages/db/data/fantasy-sumo.sqlite`. To use a different E2E database, set `E2E_DATABASE_URL`:

```bash
E2E_DATABASE_URL=file:./data/e2e/local-run.sqlite make e2e
```

Playwright uses ports `3000` for the API and `7866` for Vite. Stop any existing processes on those ports if the harness cannot start them. The protected demo admin controls are enabled with an E2E-only `DEMO_ADMIN_TOKEN` from the Playwright config; no live sumo data sources or production services are used.

The browser suite covers API-backed app loading, team creation, selection
validation, pick locking, protected demo progression, score refreshes,
leaderboard ordering, and responsive navigation. Admin-route configuration is
also covered at the Fastify boundary: missing or invalid credentials are
rejected, disabled demo routes return `404`, and enabled routes drive the real
browser lifecycle tests.

On failure Playwright retains a trace, screenshot, and video under
`test-results/`. In CI, the HTML report and test artifacts are uploaded for
inspection. Use the trace viewer locally with:

```bash
pnpm exec playwright show-trace test-results/<result-directory>/trace.zip
```

The GitHub Actions quality workflow runs `make check` and `make e2e` for pull
requests and pushes to `master`.

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

## Agent-Browser Visual Pass

Use agent-browser as an exploratory visual layer when UI layout, responsive
behaviour, interaction feedback, or a difficult-to-assert state changes. It
supplements committed Playwright assertions; it is not a replacement or a CI
gate.

A useful pass should use separate desktop and mobile sessions and collect both
semantic and visual evidence:

```bash
agent-browser --session fantasy-sumo-desktop set viewport 1440 900
agent-browser --session fantasy-sumo-desktop open http://127.0.0.1:7866
agent-browser --session fantasy-sumo-desktop snapshot -i
agent-browser --session fantasy-sumo-desktop screenshot --full

agent-browser --session fantasy-sumo-mobile set device "iPhone 14"
agent-browser --session fantasy-sumo-mobile open http://127.0.0.1:7866
agent-browser --session fantasy-sumo-mobile snapshot -i
agent-browser --session fantasy-sumo-mobile screenshot --full
```

Exercise the relevant journey, re-snapshot after page changes, and inspect
console messages, page errors, and API requests when the installed
agent-browser version supports those debug commands. Report which sessions,
viewports/devices, and interactions were checked. Close both sessions after the
pass.

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

## Deferred Journeys

Authentication, current-user team retrieval, pick editing, and browser-driven
admin/import controls do not exist in the current UI. Add their E2E journeys in
the feature tickets that introduce those behaviours instead of encoding
speculative tests here.
