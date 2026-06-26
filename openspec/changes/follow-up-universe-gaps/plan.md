# Follow-Up Universe Scaffold Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three non-blocking gaps from the epic-worldbuilding verify pass — add the missing `schema-version` frontmatter removal test (W5), replace the no-op path-safety test with a sibling-outside-file-is-ignored test (W3), and refresh the stale AGENTS.md Test Files table (W4).

**Architecture:** No source code changes — the implementation is already correct for all three gaps. Two tasks modify `test/story.test.js` in place (W5 adds a test, W3 replaces a test body). One task updates the `AGENTS.md` Test Files table with current counts and universe test group descriptions. A final task runs the full verification suite and marks W3/W4/W5 resolved in the follow-up doc.

**Tech Stack:** Bun test runner (`bun:test`), plain JavaScript ESM, no external dependencies.

## Global Constraints

- **No source code changes** — `src/*.js` is frozen. All three gaps are test/docs-only.
- **No new test files** — W3 and W5 modify `test/story.test.js` in place; W4 modifies `AGENTS.md`.
- **Test isolation** — each test uses `makeTempDir()` for parallel-safe filesystem isolation; no `beforeEach`/`afterAll` hooks.
- **Coverage gate** — 100% line + function coverage on every `src/*.js` file, enforced by `scripts/check-coverage.js`. Since no `src/` changes are made, coverage must remain at 100% (adding tests can only maintain or increase coverage).
- **Fallback bundle** — since `src/` is not modified, `bun run build:fallback` and `bun run check:fallback` are NOT required for this change (no source changes to bundle).
- **Commit message convention** — `feat:` for new test, `test:` for test body replacement, `docs:` for AGENTS.md updates.

---

## Task 1: W5 — Add `schema-version` Frontmatter Removal Test

**Files:**
- Modify: `test/story.test.js:1210-1211` (insert new test after the existing `name`-removal test at lines 1200-1209, before the `cross-level reference` test at line 1212)

**Interfaces:**
- Consumes: `validateUniverse(root)` from `src/story.js`, `createUniverseProject({name, cwd})` from `src/story.js`, `makeTempDir()` from `test/helpers.js`
- Produces: a new test that increases `story.test.js` count from 168 → 169

**Context:** The `validateUniverse` function at `src/story.js:826-829` loops over `UNIVERSE_REQUIRED_FRONTMATTER = ["name", "schema-version"]` (defined at `src/story.js:74`), pushing `"universe.md missing required frontmatter field: ${field}"` for each missing field. The existing `name`-removal test at lines 1200-1209 removes `name: Aetheria\n` and asserts `validation.ok === false` + error includes `"name"`. The W5 test mirrors this for `schema-version`.

The `createUniverseProject` function (`src/story.js:181-246`) writes `universe.md` via `universeBible()` (`src/story.js:1719-1740`), which calls `stringifyFrontmatter({ name, "schema-version": STORY_SCHEMA_VERSION, ... })`. `stringifyFrontmatter` (`src/frontmatter.js:16-46`) emits `schema-version: 2\n` (number formatted via `formatScalar` → `String(2)` = `"2"`). So the regex to remove the line is `/schema-version: 2\n/`.

- [ ] **Step 1: Write the failing test**

Insert this test immediately after line 1209 (the closing `});` of the `name`-removal test), before line 1210 (the blank line before `cross-level reference` test):

```js

  test("validates universe.md schema-version frontmatter", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    const universeMdPath = path.join(result.root, "universe.md");
    const content = fs.readFileSync(universeMdPath, "utf8");
    const broken = content.replace(/schema-version: 2\n/, "");
    fs.writeFileSync(universeMdPath, broken, "utf8");
    const validation = validateUniverse(result.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("schema-version"))).toBe(true);
  });
```

This mirrors the existing `name`-removal test structure exactly — same setup, same assertion shape, different field. It removes ONLY `schema-version` (not `name`), keeping it independent from the existing test.

- [ ] **Step 2: Run the test to verify it passes**

Run: `bun test test/story.test.js --test-name-pattern "schema-version frontmatter"`
Expected: PASS (1 test)

The test should pass immediately because the implementation at `src/story.js:826-829` already handles `schema-version` removal — the loop pushes the error for any missing field in `UNIVERSE_REQUIRED_FRONTMATTER`.

- [ ] **Step 3: Verify test count increased**

Run: `bun test test/story.test.js 2>&1 | tail -5`
Expected: 169 passed (was 168)

- [ ] **Step 4: Commit**

```bash
git add test/story.test.js
git commit -m "test: add schema-version frontmatter removal test (W5)"
```

---

## Task 2: W3 — Replace No-Op Path-Safety Test with Sibling-Outside-File-Ignored Test

**Files:**
- Modify: `test/story.test.js:1568-1577` (replace the no-op test body)

**Interfaces:**
- Consumes: `scanUniverse(universeRoot)` from `src/story.js`, `createUniverseProject({name, cwd})` from `src/story.js`, `makeTempDir()` from `test/helpers.js`, `writeMarkdown(path, frontmatter, body)` from `test/helpers.js`
- Produces: a corrected test that actually verifies containment (test count unchanged — replacement, not addition)

**Context:** The current test at lines 1568-1577 is named `"universe entity files outside universeRoot are refused"` but its body scans an empty universe and asserts `entities.characters.toEqual([])` — it never creates an out-of-root file, so it tests nothing about refusal.

`scanUniverse(universeRoot)` (`src/story.js:406-452`) calls `readEntityFiles(root, "characters", ...)` which uses `fs.readdirSync(directory, { withFileTypes: true })` inside `characters/` (`src/story.js:2759-2775`). Only files physically inside that directory are enumerated. A sibling directory outside `universeRoot` with the same path structure (`characters/rogue.md`) would NOT be picked up — `readdirSync` only lists entries inside `universeRoot/characters/`.

**Critical path detail:** `createUniverseProject({ name, cwd })` sets `root = path.resolve(cwd, ".")` — so `result.root === cwd`. The universe IS the cwd directory. To create a sibling OUTSIDE the universe root, use `path.join(path.dirname(result.root), path.basename(result.root) + "-outside-sibling")`. This mirrors the existing symlink test at line 1587: `path.join(path.dirname(cwd), `${path.basename(cwd)}-outside-characters`)`.

- [ ] **Step 1: Replace the no-op test body**

Replace lines 1568-1577 (the entire test from `test("universe entity files outside universeRoot are refused", () => {` through its closing `});`) with:

```js
  test("universe entity files outside universeRoot are refused", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    // Create a legitimate character inside universeRoot
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: Legend
role: protagonist
status: alive
`, "# Legend\n");
    // Create a sibling directory outside universeRoot that mirrors the entity path
    const siblingDir = path.join(path.dirname(universeResult.root), `${path.basename(universeResult.root)}-outside-sibling`);
    writeMarkdown(path.join(siblingDir, "characters", "rogue.md"), `
name: Rogue
role: antagonist
status: alive
`, "# Rogue\n");
    // scanUniverse only reads files inside universeRoot/characters/ — rogue must be ignored
    const entities = scanUniverse(universeResult.root);
    expect(entities.characters).toHaveLength(1);
    expect(entities.characters[0].id).toBe("legend");
    expect(entities.characters.find((c) => c.id === "rogue")).toBeUndefined();
  });
```

The test name stays the same ("universe entity files outside universeRoot are refused") — the sibling-outside `rogue.md` is "refused" in that it's ignored, not present in results. This matches the design decision D1 in `design.md`.

- [ ] **Step 2: Run the test to verify it passes**

Run: `bun test test/story.test.js --test-name-pattern "outside universeRoot are refused"`
Expected: PASS (1 test)

- [ ] **Step 3: Verify test count unchanged**

Run: `bun test test/story.test.js 2>&1 | tail -5`
Expected: 169 passed (same as after Task 1 — this was a replacement, not an addition)

- [ ] **Step 4: Commit**

```bash
git add test/story.test.js
git commit -m "test: replace no-op path-safety test with sibling-outside-file-is-ignored test (W3)"
```

---

## Task 3: W4 — Update AGENTS.md Test Files Table

**Files:**
- Modify: `AGENTS.md:238-247` (Test Files table rows)

**Interfaces:**
- Consumes: actual test counts from `bun test` output
- Produces: accurate Test Files table reflecting current test suite

**Context:** The Test Files table at `AGENTS.md:238-247` currently lists:
- `test/cli.test.js`: 8 tests — **actual: 23** across 3 describe blocks
- `test/story.test.js`: 23 tests — **actual: 169** (after Task 1) across 9 describe blocks

Full re-audit (decision D3 in `design.md`): check all rows, not just the two flagged ones.

Actual test counts (209 total after Task 1 — W5 adds 1 to the baseline 208):
| File | Tests | Describe blocks |
|------|-------|-----------------|
| `test/cli.test.js` | 23 | 3: `cli`, `cli universe commands`, `cli universe story-root invocation` |
| `test/story.test.js` | 169 | 9: `story project operations`, `universe scaffold`, `universe resolution`, `story init universe auto-detection`, `universe validation`, `universe scan and report`, `universe regression`, `universe path safety`, `universe coverage gaps` |
| `test/frontmatter.test.js` | 6 | (unchanged — verify) |
| `test/import.test.js` | 4 | (unchanged — verify) |
| `test/continuity.test.js` | 3 | (unchanged — verify) |
| `test/markdown.test.js` | 3 | (unchanged — verify) |
| `test/workflow-eval.test.js` | 1 | (unchanged — verify) |

- [ ] **Step 1: Run `bun test` to confirm exact counts**

Run: `bun test 2>&1 | tail -5`
Expected: 209 passed (208 + 1 from Task 1's W5 test)

Record the actual total. If it differs from 209, use the actual number.

- [ ] **Step 2: Update the Test Files table in AGENTS.md**

Replace lines 240-241 (the `cli.test.js` and `story.test.js` rows) with:

```markdown
| `test/cli.test.js` | 23 | CLI surface: arg parsing, help, all commands round-trip, failure paths, fallback binary smoke test; universe commands (init/scan/validate/report) and story-root invocation |
| `test/story.test.js` | 169 | Project lifecycle: create/scan/reindex/validate/links/export/build, schema/frontmatter contract violations, entity CRUD, symlink traversal refusals, epub/docx binary builds; universe scaffold, resolution, validation, scan/report, regression, path safety, coverage gaps |
```

Audit the remaining rows — if `frontmatter.test.js` (6), `import.test.js` (4), `continuity.test.js` (3), `markdown.test.js` (3), `workflow-eval.test.js` (1) still match, no changes needed. If any differ, update them.

- [ ] **Step 3: Verify the table renders correctly**

Read `AGENTS.md:238-247` to confirm the table is well-formed and counts are accurate.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update Test Files table with current counts and universe test groups (W4)"
```

---

## Task 4: Verification and Resolution Marking

**Files:**
- Modify: `openspec/follow-up-universe-gaps.md` (mark W3, W4, W5 as resolved)

**Interfaces:**
- Consumes: completed Tasks 1-3
- Produces: all quality gates green, follow-up doc updated

- [ ] **Step 1: Run full test suite**

Run: `bun run test`
Expected: all tests pass (209 passed)

- [ ] **Step 2: Run coverage gate**

Run: `bun run test:coverage`
Expected: 100% coverage maintained, fallback check passes

Note: since no `src/` files were modified, the fallback bundle is unchanged and `check:fallback` should pass without running `build:fallback`.

- [ ] **Step 3: Mark W3, W4, W5 as resolved in the follow-up doc**

Update `openspec/follow-up-universe-gaps.md` to mark W3, W4, W5 as resolved. Add a note referencing the commits that closed each gap.

- [ ] **Step 4: Commit**

```bash
git add openspec/follow-up-universe-gaps.md
git commit -m "docs: mark W3, W4, W5 as resolved in follow-up doc"
```

- [ ] **Step 5: Final verification**

Run: `bun run test && bun run test:coverage`
Expected: all tests pass, 100% coverage maintained
