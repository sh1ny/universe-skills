# Retrospective: epic-worldbuilding

> Written: 2026-06-25 (after verify passed; updated post-Codex-review fixes)
> Commit range: `origin/main..HEAD` (6 commits including W1/W2 fixes)
> Branch: `feature/epic-worldbuilding` (pushed to `origin`, PR #1 open)

---

## 0. Evidence

> Quantitative upfront data — subsequent Wins / Misses bullets reference these directly, avoiding per-line `[evidence: ...]` repetition.
> Cold-writing scenario (retro written some time after the cycle ended): using only `git log` + `tasks.md` +
> commit messages, this section should be reconstructable.

- **Commit range**: `origin/main..HEAD` (6 commits)
- **Diff size**: +5,991 / -228 lines across 22 files (initial), +450 / -3 (W1/W2 code fix), +35 / -46 (docs)
- **Tasks done**: 42/42 (`grep -cE '^\s*- \[x\]' tasks.md` → 42)
- **Active hours**: ~6 (estimated from session timestamps; brainstorm through verify)
- **Subagent dispatches**: n/a (implementation was done in a prior session; plan.md references `subagent-driven-development` workflow but dispatch count not recorded)
- **New external dependencies**: none
- **Bugs encountered post-merge**: none (not yet merged; Codex review found W1/W2 which were fixed in `851e5a7` before merge)
- **OpenSpec validate state at archive**: pass (1/1 items valid)
- **Test coverage signal**: 133 tests pass, 556 expect() calls, 100% line + function coverage on all `src/*.js` files

Commit chain (chronological):

```
cb61521 feat: add universe scaffold — container, cross-level resolution, vali...
9b391fa chore: add OpenSpec change artifacts for epic-worldbuilding
ac94c2d chore: add verify, retrospective artifacts and follow-up gaps note
3d06abf docs: rewrite README for fork — GitHub-source install, universe-manag...
851e5a7 fix: universe validation checks required paths and manuscript refs
(docs) fix: narrow D3 design, update spec and verify for W1/W2 resolution
```

---

## 1. Wins

- [evidence: `cb61521`, 133 tests, 100% coverage] Zero-impact opt-in: existing single-story projects pass `story validate` unchanged. The `scanProject` extension conditionally attaches `project.universe` only when `story.data.universe` is present — no existing consumer needed modification.
- [evidence: `src/story.js:351-397`, D12] Path-safety isolation: `scanUniverse` uses `universeRoot` as its root argument to `readEntityFiles`/`assertLexicallyInsideRoot`, never `storyRoot`. This was a forced design (universe is an ancestor of story root) that was correctly identified in brainstorm Q4 and carried through to implementation without compromise.
- [evidence: `src/story.js:103-138`, D9] Auto-detection during `story init` — walks up from target directory to find `universe.md` and writes the `universe` field into `story.md` frontmatter automatically. Zero-friction opt-in, no `--universe` flag needed.
- [evidence: `skills/story-maintenance/scripts/story.js`, `check:fallback` exit 0] Fallback bundle regenerated and byte-matches fresh build on first try — `build:fallback` + `check:fallback` pipeline held up cleanly.
- [evidence: `design.md:139-141`] All 12 design decisions (D1–D12) settled during brainstorming. Zero open questions at design time — the brainstorm → proposal → design → spec → tasks → plan chain produced a coherent, unambiguous specification that implementation followed faithfully.
- [evidence: `tasks.md`, 42/42] Every task in tasks.md completed. The 10-section decomposition (scaffold → scan → init → validate → report → CLI → skills → docs → tests → fallback) mapped 1:1 to implementation commits and test groups.

---

## 2. Misses

- 🟡 [painful | evidence: `verify.md` W1, `src/story.js:638,681`] ~~**`validateUniverse` cross-level gate inconsistency**~~: `validateUniverse` gated cross-level/shadowing checks on `isStoryRoot` (directory proximity to `universe.md`) rather than on `storyData.universe` (the frontmatter opt-in field). A story under an ancestor `universe.md` without the `universe` field got false-positive cross-level/shadowing errors. **RESOLVED in `851e5a7`** — gate changed to `if (isStoryRoot && storyData.universe)`.
- 🟡 [painful | evidence: `verify.md` W2, `design.md:46-50`, `src/story.js:59-67`] ~~**D3 design scope drift**~~: D3 stated "both levels can hold any entity type" but the scaffold only supports 5 shared-worldbuilding types. Additionally, `validateUniverse` didn't check cross-level references from narrative entities (chapter.pov, scene.characters, arc.characters) to universe-level entities. **RESOLVED in `851e5a7` + follow-up docs commit** — D3 narrowed to "shared-worldbuilding entity types only" in design and spec; cross-level checks extended to chapters, scenes, arcs, questions, and promises.
- 📌 [nit | evidence: `verify.md` W3, `test/story.test.js:1489-1498`] **No-op path-safety test**: Task 9.8's "entity files outside universeRoot are refused" test scans an empty universe and asserts empty arrays — it never creates an out-of-root file or asserts a refusal. Implementation is safe (symlink test at lines 1500-1514 exercises the containment guard), but this specific scenario is untested.
- 📌 [nit | evidence: `verify.md` W5, `test/story.test.js:1158-1168`] **Missing `schema-version` test**: Spec defines a `schema-version` frontmatter removal scenario (spec.md:159-161) but only the `name`-missing scenario is tested. Implementation handles both via the loop over `UNIVERSE_REQUIRED_FRONTMATTER`, so this is a test gap, not an implementation defect.
- 📌 [nit | evidence: `verify.md` W4, `AGENTS.md:238-247`] **Stale AGENTS.md test inventory**: Test Files table lists `story.test.js` as 23 tests (actual: ~79 across 9+ describe blocks including 7 universe groups) and `cli.test.js` as 8 tests (actual: ~22). No universe test groups mentioned.

---

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| 4.2 | ~~Cross-level validation only checks the 5 worldbuilding entity types, not narrative entities~~ **RESOLVED in `851e5a7`** — now checks chapter/scene/arc/question/promise refs | D3 scope ambiguity — "any entity type" was interpreted as "the 5 scaffolded types" during implementation. Narrowing D3 + extending checks resolves this. |
| 9.8 | Path-safety "outside universeRoot" test doesn't actually test out-of-root files | Test was written to scan an empty universe and assert empty results rather than creating an out-of-root file and asserting refusal. The symlink test covers the containment guard, but the specific scenario isn't exercised. |

---

## 4. Skill / workflow compliance

| Skill                                            | Used |
|--------------------------------------------------|------|
| superpowers:brainstorming                        | ✓    |
| superpowers:writing-plans                        | ✓    |
| superpowers:using-git-worktrees                  | ✗    |
| superpowers:subagent-driven-development          | ✗    |
| (transitive) superpowers:test-driven-development | ✗    |
| (transitive) superpowers:requesting-code-review  | ✗    |
| superpowers:finishing-a-development-branch       | ✗    |

> Only `brainstorming` and `writing-plans` have direct evidence — their artifacts exist in the change directory (brainstorm.md, plan.md).
> All other skills lack evidence of use and are marked ✗ with explanations below.

### Deliberately Skipped Skills

- **`superpowers:using-git-worktrees`**
  - **What was skipped**: The entire skill — no git worktrees were created (`.git/worktrees` directory absent). Work was done on a feature branch `feature/epic-worldbuilding` directly in the main working tree, not in an isolated worktree.
  - **Why this cycle**: The implementation session (`cb61521`) used a plain feature branch, not the worktree isolation the skill prescribes. No `.git/worktrees` directory exists. The plan.md header references `subagent-driven-development` which in turn references worktrees, but the worktree was never actually created.
  - **How to prevent recurrence**: `CLAUDE.md trigger` — add an instruction that after `writing-plans` produces plan.md, the next step MUST be `using-git-worktrees` to create an isolated worktree before implementation begins. The plan.md header alone is insufficient as a trigger.

- **`superpowers:subagent-driven-development`**
  - **What was skipped**: The entire skill — no subagent dispatches are evidenced. Plan.md references the skill in its header (`Use superpowers:subagent-driven-development to implement this plan task-by-task`), but there is no transcript, no subagent output artifacts, and no `Subagent dispatches` count recorded in §0 Evidence (`n/a`).
  - **Why this cycle**: The implementation was done in a prior session with no surviving transcript. Plan.md references the skill, but referencing a skill in a plan header is not evidence of using it. The implementation may have been done directly by a single agent without dispatching subagents.
  - **How to prevent recurrence**: `skill description tightening` — update the `subagent-driven-development` skill to require a dispatch log or artifact output that can be verified post-hoc. Without a trail, there's no way to confirm the skill was used during retrospective.

- **`(transitive) superpowers:test-driven-development`**
  - **What was skipped**: Cannot confirm use. Tests exist (133 pass, 100% coverage) and follow a red-green structure in plan.md, but there is no evidence the tests were actually written before implementation (the core TDD invariant). The prior session's transcript is unavailable.
  - **Why this cycle**: Same as `subagent-driven-development` — the implementation session has no surviving transcript. Tests exist but their write-order (before vs after implementation) cannot be verified.
  - **How to prevent recurrence**: `CLAUDE.md trigger` — add a commit-message convention requiring TDD steps to be separate commits (`test: add failing test for X` before `feat: implement X`). This makes TDD compliance auditable from `git log` without a transcript.

- **`superpowers:requesting-code-review`**
  - **What was skipped**: The skill was not run between implementation and verify. However, Codex automated review on PR #1 caught W1 and W2, which were then fixed in `851e5a7`.
  - **Why this cycle**: Verify was the first post-implementation gate run in this session. The implementation session (`cb61521`) completed and committed without a review request. The verify step caught 5 warnings (W1–W5); Codex PR review subsequently caught W1/W2 as bugs.
  - **How to prevent recurrence**: `scope-judgment rule` — for changes with 18+ files and +5,991 lines, a code review pass between implementation and verify should be mandatory, not optional. Add to the apply-phase workflow: after implementation commits, before verify, run `requesting-code-review`.

- **`superpowers:finishing-a-development-branch`**
  - **What was skipped**: The skill was not run before PR creation. Branch `feature/epic-worldbuilding` has been pushed to `origin` and PR #1 is open, but the finishing-a-development-branch skill was not explicitly invoked.
  - **Why this cycle**: The skill is sequential after verify + retrospective. It is the next step in the workflow, not a missed step. Listed as ✗ because it hasn't run yet at retro-write-time.
  - **How to prevent recurrence**: `one-off — schema boundary case` — the retrospective is written before the finishing skill runs by design (retro is a prerequisite for finishing). No prevention needed; this is the correct sequence.

---

## 5. Surprises

- D3's "any entity type" language survived from brainstorm through design without anyone noticing that the scaffold only creates directories for 5 worldbuilding types. The contradiction only surfaced during verification when checking design/spec coherence — the implementation was correct for the 5 types, but the design overpromised scope. This is a common pattern: brainstorm decisions stated at a high level can drift from implementation details when the implementation is more constrained than the original intent.
- The `validateUniverse` gating inconsistency (W1) went undetected because all test scenarios either have a `universe` field or no ancestor `universe.md` — the false-positive path (ancestor `universe.md` + no `universe` field) was never tested. `scanProject` got it right because it was written first with the correct gate; `validateUniverse` was written later and used a different (incorrect) gate.

---

## 6. Promote candidates → long-term learning

- [ ] 🟡 **Design decisions should match implementation scope exactly — "any entity type" when only 5 types are scaffolded creates a verification gap.** → **Promote to** memory (type: feedback)
  > **Why**: D3's "any entity type" language survived from brainstorm through design without detection. The contradiction only surfaced during verification — the implementation was correct for 5 types but the design overpromised.
  > **How to apply**: When writing design decisions, check each "any X" claim against the concrete list being scaffolded. If the implementation is more constrained than the design states, narrow the design language to match.

- [ ] 🟡 **When two code paths implement the same concept (opt-in via universe field), verify both use the same gate condition.** → **Promote to** memory (type: feedback)
  > **Why**: `scanProject` correctly gates on `storyData.universe` but `validateUniverse` gates on `isStoryRoot`. The inconsistency went undetected because no test exercised the false-positive path (ancestor `universe.md` + no `universe` field). Writing the second path's gate differently from the first was the root cause.
  > **How to apply**: When implementing a second code path for the same concept, explicitly compare its gate condition against the first path. Add a test that exercises the divergence point (the path where the two gates disagree).

- [ ] 📌 **Spec scenarios should each have a corresponding test — gaps in scenario-to-test mapping indicate untested behavior even when the implementation handles it.** → **Promote to** memory (type: feedback)
  > **Why**: The spec defined two frontmatter completeness scenarios (name-missing and schema-version-missing) but only one was tested. The implementation handles both via a loop, so it's a test gap, not a defect.
  > **How to apply**: After implementation, cross-reference each spec scenario against test names. Any scenario without a corresponding test is a coverage gap regardless of implementation correctness.

- [ ] 📌 **AGENTS.md documentation should be updated in the same commit that adds the test coverage it describes.** → **Promote to** memory (type: feedback)
  > **Why**: AGENTS.md test inventory table lists stale counts (23→~79, 8→~22) because the documentation wasn't updated when universe tests were added.
  > **How to apply**: When adding tests to a file listed in AGENTS.md's Test Files table, update the count and description in the same commit.

- [ ] 📌 **When a test claims to verify "X is refused," the test must actually attempt X and assert the refusal — scanning an empty universe and asserting empty results is not equivalent.** → **Promote to** memory (type: feedback)
  > **Why**: Task 9.8's "entity files outside universeRoot are refused" test scans an empty universe and asserts empty arrays. It never creates an out-of-root file or asserts a refusal. The implementation is safe but the specific scenario is untested.
  > **How to apply**: When writing a test for a refusal/rejection behavior, the test must trigger the condition being refused and assert the rejection. Asserting the absence of data is not the same as asserting a refusal.
