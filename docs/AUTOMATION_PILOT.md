# Supervised development pilot

The owner approved a laptop-based ticket-to-release pilot on 2026-10-31.
Codex may triage the existing backlog, implement eligible tickets, follow PR
reviews, and merge/release autonomous work through the existing GitHub workflows.
The controlling procedure is
[`fantasy-sumo-pilot`](../skills/fantasy-sumo-pilot/SKILL.md).

## Classification

| Class              | Behaviour                                                                | Initial examples                                                                           |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `agent:autonomous` | Implement, validate, review, merge, release                              | Routine fixes and clearly specified features without restricted changes                    |
| `agent:approval`   | Prepare a reviewable change; require owner approval before merge/release | Scoring-policy changes, auth/security policy, migrations, spending, destructive operations |
| `agent:decision`   | Investigate and recommend; wait before dependent implementation          | Unspecified rules, conflicting requirements, new product direction                         |
| `agent:blocked`    | Record the dependency; continue independent eligible work                | Missing access, unresolved dependency, exhausted repair attempts                           |

`agent:ready` additionally marks tickets with clear acceptance criteria and no
unresolved dependencies. Labels never override actual risk or human comments.
The agent may classify existing requests, but cannot self-approve restricted
work or change this policy. Explicit owner priority wins; otherwise take the
oldest eligible issue. One issue uses one branch and one PR.

## Session controls

Run from the pilot checkout with Node 24 available:

```bash
make pilot-status
make pilot-start                 # explicitly arm a two-hour monitored session
make pilot-start MINUTES=60      # choose 1–240 minutes
make pilot-stop                 # revoke new work immediately
```

Starting a session is a human decision. An agent may start it on a fresh owner
instruction, including the initial request to try this pilot, but must never
renew it automatically. Each session permits at most three verified production
releases. Stop monitoring by stopping the pilot or pausing its scheduled task;
closing/sleeping the laptop also prevents local execution. Merely leaving the
laptop awake does not prove someone is watching: the expiring session is the
explicit monitoring boundary.

State lives outside tracked files in the shared Git common directory at
`fantasy-sumo-pilot/state.json`. It stores the expiry, current issue/PR/head,
deployment run, repair attempts/notifications, worker lease, and completed
release SHAs. It contains no credentials. Atomic state updates and a persisted
exclusive worker lease prevent overlapping pilot workers across worktrees.
The script enforces session/lease/release-count controls; the skill and GitHub
checks enforce semantic classification, review, and deployment requirements.
This is an agent-operated pilot, not a tamper-proof authorization service.

Stopping or expiry prevents new actions. It does not cancel an already-running
GitHub deployment or interrupt an in-flight migration. Observe that run and
record its outcome before handoff. Local checkpoint/completion/lease cleanup
remain available after expiry. An interrupted agent can leave a worker lease
or transaction lock behind: verify the original turn/process is no longer
running and reconcile GitHub state before manually clearing it. Never steal a
lease because it is old. Restarting a session preserves unfinished checkpoints.

The local heartbeat runs every ten minutes in this chat, while the laptop and
desktop app are running. It remains quiet without actionable changes. It does
not independently renew sessions. Usage limits can still interrupt execution;
durable checkpoints support resumption. Do not keep API keys or production
credentials in the prompt or local state.

## Verification and release

Per-issue checkpoints and monotonic `repairCycles` persist when tickets are
skipped and when a human starts a new session. A new session is not permission
to reset a ticket's two-cycle repair allowance.

The pilot retains focused tests, `make check`, conditional local E2E, independent
pre-handoff review, automatic Codex GitHub review, exact-head CI and Preview,
thread-aware remediation, and a maximum of two review/fix cycles per PR.
Reviews/checks must apply to the final commit. A missing review is a blocker.

Only same-repository pilot PRs on `codex/*` are eligible for merging. Inspect
the complete range since the last verified successful Production deployment,
not only the ticket diff: unrelated unreleased changes can raise the release
classification. Record the reviewed base, use a head-matched squash merge
without administrative bypass, and verify the resulting parent and tree.
Repeat the full release-range check against the actual merged commit immediately
before dispatch, so a concurrent merge cannot introduce unassessed changes.
Release the actual merged SHA through the existing Production workflow's `sha`
input (`--ref master` selects the workflow, not the application version), and
verify its migration, deployment and database-backed smoke test. No direct
Vercel releases, new release workflows, protection changes, or down migrations.

Production verification failure stops the whole session and asks the owner
for recovery input. Missing access, required human approvals, blocked tickets,
exhausted retries, and an empty eligible queue cause concise actionable
notifications. Independent blocked tickets can be skipped. Routine successful
progress stays in GitHub; the next heartbeat should not repeat unchanged alerts.

## Local first; cloud later

The pilot uses the existing desktop/CLI session, local isolated worktrees, and
existing GitHub validation/deployment infrastructure. No new API billing or
cloud credentials are provisioned. A cloud runner could later use the Codex
GitHub Action with isolated generation and publish jobs, scoped credentials,
durable queue state, and an approved usage budget. Issue #63 covers the narrower
cloud PR-remediation investigation; it is not authorization to spend or enable
an automatic cloud writer.

Official references: [scheduled tasks](https://learn.chatgpt.com/docs/automations),
[non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode),
and [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action).
