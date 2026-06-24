## ADDED Requirements

### Requirement: Universe container initialization

The system SHALL provide a `story universe init <name>` command that creates a `universe.md` file with YAML frontmatter and a directory structure for shared entities in the current working directory.

#### Scenario: Initialize a new universe
- **WHEN** a user runs `story universe init my-epic-universe`
- **THEN** the system creates `universe.md` with frontmatter fields `name: "My Epic Universe"`, `schema-version: 2`, `genre`, `tone`, `themes`, and a body with sections for cosmological overview, universe history summary, and notes
- **AND** the system creates subdirectories for shared-worldbuilding entity types only: `characters/`, `worldbuilding/locations/`, `worldbuilding/systems/`, `worldbuilding/factions/`, `worldbuilding/artifacts/`
- **AND** each domain receives a grouped `_index.md` registry file matching the story-level `INDEX_SCHEMAS` layout (e.g., `worldbuilding/_index.md` holds Locations, Systems, Factions, and Artifacts tables in one file)

#### Scenario: Initialize inside existing universe directory
- **WHEN** a user runs `story universe init` in a directory that already contains `universe.md`
- **THEN** the system throws an error indicating the universe already exists

---

### Requirement: Universe is opt-in and additive

The system MUST NOT alter the behavior of any existing command when no `universe.md` is present in the directory hierarchy. The universe container is purely opt-in — existing single-story projects continue to function identically.

#### Scenario: Existing project without universe
- **WHEN** `scanProject` is called on a story project whose `story.md` has no `universe` frontmatter field
- **THEN** the scan result is identical to the current behavior — no universe scanning occurs, `project.universe` is absent or null, and all existing consumers behave as before

#### Scenario: Existing project validation unchanged
- **WHEN** `story validate` is run on a single-story project with no universe
- **THEN** validation output and exit code are identical to current behavior

---

### Requirement: Story opt-in via universe frontmatter field

The system SHALL recognize a `universe` field in `story.md` frontmatter containing a kebab-case universe id. When present, the CLI resolves the universe by walking up from the story root directory to find `universe.md`. If the universe cannot be resolved, the system emits a warning but does not treat it as an error — the story remains functional in standalone mode.

#### Scenario: Story with valid universe reference
- **WHEN** `story.md` contains `universe: my-epic-universe` and a `universe.md` exists in an ancestor directory
- **THEN** `scanProject` resolves the universe root and scans universe-level entities into `project.universe`

#### Scenario: Story with unresolvable universe reference
- **WHEN** `story.md` contains `universe: my-epic-universe` but no `universe.md` is found in any ancestor directory
- **THEN** `story universe validate` emits a warning: "Universe 'my-epic-universe' not found — story works in standalone mode"
- **AND** no error is raised; the story's own entities scan normally

#### Scenario: Story with no universe field
- **WHEN** `story.md` has no `universe` frontmatter field
- **THEN** no universe scanning occurs and `project.universe` is absent from the snapshot

---

### Requirement: Universe auto-detection during story init

The `story init` command SHALL walk up from the target directory to detect a `universe.md` file. If found, the system writes the `universe` field (kebab-case id from `universe.md` frontmatter) into the new `story.md` automatically. No explicit flag is required.

#### Scenario: Story init inside a universe directory
- **WHEN** a user runs `story init "Fall of Empires"` in a subdirectory of a universe (e.g., `universe-name/stories/fall-of-empires/`)
- **THEN** the created `story.md` includes `universe: <universe-name-id>` in its frontmatter

#### Scenario: Story init outside any universe
- **WHEN** a user runs `story init "Standalone Tale"` in a directory with no `universe.md` in any ancestor
- **THEN** the created `story.md` has no `universe` field, identical to current behavior

---

### Requirement: Universe entity scanning with path-safety isolation

The system SHALL scan universe-level entity directories using the existing `readEntityFiles` pattern, but MUST pass the universe directory as the root argument to `readEntityFiles`/`readMarkdown`/`assertLexicallyInsideRoot`. The story root MUST NOT be used as the root for universe file paths, because the universe directory is an ancestor of the story root and universe paths are lexically outside `storyRoot`.

#### Scenario: Universe entities scanned with universe root
- **WHEN** `scanProject` resolves a universe directory and scans `universe-root/characters/`, `universe-root/worldbuilding/`, etc.
- **THEN** each `readEntityFiles` call receives the universe root path as its root argument
- **AND** `assertLexicallyInsideRoot` validates universe entity paths against the universe root, not the story root

#### Scenario: Universe directory absent
- **WHEN** `story.md` has no `universe` field or the universe cannot be resolved
- **THEN** no universe scanning occurs and `project.universeRoot` is absent

---

### Requirement: Snapshot isolation for universe entities

The system SHALL store universe-level entities in a separate `project.universe` object (with its own `characters`, `locations`, `systems`, `factions`, `artifacts` arrays) and a `project.universeRoot` path. Universe entities MUST NOT be merged into the top-level `project.characters`/`project.locations`/etc. arrays. Existing consumers (`reindexProject`, `computeWordCounts`, `exportManuscript`, `formatProjectReport`) MUST continue to operate on story-level arrays only without modification.

#### Scenario: Universe entities in separate snapshot field
- **WHEN** `scanProject` scans a story with a resolved universe containing 5 characters and 3 locations
- **THEN** `project.universe.characters` contains 5 entries and `project.universe.locations` contains 3 entries
- **AND** `project.characters` contains only story-level characters and `project.locations` contains only story-level locations

#### Scenario: Reindex does not touch universe entities
- **WHEN** `reindexProject` is run on a story within a universe
- **THEN** only story-level `_index.md` files are written; universe-level `_index.md` files are not modified

#### Scenario: Cross-level reference resolution uses transient combined map
- **WHEN** cross-level link validation needs to resolve whether an entity id exists at either level
- **THEN** the validator builds a transient combined map at validation time without mutating the snapshot's story or universe arrays

---

### Requirement: Compact universe scan reporting

The `story universe scan` command SHALL output a compact registry of all universe-level entities. Each entry includes entity id, name, type, and file path — no body content. This bounds LLM context while maintaining completeness.

#### Scenario: Universe scan output format
- **WHEN** a user runs `story universe scan` on a universe with characters, locations, and factions
- **THEN** the output lists each entity as one line with: id, name, type, file path
- **AND** no entity body content is included in the output

#### Scenario: Universe scan on empty universe
- **WHEN** a user runs `story universe scan` on a universe with no entity files (only `_index.md` registries)
- **THEN** the output reports zero entities found

---

### Requirement: Universe validation — cross-level reference resolution

The `story universe validate` command SHALL validate that every cross-level reference from a story entity to a universe-level entity resolves to an existing file. Story-level entities take precedence in resolution; if an id is found at the story level, the universe level is not consulted for that id. Cross-level reference validation MUST be existence-only — the system SHALL NOT require universe-level entities to backlink to story-level entities. This differs from same-level `validateLinks`, which enforces bidirectional backlinks (e.g., `character.locations` ↔ `location.notable-characters`); cross-level checks skip backlink enforcement because universe entities are referenced by many stories and MUST NOT carry per-story backlink entries.

#### Scenario: Valid cross-level reference
- **WHEN** a story character has `locations: [sacred-mountain]` and `sacred-mountain` exists as a universe-level location file but not at the story level
- **THEN** validation resolves the reference against the universe level and passes with no error

#### Scenario: Broken cross-level reference
- **WHEN** a story character has `locations: [sacred-mountain]` but no `sacred-mountain` entity file exists at either story or universe level
- **THEN** validation reports an error: "Cross-level reference 'locations: sacred-mountain' does not resolve at story or universe level"

---

### Requirement: Universe validation — entity id uniqueness and no shadowing

The `story universe validate` command SHALL validate that universe-level entity ids are kebab-case and unique within their entity type. The system MUST also validate that no entity id exists at both story and universe level for the same entity type (no id shadowing).

#### Scenario: Duplicate universe entity ids
- **WHEN** two universe-level character files both have id `the-old-gods`
- **THEN** validation reports an error: "Duplicate entity id 'the-old-gods' in universe characters"

#### Scenario: Non-kebab-case universe entity id
- **WHEN** a universe-level entity file has an id with uppercase or spaces
- **THEN** validation reports an error: "Universe entity id must be kebab-case"

#### Scenario: Id shadowing between levels
- **WHEN** a story has a character with id `mara-quill` and the universe also has a character with id `mara-quill`
- **THEN** validation reports an error: "Entity id 'mara-quill' exists at both story and universe level — shadowing is not allowed"

---

### Requirement: Universe validation — frontmatter completeness

The `story universe validate` command SHALL validate that `universe.md` contains required frontmatter fields: `name` and `schema-version`. Missing fields are reported as errors.

#### Scenario: Universe with complete frontmatter
- **WHEN** `universe.md` has `name: "My Epic Universe"` and `schema-version: 2`
- **THEN** validation passes for frontmatter checks

#### Scenario: Universe missing required frontmatter
- **WHEN** `universe.md` is missing the `name` field
- **THEN** validation reports an error: "universe.md missing required frontmatter field: name"

#### Scenario: Universe missing schema-version
- **WHEN** `universe.md` is missing the `schema-version` field
- **THEN** validation reports an error: "universe.md missing required frontmatter field: schema-version"

---

### Requirement: Universe report command

The `story universe report` command SHALL output a full inventory summary of the universe, including entity counts by type, total entity count, and any validation issues detected.

#### Scenario: Universe report output
- **WHEN** a user runs `story universe report` on a universe with 10 characters, 5 locations, 3 factions
- **THEN** the output includes entity counts per type and a total count
- **AND** any validation issues are appended to the report

#### Scenario: Universe report on empty universe
- **WHEN** a user runs `story universe report` on a freshly initialized universe with no entities
- **THEN** the output reports zero entities for each type

---

### Requirement: Universe-management skill

The system SHALL include a new `skills/universe-management/SKILL.md` skill with YAML frontmatter (`name`, `description`) that guides agents through: universe initialization, adding shared entities at the universe level, cross-level referencing from stories to universe entities, and level-selection guidance (when to place an entity at universe vs. story level).

#### Scenario: Agent initializes a universe
- **WHEN** an agent following the `universe-management` skill creates a new universe
- **THEN** the skill instructs the agent to run `story universe init <name>` and then guides entity creation in the appropriate universe directories

#### Scenario: Agent decides entity level
- **WHEN** an agent is creating a character that appears in multiple stories
- **THEN** the skill instructs the agent to place the character at the universe level in `universe-root/characters/`

---

### Requirement: Existing skill updates for universe awareness

The system SHALL update three existing skills with universe-level awareness:

1. `story-init/SKILL.md` — mentions auto-detection of `universe.md` during `story init`
2. `worldbuilding/SKILL.md` — adds guidance on when to place locations, systems, factions, and artifacts at the universe level vs. story level
3. `character-management/SKILL.md` — adds guidance on universe-level characters (legends, immortals, gods that span multiple stories)

#### Scenario: Story-init skill references universe auto-detection
- **WHEN** an agent reads `story-init/SKILL.md`
- **THEN** the skill describes that `story init` auto-detects `universe.md` by walking up the directory tree and writes the `universe` field into `story.md` when found

#### Scenario: Worldbuilding skill references universe level
- **WHEN** an agent reads `worldbuilding/SKILL.md`
- **THEN** the skill includes guidance on when a location, system, faction, or artifact should be placed at the universe level

#### Scenario: Character-management skill references universe level
- **WHEN** an agent reads `character-management/SKILL.md`
- **THEN** the skill includes guidance on when a character (legend, immortal, god) should be placed at the universe level
