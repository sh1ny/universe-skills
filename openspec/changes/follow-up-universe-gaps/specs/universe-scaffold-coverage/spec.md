## ADDED Requirements

### Requirement: Schema-Version Frontmatter Removal Test

The test suite MUST include a scenario that removes `schema-version` from `universe.md` frontmatter and asserts that `validateUniverse` returns `ok === false` with an error message containing `schema-version`. This test SHALL parallel the existing `name`-field removal test structure, exercising the identical error path shared by both required frontmatter fields in `UNIVERSE_REQUIRED_FRONTMATTER`.

#### Scenario: schema-version removed from universe.md

- **WHEN** the `schema-version: 2` line is removed from `universe.md` frontmatter and `validateUniverse` is called
- **THEN** the result MUST have `ok === false` and an error containing the substring `schema-version`

#### Scenario: schema-version removal test is independent of name removal test

- **WHEN** the `schema-version` removal test runs alongside the existing `name` removal test
- **THEN** each test SHALL remove only one field from `universe.md`, so that a change to one field's error message or validation logic does not break the other test

---

### Requirement: Universe Path-Safety Sibling Containment Test

The test suite MUST include a scenario that verifies `scanUniverse` ignores entity files located in a sibling directory outside `universeRoot`. The test SHALL create a legitimate entity file inside `universeRoot` and a sibling entity file outside it, then assert that only the in-root file appears in scan results. This test SHALL replace the existing no-op test that scans an empty universe and asserts the result is empty without ever creating an out-of-root file.

#### Scenario: entity file in sibling directory outside universeRoot is ignored

- **WHEN** `characters/legend.md` exists inside `universeRoot` and `characters/rogue.md` exists inside a sibling directory (`universe-outside-sibling/`) outside `universeRoot`
- **THEN** `scanUniverse(universeRoot)` MUST return exactly one character (`legend`) and MUST NOT include `rogue`

#### Scenario: no-op test is removed

- **WHEN** the test suite is inspected after this change
- **THEN** the test that scans an empty universe and asserts an empty result without creating any out-of-root file MUST no longer be present

---

### Requirement: AGENTS.md Test Inventory Accuracy

The Test Files table in `AGENTS.md` MUST reflect the actual current test counts, describe-block groupings, and coverage descriptions for every `*.test.js` file in the `test/` directory. Each `*.test.js` row's test count SHALL match the real count obtained from running the test suite, and universe-related test groups SHALL be described where they exist. Non-test rows (e.g., `test/helpers.js`) SHALL document their role as shared utilities without a test count.

#### Scenario: test counts match actual suite

- **WHEN** the Test Files table in `AGENTS.md` is compared against the actual test suite
- **THEN** every `*.test.js` row's test count MUST equal the count reported by `bun test`, and the "What It Covers" column MUST accurately describe the test groups including any universe-related describe blocks. Non-test rows (e.g., `test/helpers.js`) SHALL document their role as shared utilities without a test count.

#### Scenario: full table audit, not partial

- **WHEN** the Test Files table is updated
- **THEN** all rows SHALL be audited — not only the two rows (`story.test.js`, `cli.test.js`) previously flagged as stale — so that silent drift in other rows (e.g., `workflow-eval.test.js`) is caught
