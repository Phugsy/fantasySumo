---
name: fantasy-sumo-pr-review-loop
description: Review Fantasy Sumo branch changes before handoff and safely address actionable GitHub pull request feedback. Use for dedicated pre-handoff code reviews or a user-requested manual pass over unresolved PR review threads.
---

# Fantasy Sumo PR Review Loop

Keep review fixes focused, independently checked, and traceable to their GitHub threads. Read `AGENTS.md` first and preserve the issue or PR's existing intent.

## Choose the Mode

- **Pre-handoff review:** review the complete branch diff against its base before calling a change ready.
- **PR feedback:** inspect unresolved review threads and address safe, actionable findings.

Do not create or start recurring scheduled, heartbeat, or babysitting automations from this skill. PR feedback mode is a single manual pass and requires an explicit user request.

## Pre-handoff Review

1. Identify the base branch and confirm the worktree contains only intended changes.
2. Run the relevant focused tests and `make check` before review. On this macOS workspace, use `make check PNPM=/opt/homebrew/bin/pnpm` when the fallback pnpm cannot find `node`.
   - When the change affects the browser game loop, run the relevant Playwright coverage or `make e2e` before the initial handoff. Do not defer this until PR feedback arrives.
   - When the change materially affects UI layout, interaction, responsive behaviour, or a state that assertions may not represent well, also run an agent-browser visual pass when that tooling is available. Treat visual inspection as a supplement to E2E, never a replacement.
3. Select every applicable review target:
   - review committed branch changes with **Review against a base branch**;
   - review staged, unstaged, and untracked changes with **Review uncommitted changes**;
   - run both when the branch has commits and additional worktree changes. A base-branch review does not include uncommitted work.
   - in an agent workflow, delegate each applicable target to a separate read-only reviewer agent with no edit or GitHub-write authority;
   - use `codex review --base <base>` or `codex review --uncommitted` only when the user explicitly authorizes that CLI review and environment policy permits repository data to be sent. Never retry or bypass a denied data-export action.
4. Treat the review as read-only. Triage findings before editing:
   - fix high-confidence correctness, security, data-integrity, lifecycle, and regression findings;
   - reject findings contradicted by repository behavior or tests, recording the evidence;
   - stop for product decisions or scope changes.
5. Apply accepted fixes, rerun focused checks and `make check`, then run one final dedicated review pass.
6. Limit one run to two review-and-fix passes. Report remaining findings rather than looping indefinitely.

## PR Feedback

1. Resolve the PR from the current branch or explicit PR number.
2. Read thread-aware GitHub review state, including resolution and outdated status. Prefer the connected GitHub review-thread tool; fall back to GitHub GraphQL through `gh`. On this macOS workspace, use `/opt/homebrew/bin/gh` when Homebrew is absent from `PATH`. Never classify from a flat comment list alone.
3. Group unresolved comments by behavior and classify them:
   - **Safe to address:** clear P1/P2 correctness defects within PR intent, with a deterministic validation path;
   - **Needs user input:** P0 findings, ambiguous product behavior, conflicting comments, migrations, new dependencies, new services or cost, secrets, auth-policy changes, destructive data work, or material API changes;
   - **Non-blocking:** advisory, style-only, duplicate, outdated, or already-fixed comments.
4. Explain the actionable scope before editing unless the calling prompt explicitly authorizes all safe findings.
5. Keep every edit traceable to a selected thread. Add focused regression coverage at the seam the reviewer identified.
6. Run focused checks, `make check` (using the Homebrew pnpm override above when needed), and `make e2e` when the change affects the browser game loop. Add an agent-browser visual pass when the UI risk warrants it and the tooling is available.

## Publishing an Authorized Fix

Only publish when the user explicitly authorizes GitHub writes.

1. Confirm the branch and cleanly separate unrelated local changes.
2. Verify Git identity is `Phugsy <263059804+Phugsy@users.noreply.github.com>` and `/opt/homebrew/bin/gh api user --jq .login` returns `Phugsy`; stop if either identity mismatches or the authenticated GitHub actor cannot be verified.
3. Commit one coherent review batch and push the PR branch.
4. Reply to each addressed top-level review thread with the commit hash, concise rationale, and validation evidence.
5. Resolve only threads fully addressed by that commit.
6. Re-read thread-aware review state and current checks. Report any new or unresolved feedback.

Never merge, close the PR, delete branches, force-push, or broaden the PR. Leave those actions to the user.
