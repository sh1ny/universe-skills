# Retrospective: follow-up-universe-gaps

> Written: 2026-06-26 (after verify passed)
> Commit range: `origin/main..HEAD` (symbolic; 11 implementation commits as of verification run, prior to committing this artifact)
> Worktree: `.worktrees/follow-up-universe-gaps` (branch `feature/follow-up-universe-gaps-impl`, merged to `feature/follow-up-universe-gaps`)

---

## 0. Evidence

> Quantitative upfront data — subsequent Wins / Misses bullets reference these directly, avoiding per-line `[evidence: ...]` repetition.

- **Commit range**: `origin/main..HEAD` — 11 implementation commits (prior to committing this artifact)
- **Diff size**: +646 / -26 lines across 11 files
- **Tasks done**: 11/11 (`grep -cE '^\s*- \[x\]' tasks.md` → 11; regex allows sub-task indentation)
- **Active hours**: ~3 (estimate: brainstorm + artifacts + implementation + verify cycle)
- **Subagent dispatches**: 4 (SDD: one subagent per task, each with brief + report + review diff in `.worktrees/follow-up-universe-gaps/.superpowers/sdd/`)
- **New external dependencies**: none
- **Bugs encountered post-merge**: none (not yet merged; pre-merge verification clean)
- **OpenSpec validate state at archive**: pass (2/2 changes valid, 0 issues)
- **Test coverage signal**: 209 tests pass, 0 fail, 705 expect() calls, 100% line + function coverage on all `src/*.js`, fallback bundle up to date

Commit chain (chronological, subjects only — no SHAs to avoid stale-reference amend loops):

```
1. Add brainstorm artifact for follow-up-universe-gaps change
2. Scaffold follow-up-universe-gaps change artifacts
3. Add `.worktrees/` to gitignore for SDD isolation
4. test: add schema-version frontmatter removal test (W5)
5. test: replace no-op path-safety test with sibling-outside-file-is-ignored test (W3)
6. docs: update Test Files table with current counts and universe test groups (W4)
7. docs: mark W3, W4, W5 as resolved in follow-up doc
8. Prior verify artifact (since removed due to stale-SHA amend loop)
9. Prior retrospective artifact (since removed due to stale-SHA amend loop)
10. Stale SHA reference fix (since superseded)
11. Rename test to 'ignored', delete premature verify.md and retrospective
```

> Commits 8–11 were from a prior verify/retrospective cycle that hit a self-referential stale-SHA amend loop. Those artifacts were deleted and are being recreated fresh in this cycle. This retro is part of that fresh recreation.

---

## 1. Wins

- [evidence: tasks.md §1, test/story.test.js:1212] W5 test added cleanly — mirrors existing `name`-removal test structure exactly, passes on first run because implementation was already correct.
- [evidence: tasks.md §2, test/story.test.js:1580] W3 replacement test directly tests containment behavior instead of a no-op empty-scan assertion. The sibling-outside-file approach tests the realistic scenario (mirrored entity path structure in a sibling directory) without requiring mocks or symlinks.
- [evidence: tasks.md §3, AGENTS.md:240-247] W4 full re-audit caught all stale rows in one pass. All non-test rows verified unchanged; only `cli.test.js` and `story.test.js` needed updates.
- [evidence: verify.md §1-2, `bun run test:coverage`] Zero source code changes required — all three gaps were test/docs-only. Coverage remained 100% and fallback bundle unchanged, eliminating the `build:fallback` / `check:fallback` step entirely.
- [evidence: brainstorm.md Domain Model] Brainstorm's containment model analysis (readdirSync only sees files inside directories, traversal-named files are architecturally unreachable) directly shaped the W3 test design decision, avoiding a dead-end test approach.
- [evidence: .worktrees/follow-up-universe-gaps/.superpowers/sdd/progress.md] SDD workflow executed cleanly — 4 task briefs dispatched to subagents, 4 task reports returned with self-review findings, 4 review diffs all marked clean. Worktree isolation prevented cross-branch contamination; one accidental edit to the main checkout was caught and reverted before the correct worktree-path edit was applied (task-1-report.md Notes).

## 2. Misses

- 🟡 [painful | evidence: commits 8-10, verify.md §5 note] **Stale-SHA amend loop in prior verify/retrospective cycle**. The prior verify.md and retrospective.md embedded exact commit SHAs that became stale the moment those artifacts were committed, triggering an amend cycle that required deleting both artifacts and starting over. The fresh cycle uses symbolic ranges (`origin/main..HEAD`) and subject-only summaries to prevent recurrence.
- 📌 [nit | evidence: verify.md §3] **Delta spec not synced to main specs**. The `openspec/specs/` directory is empty — no main spec counterpart exists for `universe-scaffold-coverage`. Sync is deferred to archive time. This is expected for the first change using a new capability, but worth noting.
- 📌 [nit | evidence: design.md Risks] **AGENTS.md test counts will drift again**. No automated check exists to detect when AGENTS.md test counts diverge from actual `bun test` output. Accepted as a documentation maintenance cost, but the drift will recur.

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| Task 4 (verification) | Verify/retrospective artifacts were created prematurely, then deleted and recreated | Prior cycle embedded exact SHAs in verify.md and retrospective.md, creating a self-referential amend loop. Fresh artifacts use symbolic ranges only. |
| Task 4 Step 2 | `bun run test:coverage` confirmed 209 tests (not 208+1=209 as planned — the baseline was 208, W5 added 1) | No deviation — plan predicted 209 correctly. Confirming the count matched. |

No scope changes, no task additions or removals. All 11 tasks completed as planned.

## 4. Skill / workflow compliance

| Skill                                            | Used |
|--------------------------------------------------|------|
| superpowers:brainstorming                        | ✓ |
| superpowers:writing-plans                        | ✓ |
| superpowers:using-git-worktrees                  | ✓ |
| superpowers:subagent-driven-development          | ✓ |
| (transitive) superpowers:test-driven-development | ✓ |
| (transitive) superpowers:requesting-code-review  | ✓ |
| superpowers:finishing-a-development-branch       | (pending — not yet reached) |

> All apply-phase skills used. SDD workflow evidence: worktree at `.worktrees/follow-up-universe-gaps` (branch `feature/follow-up-universe-gaps-impl`), 4 task briefs + 4 task reports + 4 review diffs in `.superpowers/sdd/`, all reviews marked clean in `progress.md`.

### Deliberately Skipped Skills

> None — all skills used. No entries in this section.

## 5. Surprises

- **The stale-SHA amend loop was not anticipated**. The prior verify.md and retrospective.md embedded exact commit SHAs (then-HEAD as a literal hash). Committing those artifacts changed HEAD, making the embedded range immediately stale. Amending to fix changed HEAD again, creating a cycle. The fix (symbolic ranges + subject-only summaries) was obvious in hindsight but required deleting both artifacts and starting the verify/retrospective cycle over. This was a known risk from the `openspec-verify-retrospective-no-amend-loop` skill/memory, but it was not applied proactively during the first cycle.

- **The no-op path-safety test (W3) had been shipping since `epic-worldbuilding`**. The test was named "universe entity files outside universeRoot are refused" but never created an out-of-root file — it scanned an empty universe and asserted the result was empty. The test passed vacuously. This was caught only during the verify pass of `epic-worldbuilding`, not during implementation or review of that change.

## 6. Promote candidates → long-term learning

- [ ] 🔴 **Never embed exact commit SHAs in verify.md or retrospective.md — use symbolic ranges only** → **Promote to memory** (type: feedback)
  > **Why**: The `follow-up-universe-gaps` change hit a self-referential amend loop where verify.md embedded the then-HEAD as a literal hash. Committing the artifact changed HEAD, making the range stale. Amending to fix changed HEAD again, creating a cycle. Required deleting both artifacts and starting over.
  > **How to apply**: When writing verify.md §5 or retrospective.md §0 commit ranges, always use `origin/main..HEAD` or `<base-branch>..HEAD` symbolic form. List commit subjects only, never SHAs. This applies to any artifact that will be committed to the same branch it describes.

- [ ] 🟡 **Test names must match test behavior — vacuously-passing tests are a silent coverage gap** → **Promote to project CLAUDE.md** (testing conventions section)
  > **Why**: The W3 no-op test was named "entity files outside universeRoot are refused" but never created an out-of-root file. It passed vacuously for the entire `epic-worldbuilding` cycle, giving false confidence that path-safety containment was tested.
  > **How to apply**: When writing or reviewing tests, verify that the test body actually exercises the condition named in the test title. A test that asserts an empty result without creating the preconditions for non-emptiness is a no-op.

- [ ] 📌 **AGENTS.md test counts need an automated drift detector** → **One-off** (document only, do not promote)
  > **Why**: AGENTS.md test counts drift silently as tests are added. No CI check exists. The W4 fix was manual re-audit, which will need repeating.
  > **How to apply**: If a future change adds a test, manually update AGENTS.md in the same commit. A CI script comparing AGENTS.md counts to `bun test` output would prevent drift but is out of scope for this change.
