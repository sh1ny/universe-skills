# Retrospective: follow-up-universe-gaps

> Written: 2026-06-26 (after verify passed)
> Commit range: `234d7bb..HEAD`
> Worktree: merged to main checkout (feature/follow-up-universe-gaps)

---

## 0. Evidence

- **Commit range**: `234d7bb..HEAD` (9 commits)
- **Diff size**: +756 / -27 lines across 12 files
- **Tasks done**: 11/11
- **Active hours**: ~30 min (estimated)
- **Subagent dispatches**: 10 (4 implementers + 4 task reviewers + 1 final reviewer + 1 verify producer)
- **New external dependencies**: none
- **Bugs encountered post-merge**: none (pre-merge)
- **OpenSpec validate state at archive**: pass (2/2 items valid)
- **Test coverage signal**: 209 pass, 0 fail; 100% line+function coverage; fallback up to date

Commit chain (chronological):

```
6c83953 Add brainstorm artifact for follow-up-universe-gaps change
897a3ed chore: scaffold follow-up-universe-gaps change artifacts
3d4e850 chore: add .worktrees/ to gitignore for SDD isolation
242d77e test: add schema-version frontmatter removal test (W5)
9e95c21 test: replace no-op path-safety test with sibling-outside-file-is-ignored test (W3)
9a41415 docs: update Test Files table with current counts and universe test groups (W4)
d53d90a docs: mark W3, W4, W5 as resolved in follow-up doc
4d2d8ac chore: add verify artifact for follow-up-universe-gaps
5d7eda8 chore: add retrospective artifact for follow-up-universe-gaps
```

---

## 1. Wins

- [evidence: 242d77e] W5 test added cleanly — implementation at `src/story.js:826-829` already handled `schema-version` removal identically to `name` removal via the `UNIVERSE_REQUIRED_FRONTMATTER` loop; test passed on first run with no implementation changes needed.
- [evidence: 9e95c21] W3 test replacement was a clean swap — test count remained 169 (replacement, not addition). The sibling-outside containment scenario (`legend.md` inside root, `rogue.md` in sibling dir) directly matches the test name "universe entity files outside universeRoot are refused" for the first time.
- [evidence: 9a41415] W4 full table audit confirmed all non-flagged rows (`frontmatter.test.js`=6, `import.test.js`=4, `continuity.test.js`=3, `markdown.test.js`=3, `workflow-eval.test.js`=1) were accurate — no drift beyond the two flagged rows (`story.test.js` 23→169, `cli.test.js` 8→23). Design decision D3 (full re-audit vs two-row patch) paid off: confirmed no silent drift elsewhere.
- [evidence: 4d2d8ac] verify.md produced with all 7 template sections complete, Overall Decision PASS after one correction (§3 delta spec sync state — see Misses #2).
- [evidence: d53d90a] Follow-up doc `openspec/follow-up-universe-gaps.md` marks all five gaps (W1–W5) as resolved with strikethrough, commit references, and ✅ markers on the implementation order checklist.
- [evidence: 10 subagent dispatches] SDD workflow ran cleanly — 4 implementers all returned DONE, 4 task reviewers all Approved, 1 final whole-branch review Approved, verify artifact reached PASS after correcting §3 sync state.

## 2. Misses

- 📌 [nit | evidence: Task1Impl] Implementer initially edited the main checkout instead of the worktree due to relative path resolution — caught, reverted, and re-applied to the absolute worktree path. No impact on final result; no stray commits.
- 📌 [nit | evidence: verify.md §3] Delta spec sync state was initially marked N/A — corrected to ✗ Needs sync since the delta spec `openspec/changes/follow-up-universe-gaps/specs/universe-scaffold-coverage/spec.md` exists and `openspec/specs/` does not yet exist; `openspec archive` will create it and sync the delta.
- 📌 [nit | evidence: Task4Review] Strikethrough scope inconsistency between W1/W2 (Problem lines unstruck) and W3/W4/W5 (Problem lines struck) in `openspec/follow-up-universe-gaps.md` — cosmetic, no functional impact; reflects the two-phase resolution history (W1/W2 resolved in an earlier commit, W3–W5 resolved in this change).

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| None — all tasks implemented as planned | | |

All 11 sub-tasks across 4 plan tasks were implemented exactly as specified. No scope changes, no task reordering, no scope additions or removals. The plan's prediction of 209 tests (208 baseline + 1 W5 test) was exact.

## 4. Skill / workflow compliance

| Skill                                            | Used |
|--------------------------------------------------|------|
| superpowers:brainstorming                        | ✓ (done in planning phase) |
| superpowers:writing-plans                        | ✓ (done in planning phase) |
| superpowers:using-git-worktrees                  | ✓ |
| superpowers:subagent-driven-development          | ✓ |
| (transitive) superpowers:test-driven-development | ✓ |
| (transitive) superpowers:requesting-code-review  | ✓ |
| superpowers:finishing-a-development-branch       | PENDING (after retrospective) |

### Deliberately Skipped Skills

> All skills used or pending. No skills skipped.

## 5. Surprises

- The no-op W3 test (scanning an empty universe, asserting empty result) had been shipping since the `epic-worldbuilding` merge — it was never caught during that change's review despite its name promising "refused" behavior. The gap was only surfaced in `epic-worldbuilding/verify.md` §4 as W3.
- The implementation was already correct for all three gaps — the entire change was test and documentation coverage only. Zero source code changes to `src/*.js`. This made the change unusually low-risk: the coverage gate couldn't regress because no source lines were touched.
- The AGENTS.md test inventory was more stale than the follow-up doc suggested: `story.test.js` was listed as 23 tests but actually had 169 (7.3× understated), and `cli.test.js` was listed as 8 but actually had 23 (2.9× understated). Both counts were carried over from a pre-universe era and never updated as the test suite grew.
- The W3 containment model analysis revealed that traversal-named outside files are architecturally unreachable via `readdirSync` — the only real containment threat is symlinked directories, already covered by the existing throwing-guard test at lines 1579-1593. This meant the replacement test covers the *ignoring* behavior (sibling dir not enumerated) rather than a *throwing* behavior, which is a subtler distinction than the original test name implied.

## 6. Promote candidates → long-term learning

- [ ] 📌 AGENTS.md test inventory drift → **Promote to** AGENTS.md maintenance note or CI check
  > **Why**: Test counts in the AGENTS.md Test Files table drifted silently (23→169, 8→23) across multiple changes. No automated check exists — counts are manually maintained and go stale every time tests are added.
  > **How to apply**: When any change adds or removes tests, verify the AGENTS.md Test Files table is updated in the same commit. Consider a CI script that compares `bun test` output counts against the table.

- [ ] 📌 No-op test detection → **Promote to** test review checklist
  > **Why**: The W3 no-op test (asserting empty result on empty input) shipped through `epic-worldbuilding` review undetected. Its name promised behavior ("refused") its body never exercised.
  > **How to apply**: During test review, verify each test's name matches its assertions — specifically, tests claiming to verify refusal/rejection must create the condition they claim to reject.

- [ ] 📌 Delta spec sync state convention → **Promote to** verify.md template guidance
  > **Why**: The delta spec sync state was initially marked N/A when it should have been ✗ Needs sync. The convention (delta spec exists → needs sync; no delta spec → N/A) was not self-evident from the template.
  > **How to apply**: When producing verify.md §3, check for delta spec files under `specs/` in the change directory. If any exist, mark ✗ Needs sync regardless of whether `openspec/specs/` exists yet.
