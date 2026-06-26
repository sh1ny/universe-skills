## Context

The `epic-worldbuilding` change introduced universe-level scaffolding, validation, and scanning. Its `verify.md` surfaced five gaps (W1–W5). The two painful ones (W1: missing `universe:` field in story frontmatter, W2: manuscript cross-level ref validation) were resolved in code. Three non-blocking nits remain:

- **W5** — The `schema-version` frontmatter removal scenario is defined in the spec and implemented identically to the `name` removal scenario, but has no test. The `name`-removal test exists at `test/story.test.js:1200-1209`.
- **W3** — The test named "universe entity files outside universeRoot are refused" (`test/story.test.js:1568-1577`) scans an empty universe and asserts the result is empty. It never creates an out-of-root file, so it tests nothing about refusal.
- **W4** — The AGENTS.md Test Files table lists stale counts: `story.test.js` as 23 tests (actual: 168 across 9 describe blocks), `cli.test.js` as 8 tests (actual: 23 across 3 describe blocks).

All 168 tests pass and coverage is 100%. The implementation for all three gaps is already correct — this change is test and documentation coverage only.

### Containment model

`scanUniverse(universeRoot)` reads entity files via `readEntityFiles`, which calls `fs.readdirSync` inside `characters/`, `locations/`, `systems/`, `factions/`, `artifacts/`. A file outside these directories is architecturally unreachable without a symlink — `readdirSync` only returns entries physically inside the directory. The symlink-directory refusal test (`test/story.test.js:1579-1593`) covers the throwing guard via `assertSafeProjectDirectory` → `lstatIfExists` → `isSymbolicLink`. The containment chain is `assertLexicallyInsideRoot` → `assertSafeProjectParent` (realpath comparison) → `rejectSymlinkTarget` (lstat check).

### Validation model

`validateUniverse(root)` loops over `UNIVERSE_REQUIRED_FRONTMATTER = ["name", "schema-version"]` (`src/story.js:826-829`), pushing `"universe.md missing required frontmatter field: ${field}"` for each missing field. Both fields share an identical error path — the W5 gap is test coverage, not implementation.

## Goals / Non-Goals

**Goals:**

- W5: Add a `schema-version` frontmatter removal test mirroring the existing `name`-removal test, asserting `validation.ok === false` and the error includes `"schema-version"`.
- W3: Replace the no-op path-safety test with a sibling-outside-file-is-ignored test that creates an in-root `characters/legend.md` and a sibling `universe-outside-sibling/characters/rogue.md` outside `universeRoot`, then asserts `scanUniverse` returns only `legend`.
- W4: Re-audit all rows in the AGENTS.md Test Files table and update counts, describe blocks, and descriptions for any stale entries.

**Non-Goals:**

- No source code changes. The implementation is already correct for all three gaps.
- No new test files. W3 and W5 modify `test/story.test.js` in place; W4 updates `AGENTS.md`.
- No schema migrations, no API changes, no new packages.
- Reopening decisions settled in `epic-worldbuilding` (W1, W2 are resolved).

## Decisions

### D1: W3 — Sibling-outside-file-is-ignored test (not traversal-named file refusal)

- **Choice**: Replace the no-op test with a test that creates `characters/legend.md` inside `universeRoot` and `universe-outside-sibling/characters/rogue.md` outside it, then asserts `scanUniverse` returns only `legend`.
- **Rationale**: A file named via traversal (e.g., `../../outside.md`) is architecturally unreachable — `readEntityFiles` uses `readdirSync` to list files inside `characters/`, so it is never enumerated. The only way to get an outside file read through `scanUniverse` is a symlinked directory, already tested at lines 1579-1593. The sibling-outside test covers the realistic containment scenario: a sibling directory mirroring the entity path structure that `scanUniverse` would have picked up if containment failed. The file is "refused" in that it is ignored — not present in results.
- **Alternatives considered**:
  - **A) Create an entity file at a lexically-outside path via traversal naming and assert refusal**: Rejected — architecturally unreachable without mocking or symlinking. `readdirSync` only returns files inside `characters/`, so a traversal-named file is never seen.
  - **B) Mock `readdirSync` to return an outside path**: Rejected — introduces mocking where the real filesystem already proves the containment invariant.

### D2: W5 — Single `schema-version` removal test (not combined with `name`)

- **Choice**: Add only the `schema-version` removal test, paralleling the existing `name`-removal test at lines 1200-1209.
- **Rationale**: The `name` removal scenario is already covered. A combined test that removes both fields and checks both errors would couple two independent error paths — if one field's error message changes, the test breaks for the wrong reason. Mirroring the existing test structure keeps each scenario independently verifiable.
- **Alternatives considered**:
  - **A) Add a single test that removes both `name` and `schema-version` and checks both errors**: Rejected — less precise, couples two independent error paths.

### D3: W4 — Full re-audit of the Test Files table (not just two rows)

- **Choice**: Re-audit all rows in the AGENTS.md Test Files table and update any stale entries.
- **Rationale**: The follow-up doc only flagged `story.test.js` and `cli.test.js`, but a quick audit is cheap and catches any other drift (e.g., `workflow-eval.test.js` count).
- **Alternatives considered**:
  - **A) Update only the two stale rows**: Rejected — full audit catches silent drift in other rows at negligible cost.

## Risks / Trade-offs

- **[Risk] W3 test name accuracy**: The test name "universe entity files outside universeRoot are refused" now matches its body — the sibling-outside `rogue.md` is refused (ignored, not returned). No rename needed.
- **[Trade-off] W3 doesn't test traversal-path refusal directly**: Accepted because `readdirSync` makes it architecturally unreachable without symlinks. The sibling-outside test covers the realistic containment scenario; the symlink test (lines 1579-1593) covers the throwing guard.
- **[Risk] W4 counts go stale again**: AGENTS.md test counts will drift as tests are added. No automated check exists. Accepted — this is a documentation nit, not a code risk.

## Migration Plan

N/A — this change does not involve deployment changes. All modifications are test coverage and documentation accuracy. No source code, no schema migrations, no endpoint or database changes.

### Rollback

Revert the test and documentation commits. No data or state to migrate back.

## Open Questions

None. All three gaps have settled decisions from brainstorm.md, and the proposal confirms scope with no blocking TBDs.
