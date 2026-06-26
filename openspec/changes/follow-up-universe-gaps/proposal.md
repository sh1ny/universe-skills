# Proposal: Follow-Up Universe Scaffold Gaps

## Why

The `epic-worldbuilding` change introduced universe-level scaffolding, validation, and scanning. Its `verify.md` surfaced five gaps (W1–W5); the two painful ones (W1, W2) were resolved in code. Three non-blocking nits remain: W5 (missing `schema-version` frontmatter removal test), W3 (no-op path-safety test that doesn't actually test refusal), and W4 (stale AGENTS.md test inventory). All 168 tests pass and coverage is 100%, so these are quality nits — but leaving them erodes confidence in the universe validation test surface and documentation accuracy.

## What Changes

1. **W5 — Add `schema-version` frontmatter removal test**: A new test paralleling the existing `name`-removal test (`test/story.test.js:1200-1209`) that removes `schema-version: 2\n` from `universe.md` and asserts `validation.ok === false` with an error mentioning `schema-version`. The implementation at `src/story.js:826-829` already handles both fields identically; this is test coverage only.

2. **W3 — Replace no-op path-safety test**: The existing test (`test/story.test.js:1568-1577`) scans an empty universe and asserts the result is empty — it never creates an out-of-root file. Replace it with a sibling-outside-file-is-ignored test: create `characters/legend.md` inside `universeRoot` and `universe-outside-sibling/characters/rogue.md` outside it, then assert `scanUniverse` returns only `legend`. The symlink directory refusal test (lines 1579-1593) remains the throwing guard.

3. **W4 — Update stale AGENTS.md test inventory**: Re-audit the Test Files table in `AGENTS.md`. Current staleness: `test/story.test.js` listed as 23 tests (actual: 168 across 9 describe blocks), `test/cli.test.js` listed as 8 tests (actual: 23 across 3 describe blocks). Update counts, add universe test group descriptions, and verify `workflow-eval.test.js` count.

## Capabilities

### New Capabilities

- **`universe-scaffold-coverage`**: Test and documentation coverage for universe scaffold validation and containment. Encompasses the `schema-version` frontmatter removal test (W5), the path-safety sibling-outside-file-is-ignored test (W3), and the AGENTS.md test inventory refresh (W4).

### Modified Capabilities

_None_ — no existing specs are being changed (the `openspec/specs/` directory is currently empty).

## Impact

- **Test files**: `test/story.test.js` — two test modifications (W3 replace, W5 add). No new test files.
- **Documentation**: `AGENTS.md` — Test Files table updated with current counts and universe test group descriptions.
- **Source code**: No changes. All three gaps are test/docs-only; the implementation is already correct.
- **Dependencies**: None. No new packages, no API changes, no schema migrations.
- **Risk**: Low. All changes are additive test coverage and documentation accuracy. The W3 replacement test changes a test body but not its assertion intent (still verifying out-of-root entity files are refused/ignored).
