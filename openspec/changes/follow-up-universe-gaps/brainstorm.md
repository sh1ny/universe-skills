# Brainstorm: Follow-Up Universe Scaffold Gaps

## Background

The `epic-worldbuilding` change introduced universe-level scaffolding, validation, and scanning. Its `verify.md` §4 surfaced five gaps (W1–W5). W1 and W2 (the two painful items) were resolved in code commit `851e5a7` and the follow-up docs commit. Three nits remain — W3, W4, W5 — all non-blocking (168 tests pass, 100% coverage).

This change closes the three remaining gaps.

## Evidence Checked

### W5 — Missing `schema-version` frontmatter removal test

**Spec scenario**: "Universe missing required frontmatter" defines two sub-scenarios:
- `name` missing → error — **tested** at `test/story.test.js:1200-1209`
- `schema-version` missing → error — **NOT tested**

**Implementation**: `src/story.js:826-829` loops over `UNIVERSE_REQUIRED_FRONTMATTER = ["name", "schema-version"]` (line 74), pushing `"universe.md missing required frontmatter field: ${field}"` for each missing field. Both fields are handled identically — the gap is test coverage only, not implementation.

**Existing name-missing test** (lines 1200-1209):
```js
test("validates universe.md frontmatter completeness", () => {
  const cwd = makeTempDir();
  const result = createUniverseProject({ name: "Aetheria", cwd });
  const universeMdPath = path.join(result.root, "universe.md");
  const content = fs.readFileSync(universeMdPath, "utf8");
  const broken = content.replace(/name: Aetheria\n/, "");
  fs.writeFileSync(universeMdPath, broken, "utf8");
  const validation = validateUniverse(result.root);
  expect(validation.ok).toBe(false);
  expect(validation.errors.some((e) => e.includes("name"))).toBe(true);
});
```

**Decision**: Add a parallel test that removes `schema-version: 2\n` and asserts `validation.ok === false` + error includes `"schema-version"`. Mirror the existing test's structure.

### W3 — No-op path-safety test

**Current test** (`test/story.test.js:1568-1577`):
```js
test("universe entity files outside universeRoot are refused", () => {
  const cwd = makeTempDir();
  const universeResult = createUniverseProject({ name: "Aetheria", cwd });
  const entities = scanUniverse(universeResult.root);
  expect(entities.characters).toEqual([]);
  expect(entities.locations).toEqual([]);
});
```

**Problem**: The test scans an empty universe and asserts the result is empty. It never creates an out-of-root file or asserts a refusal. The test name promises "refused" but the test body doesn't test refusal.

**Containment model analysis**: `readEntityFiles` (`src/story.js:2759-2775`) enumerates files via `fs.readdirSync(directory, { withFileTypes: true })` inside `characters/`, `locations/`, etc. — it only sees files physically inside those directories. Each file is then read via `readMarkdown` which calls `assertSafeProjectPath` → `assertLexicallyInsideRoot` + `assertSafeProjectParent` + `rejectSymlinkTarget`.

A plain `.md` file placed at a lexically-outside path (e.g., via `../outside.md` naming) is architecturally unreachable by `scanUniverse` without a symlink — `readdirSync` only returns files inside the directory, so `readEntityFiles` can never see an outside file. The real containment protection is exercised by the existing symlink-directory refusal test at lines 1579-1593, which symlinks `characters/` to an outside directory and verifies `scanUniverse` throws.

**Decision**: Replace the no-op test with one that:
1. Creates a real character entity inside `universeRoot/characters/legend.md`
2. Creates a *sibling* directory outside `universeRoot` that mirrors the entity path structure — `cwd/universe-outside-sibling/characters/rogue.md` — so it looks like a real entity candidate `scanUniverse` could have picked up if containment failed
3. Asserts `scanUniverse` returns only the in-root character (`legend`)
4. Asserts `scanUniverse` does NOT return the sibling-outside file (`rogue`)

This makes the test body match its name: the sibling-outside file is effectively "refused" — `scanUniverse` ignores it because `readEntityFiles` only enumerates files inside `universeRoot/characters/`. The symlink directory refusal test (lines 1579-1593) remains the out-of-root *throwing* guard; this test covers the *ignoring* behavior for entity files outside the universe root.

### W4 — Stale AGENTS.md test inventory

**AGENTS.md:240-241** lists:
- `test/cli.test.js`: 8 tests — **actual: 23** across 3 describe blocks
- `test/story.test.js`: 23 tests — **actual: 168** across 9 describe blocks

**story.test.js describe blocks** (168 tests total):
1. `story project operations` — project lifecycle, validation, links, export, build, schema/frontmatter violations, entity CRUD, symlink refusals
2. `universe scaffold` — required paths, frontmatter, registry schemas
3. `universe resolution` — `resolveUniverseRoot` walk-up, story-root resolution
4. `story init universe auto-detection` — `createStoryProject` inside universe writes `universe:` field
5. `universe validation` — frontmatter completeness, schema-version enforcement, cross-level refs, shadowing, name validation
6. `universe scan and report` — `universeScan`, `universeReport`, format output
7. `universe regression` — validate output unchanged without universe, story-root validation
8. `universe path safety` — universeRoot containment, symlinked directory refusal
9. `universe coverage gaps` — empty name, kebab-empty name, non-scalar name, numeric name, kebab-id validation, registry type checks

**cli.test.js describe blocks** (23 tests total):
1. `cli` — arg parsing, help, all commands round-trip, failure paths, fallback binary smoke test
2. `cli universe commands` — `story universe init/scan/validate/report`
3. `cli universe story-root invocation` — universe commands resolve from story root

**Decision**: Update the AGENTS.md Test Files table with current counts and add universe test group descriptions. Also update the workflow-eval.test.js entry if its count is stale.

## Decision Tree
### Q1: How should W3 test the "outside universeRoot" refusal?

**Options**:
- A) Create an entity file at a lexically-outside path via traversal naming (e.g., `../../outside.md`) and assert `scanUniverse` refuses to read it.
- B) Replace the no-op with a sibling-outside-file-is-ignored test: create an in-root `characters/legend.md` plus a sibling `universe-outside-sibling/characters/rogue.md` outside `universeRoot`, assert only `legend` appears in results.

**Analysis**: Option A is architecturally unreachable — `readEntityFiles` uses `readdirSync` to list files inside `characters/`, so a file named via traversal is never enumerated. The only way to get an outside file read through `scanUniverse` is a symlinked directory, already tested at lines 1579-1593. Option B tests the realistic scenario: a sibling directory mirroring the entity path structure (`characters/rogue.md`) that `scanUniverse` would have picked up if containment failed. The file is "refused" in that it's ignored — not present in results.

**Survivor**: B — sibling-outside file is ignored, in-root file is returned. Directly tests the test name's claim.

### Q2: Should W5 test both `name` and `schema-version` removal, or just `schema-version`?

**Options**:
- A) Add only the `schema-version` removal test (name already covered at lines 1200-1209).
- B) Add a single test that removes both and checks both errors.

**Analysis**: Option B would be less precise — if one field's error message changes, the test breaks for the wrong reason. Option A mirrors the existing name-removal test structure, making each scenario independently verifiable.

**Survivor**: A — add only `schema-version` removal test.

### Q3: Should W4 update only the two stale rows, or re-audit the entire table?

**Options**:
- A) Update only `story.test.js` and `cli.test.js` rows.
- B) Re-audit all test files and update all counts.

**Analysis**: The follow-up doc only flagged these two. But a quick audit is cheap — if `workflow-eval.test.js` (listed as 1 test) is still correct, we're done. If not, update it too.

**Survivor**: B — re-audit all rows, update any that are stale.

## Domain Model

```
scanUniverse(universeRoot)
  └─ readEntityFiles(root, "characters", mapper)
       ├─ readdirSync(characters/) → only .md files in this directory
       ├─ assertSafeProjectDirectory(dir, root) → symlink + traversal guard
       └─ readMarkdown(eachFile, root) → assertSafeProjectPath per file

validateUniverse(root)
  ├─ UNIVERSE_REQUIRED_FRONTMATTER loop (name + schema-version)
  ├─ schema-version value check
  ├─ name type check (string, non-empty, kebab-valid)
  └─ cross-level ref checks (gated on storyData.universe)
```

Key invariant: `readEntityFiles` can only read files physically inside entity subdirectories. Lexical-outside files are unreachable without a symlink. The symlink directory refusal (`assertSafeProjectDirectory` → `lstatIfExists` → `isSymbolicLink`) is the primary containment guard for the scan path.

## OpenSpec Capture Summary

### Evidence Checked

- `src/story.js:74` — `UNIVERSE_REQUIRED_FRONTMATTER` constant definition
- `src/story.js:826-829` — frontmatter completeness loop in `validateUniverse`
- `src/story.js:2759-2775` — `readEntityFiles` implementation (readdirSync + per-file assertion)
- `src/story.js:2836-2841` — `assertSafeProjectPath` (lexical + parent + symlink)
- `test/story.test.js:1200-1209` — existing name-removal frontmatter test
- `test/story.test.js:1568-1577` — no-op path-safety test (W3)
- `test/story.test.js:1579-1593` — symlink directory refusal test
- `AGENTS.md:240-241` — stale test inventory rows
- `bun test` run results: `story.test.js` = 168 pass, `cli.test.js` = 23 pass

### Domain Model

- `scanUniverse` reads entity files via `readdirSync` inside `characters/`, `locations/`, `systems/`, `factions/`, `artifacts/` directories — files outside these directories are architecturally unreachable without symlinks.
- `validateUniverse` checks frontmatter completeness via a loop over `UNIVERSE_REQUIRED_FRONTMATTER = ["name", "schema-version"]` — both fields share identical error path.
- Containment guard chain: `assertLexicallyInsideRoot` → `assertSafeProjectParent` (realpath comparison) → `rejectSymlinkTarget` (lstat check).

### Grilling Decision Tree

- **Q1** (W3: how to test outside-universeRoot refusal): Traversal-named outside files are architecturally unreachable — `readdirSync` only sees files inside `characters/`. Ruled out A (mock/duplicate symlink). Surviving option B: sibling-outside entity path mirrored, assert only in-root entity returned.

### Resolved Decisions

1. **W5**: Add a `schema-version` removal test mirroring the existing `name` removal test at lines 1200-1209. Asserts `validation.ok === false` + error includes `"schema-version"`.
2. **W3**: Replace the no-op test body with a sibling-outside-file-is-ignored test — create `characters/legend.md` inside `universeRoot` and `universe-outside-sibling/characters/rogue.md` outside it, assert `scanUniverse` returns only `legend`. The symlink directory refusal test (lines 1579-1593) remains the out-of-root *throwing* guard.
3. **W4**: Re-audit all rows in the AGENTS.md Test Files table, update counts and descriptions for all stale entries.

### Rejected Alternatives

- **W3 Option A** (create lexical-outside file, assert refusal): Rejected — architecturally unreachable without mocking or symlinking. The existing symlink test already covers the real containment guard.
- **W5 Option B** (combined name + schema-version removal): Rejected — less precise, couples two independent error paths in one test.
- **W4 Option A** (update only two rows): Rejected — full audit is cheap and catches any other drift.

### Risks / Trade-offs

- **[Risk] W3 test name accuracy**: The test name "universe entity files outside universeRoot are refused" now matches its body — the sibling-outside `rogue.md` is refused (ignored, not returned). No rename needed.
- **[Trade-off] W3 doesn't test traversal-path refusal directly**: Accepted because `readdirSync` makes it architecturally unreachable without symlinks. The sibling-outside test covers the realistic containment scenario; the symlink test (lines 1579-1593) covers the throwing guard.
- **[Risk] W4 counts go stale again**: AGENTS.md test counts will drift as tests are added. No automated check exists. Accepted — this is a documentation nit, not a code risk.

### Documentation Candidates

- AGENTS.md Test Files table — update `story.test.js` (168 tests, 9 describe blocks) and `cli.test.js` (23 tests, 3 describe blocks) counts and add universe test group descriptions.
- `openspec/follow-up-universe-gaps.md` — mark W3, W4, W5 as resolved after implementation.

### Validated Direction

Close three non-blocking gaps from the epic-worldbuilding verify pass: (1) W5 — add a `schema-version` frontmatter removal test paralleling the existing `name` removal test; (2) W3 — replace the no-op path-safety test with a sibling-outside-file-is-ignored test that creates an in-root `characters/legend.md` and a sibling `characters/rogue.md` outside `universeRoot`, asserting only `legend` is returned; (3) W4 — update the stale AGENTS.md Test Files table with current counts and universe test group descriptions. No source code changes — implementation is already correct for all three gaps; only tests and documentation need updating.
