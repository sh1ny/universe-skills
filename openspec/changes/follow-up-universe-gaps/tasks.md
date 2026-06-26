## 1. Schema-Version Frontmatter Removal Test (W5)

- [x] 1.1 Add a test in the `universe validation` group of `test/story.test.js` that removes the `schema-version: 2\n` line from `universe.md` frontmatter and asserts `validateUniverse` returns `ok === false` with an error containing `schema-version`
- [x] 1.2 Verify the new test removes only `schema-version` (not `name`) so it is independent from the existing name-removal test at lines 1200-1209

## 2. Universe Path-Safety Sibling Containment Test (W3)

- [x] 2.1 Replace the no-op test at `test/story.test.js:1568-1577` ("universe entity files outside universeRoot are refused") with a sibling-outside-file-is-ignored test
- [x] 2.2 In the replacement test body, create `characters/legend.md` inside `universeRoot` and `universe-outside-sibling/characters/rogue.md` outside `universeRoot`
- [x] 2.3 Assert `scanUniverse(universeRoot)` returns exactly one character (`legend`) and does not include `rogue`

## 3. AGENTS.md Test Inventory Accuracy (W4)

- [x] 3.1 Run `bun test` to obtain actual test counts for every `*.test.js` file
- [x] 3.2 Update the AGENTS.md Test Files table using the post-change counts obtained in 3.1 — `story.test.js` will be 169 tests across 9 describe blocks (168 + 1 new W5 test), `cli.test.js` remains 23 tests across 3 describe blocks; audit all other rows for drift
- [x] 3.3 Add universe test group descriptions to the "What It Covers" column for `story.test.js` and `cli.test.js`

## 4. Verification

- [x] 4.1 Run `bun run test` — confirm all tests pass including the new and modified tests
- [x] 4.2 Run `bun run test:coverage` — confirm 100% coverage maintained and fallback check passes
- [x] 4.3 Mark W3, W4, W5 as resolved in `openspec/follow-up-universe-gaps.md`
