## Why

Story Skills currently scaffolds single-story projects only. Writers building epic-scale universes (Warhammer-40k scope) need a shared worldbuilding layer above individual stories — legendary characters, sacred locations, and factions that span multiple tales. Without it, every story duplicates shared entities, cross-story references are impossible to validate, and there is no container for universe-level lore. This change introduces the universe scaffold as the foundation that six future sub-projects (eras, races, series, timeline continuity, lore generation, story generator) build on.

## What Changes

**Universe container**
- From: Projects are flat — `story.md` at the root, no parent container.
- To: An optional `universe.md` with frontmatter (`name`, `schema-version`, `genre`, `tone`, `themes`) lives in a parent directory above one or more story projects. Shared worldbuilding entities live alongside it.
- Reason: Provides a shared worldbuilding layer without breaking existing single-story projects.
- Impact: Non-breaking — universe is opt-in; projects without it are unchanged.

**Story opt-in**
- From: `story.md` frontmatter has no universe linkage.
- To: `story.md` gains a `universe` field (kebab-case id). `story init` auto-detects `universe.md` by walking up the directory tree and writes the field automatically. Missing universe = warning, not error.
- Reason: Zero-friction opt-in; stories degrade gracefully if universe is absent.
- Impact: Non-breaking — field is optional.

**Cross-level entity resolution**
- From: `scanProject` reads entities from one story root only.
- To: When a story references `universe: <id>`, the CLI resolves the universe directory and scans its shared entities using the existing `readEntityFiles` pattern (full directory scan, compact reporting). Story-level entities take precedence; universe-level entities fill gaps.
- Reason: Enables cross-story shared entities without duplicating them per story.
- Impact: Non-breaking — if `universe` field is absent, behavior is identical to today.

**Validation**
- From: `story validate` and `story links` check references within one story.
- To: `story universe validate` checks cross-level references (story entity → universe entity exists), id uniqueness within entity type, no id shadowing between story and universe levels, and `universe.md` frontmatter completeness. Missing universe resolution is a warning; broken cross-level references are errors.
- Reason: Cross-level reference validation is the core value of the scaffold — without it, broken links go undetected.
- Impact: Non-breaking — new command, existing validation unchanged.

**CLI command group**
- From: No universe-level commands.
- To: Separate `story universe` command group: `init` (scaffold universe + `_index.md` files mirroring `INDEX_SCHEMAS`), `scan` (compact entity registry), `validate` (cross-level checks), `report` (full inventory).
- Reason: Clean separation from story-level commands; discoverable, mirrors existing structure.
- Impact: Non-breaking — purely additive.

**Skills**
- From: No skill mentions universe-level entities or commands.
- To: New `universe-management` skill guides agents through universe init, shared entity creation, cross-level referencing, and level-selection guidance. Existing `story-init`, `worldbuilding`, and `character-management` skills gain universe-level awareness sections.
- Reason: Agents need guidance to use the new commands and decide entity placement.
- Impact: Non-breaking — new and updated skill content only.

## Capabilities

### New Capabilities

- `universe-scaffold`: Opt-in universe container above story projects — universe.md frontmatter and directory structure, story opt-in via auto-detected frontmatter field, cross-level entity resolution via scanProject extension, `story universe` command group (init/scan/validate/report), validation rules for cross-level references and id uniqueness, and `universe-management` skill plus updates to three existing skills.

### Modified Capabilities

_(none — no existing specs to modify)_

## Impact

- **`src/story.js`**: `scanProject` extended to optionally scan universe directory; new `universe-init`, `universe-scan`, `universe-validate`, `universe-report` functions; `createStoryProject` updated for auto-detection of `universe.md`; `entityConfig` unchanged (no new entity types).
- **`src/cli.js`**: New `universe` command group dispatch (init, scan, validate, report); updated HELP text.
- **`src/continuity.js`**: No changes — continuity remains story-level for this sub-project.
- **`skills/`**: New `universe-management/SKILL.md`; updates to `story-init/SKILL.md`, `worldbuilding/SKILL.md`, `character-management/SKILL.md`.
- **`AGENTS.md`**: New CLI command mapping entries, new skill in inventory, architecture diagram update.
- **No new dependencies** — pure synchronous ESM, no external packages.
- **No breaking changes** — universe is opt-in; all existing commands and projects behave identically when no universe is present.
