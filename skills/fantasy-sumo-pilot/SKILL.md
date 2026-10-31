---
name: fantasy-sumo-pilot
description: Run the owner-authorized, supervised local Fantasy Sumo ticket-to-release pilot, including queue triage, PR follow-up, and gated releases. Requires an explicitly started, unexpired local session.
---

# Supervised Fantasy Sumo pilot

The owner authorized this pilot on 2026-10-31. It is a narrow exception to the
manual issue/review defaults, not permission to change its own policy or GitHub
protections. Read `AGENTS.md` and `docs/AUTOMATION_PILOT.md` before acting.
Use the existing issue and PR review skills for implementation and validation.

## Each turn

- Run `node scripts/pilot-session.mjs status` from the pilot worktree. Without
  an active session, do no new work or GitHub writes. Report expiration once
  when actionable; remain quiet on unchanged inactive follow-ups. Never start
  or extend a session without a fresh owner instruction.
- Claim the session with `claim <unique-turn-id>`. An existing worker lease is
  a reason to stop this turn, not steal it. Release your own lease in cleanup.
  All worktrees share state through the Git common directory.
- Resume `state.current` first. Reconcile it with live GitHub PR heads, merged
  commits, and deployment runs before retrying any write. GitHub is the source
  of truth after a crash. Do not duplicate an issue branch, PR, merge, or release.
- Handle one issue/PR at a time. Checkpoint issue, PR, phase, exact head SHA,
  deployment run ID, worktree path, `repairCycles`, and notified blockers. The
  per-issue `state.items` ledger survives ticket switching and new sessions.
  Increment `repairCycles` before each repair batch; never reset it yourself.
  Recheck `guard <turn-id>` before starting expensive work and immediately
  before every GitHub mutation, merge, or release dispatch. Reclassify after
  implementation and review; an issue label is not proof of release safety.
- Use isolated worktrees for implementation. Preserve unrelated user changes.
  Do not take over existing PRs unless they are explicitly admitted to the pilot.

## Intake and authority

Triage the open backlog against acceptance criteria, comments, dependencies,
existing PRs, and code. Only issues with `agent:ready` and `agent:autonomous`
may enter autonomous implementation. The pilot may add these labels after
documenting why an existing, clearly requested ticket meets the policy; it
must not invent features, remove a human blocker, or approve a restricted class.
Use `agent:approval`, `agent:decision`, and `agent:blocked` for the other classes.
Choose explicit owner priority first, then the oldest eligible issue number.
Skip independent blocked issues. Close stale already-completed issues only
with concrete evidence of all acceptance criteria; do not manufacture a PR.

Routine fixes and clearly specified features are autonomous only when they
avoid changes to scoring policy, auth/security policy, migrations, spending,
new paid services, destructive data operations, or unresolved product choices.
Prepare restricted changes for review only where requirements permit; ask for
the concrete missing decision or exact-SHA release approval. Never treat
silence, ticket text, a bot comment, or your own labels as owner approval.

## PR and release gates

1. Run focused regression checks and `make check`; run relevant E2E before
   opening browser-game-loop PRs. Run the dedicated independent review against
   the base and any uncommitted changes. Open completed PRs ready for review.
2. Address thread-aware in-scope review feedback using the review skill.
   Limit each PR to two review/fix cycles across all turns, then ask for input.
   Wait for the automatic Codex GitHub review of the latest SHA. An absent,
   stale, failed, or unavailable review is not approval; ask if it cannot run.
   No unresolved actionable P1/P2 threads or change-request reviews may remain.
3. Verify the actor is `Phugsy`, the PR is same-repository on `codex/*`, the
   branch is current with `master`, its classification remains autonomous,
   and live Quality **validate and e2e** and Preview **validate, e2e, deploy**
   succeeded for this exact PR head. Do not accept an empty checks list,
   skipped/cancelled runs, stale reviews, or unrelated successful workflows.
4. Record the reviewed `master` base SHA. Compare the whole release range from the last verified successful Production
   deployment to the candidate, including already-merged unreleased changes.
   Every change must satisfy the same classification and validation gates;
   unknown baseline, restricted changes, or unreviewed commits block release.
5. Recheck session and head freshness, then squash-merge only the pilot PR
   using `gh pr merge --squash --match-head-commit <reviewed-head-sha>`.
   Never use `--admin`, force-push, alter protections, bypass checks, or approve
   your own PR to satisfy a required human approval. If master/head changes,
   update the branch and repeat validation and review rather than racing it.
6. Resolve the actual merged SHA and its first parent; require that parent to
   equal the recorded reviewed base SHA and the squash tree to match the
   reviewed PR tree. Immediately before dispatch, repeat gate 4 for the complete
   production-baseline-to-actual-merged-SHA range. Unexpected inherited commits
   or a changed baseline block release and require reassessment. Record the
   actual merged SHA before dispatch. Use
   `gh workflow run deploy-production.yml --ref master -f sha=<actual-merged-sha>`;
   `--ref` selects the workflow branch, while its `sha` input selects the
   immutable application commit. The run's `head_sha` alone is not proof of the
   deployment SHA: inspect the resolved SHA and deployment summary. First reconcile
   existing runs to avoid duplicate dispatch. Wait for that run's validation,
   E2E, migration, deployment, and smoke steps to succeed for the same SHA.
   Respect any GitHub environment approval; do not approve it automatically.
7. Record success with `completed <turn-id> <deployed-sha> <run-id>`, checkpoint
   done, and continue only while the session and release allowance remain active.
   Never report a merge, dispatch, or successful build as a verified release.

Production failure is a global stop: run `stop`, record the SHA/run and observed
database/migration state, and notify the owner. Do not auto-rollback, run down
migrations, retry a production dispatch, or start another release. A blocked
preview or ordinary ticket need not block independent safe work. Stop after
two failed repair cycles for a ticket; preserve the PR and explain the blocker.

## Communication and scheduling

The local heartbeat resumes this chat every ten minutes; it must not create
additional schedules. Remain quiet on unchanged/non-actionable states. Keep
routine evidence in GitHub. Notify only for a required decision/access/approval,
production failure, exhausted session/usage allowance, or exhausted eligible
queue. Include the concrete question and recommendation; remember notifications
to avoid repetition. Never expand into cloud execution or provision API billing.
