<!--
Raw capture of superpowers:brainstorming output.

This file captures the brainstorming skill output verbatim, without enforcing structure.
The skill's natural output is typically a decision log format (background → decision chain Q1-Qn → design trade-offs),
but the organization may vary depending on the conversation.

design.md extracts and reorganizes this file into a structured design document.

Do not copy this file's content into design.md — design.md is an independent reorganization;
the two complement each other but do not overlap.

An OpenSpec Capture Summary footer (below) distills the raw capture into
structured subsections for downstream templates to reference.
-->

# Brainstorm: Epic Worldbuilding — Universe Scaffold

## Background

The user wants to scale Story Skills from a single-story scaffolding tool into a
real worldbuilding platform capable of Warhammer-40k-scale universe creation.
Their vision spans 7 subsystems: universe container, era & timeline system,
races/cosmology/pantheons, series & epic structure, timeline-aware continuity,
lore text generation, and a story generator.

This brainstorm covers the **first sub-project: the universe scaffold** — the
foundation everything else builds on. The remaining 6 subsystems are deferred
to future change cycles, each with its own spec → plan → implementation.

## Decomposition

The full vision decomposes into 7 independent sub-projects:

1. **Universe scaffold** (this brainstorm) — top-level container, cross-reference resolution
2. **Era & timeline system** — new `era` and `timeline-event` entities, temporal positioning
3. **Races, cosmology & pantheons** — new entity types for species-level worldbuilding
4. **Series & epic structure** — group stories into ordered collections
5. **Timeline-aware continuity** — validate "no dead/unborn characters in stories based on when they occur"
6. **Lore text generation** — generate in-universe "ancient texts", holy books, codex entries
7. **Story generator** — generate story structures anchored in timeline + available characters

Natural build order: #1 is the root dependency. #2, #3, #4 branch from #1
independently. #5 depends on #2. #6 and #7 depend on everything above.

This brainstorm settles #1 only.

## Decision Chain

### Q1: How should the universe relate to existing single-story projects?

**Decision**: Universe is optional and additive. Single-story projects remain
unchanged. A universe is an opt-in wrapper.

**Options considered**:
- Universe-first (new default): Every project starts with a universe. Existing
  projects auto-migrate. — Rejected: breaking change for existing users.
- Universe-optional (additive): Stories remain standalone by default. A universe
  is opt-in. — Selected: no breaking change, existing projects untouched.
- Universe as separate workspace: Universes live in their own directory,
  stories reference by path. — Rejected: path management burden, decoupling
  adds complexity without benefit.

### Q2: Where does the universe live relative to stories?

**Decision**: A `universe.md` file sits in a parent directory above one or more
story projects. Stories reference the universe via frontmatter field
`universe: <kebab-case-id>`. Shared worldbuilding lives at the universe level.
Story projects keep their own characters, locations, etc.

**Options considered**:
- Parent directory (shared umbrella): universe.md above story dirs. — Selected:
  natural directory hierarchy, shared entities are siblings of story projects.
- Inside primary story project: universe.md inside a story. — Rejected: couples
  universe to a single story, creates ownership ambiguity.
- External reference by path: stories point to universe by relative path. —
  Rejected: breaks if directories are moved, explicit path management burden.

### Q3: What shared worldbuilding lives at the universe level vs. the story level?

**Decision**: Both levels can hold any entity type. The level is chosen
per-entity, not per-type. If an entity can appear in multiple stories, put it
at the universe level. If it belongs to one story, put it in that story's
directory.
> **Note**: Superseded by D3 narrowing in the follow-up docs commit. The scope was later narrowed to "shared-worldbuilding entity types only" (characters, locations, systems, factions, artifacts) — narrative types (arcs, chapters, scenes, questions, promises, terms) are story-level only.

**Options considered**:
- Universal vs. local worldbuilding (type-based split): universe gets races/
  pantheons/cosmology, story gets locations/artifacts. — Rejected: a legendary
  character or a sacred mountain location can span stories too. Type-based
  split doesn't capture this.
- All worldbuilding at universe level: everything shared, tagged by story. —
  Rejected: context explosion (scanProject reads everything), tag maintenance
  burden, breaks single-snapshot pattern.
- Both levels, full overlap: both levels have the full worldbuilding set.
  Stories can create local entities AND reference universe-level entities. —
  Selected: per-entity level choice gives maximum flexibility without forcing
  everything into one pool.

**Key insight**: The user's "legendary character as ghost/vision in multiple
stories" edge case proved that the level split can't be by entity type. A
character can be story-specific or universe-spanning. The directory you put
it in IS the scope.

### Q4: How does scanProject resolve universe-level entities?

**Decision**: Full directory scan for completeness (nothing missed), compact
reporting for LLM cost. No new `readEntityFiles` variant.

**Critical correction during brainstorm**: `readEntityFiles` (line 1920 of
`src/story.js`) explicitly skips `_index.md` and reads every `.md` file in a
directory, parsing each one's full frontmatter. The `_index.md` files are
human-facing registries maintained by skills — the CLI never reads them for
entity discovery.

**Three concerns separated**:
1. **File I/O (CLI-side)**: `readdirSync` + `readEntityFiles` on the universe
   directory is fine. Node reads 200 small markdown files in <50ms. Not the
   bottleneck.
2. **LLM context (agent-side)**: An agent working on a story doesn't need to see
   all universe entities. It needs the story's own entities + specific universe
   entities it references.
3. **Reporting**: `story universe scan` returns a compact registry — id, name,
   type, file path per entity, no body content. ~1 line per entity. Agent reads
   full entity files on demand only.

**Options considered**:
- Directory listing + selective frontmatter parse (new `readEntityFiles`
  variant): readdirSync + parseFrontmatter only for referenced entities. —
  Rejected: adds a new code path, risks missing entities if reference detection
  is incomplete, unnecessary complexity given I/O is negligible.
- Machine-readable `_index.md` registry: read registry tables for id→file
  mappings. — Rejected: `_index.md` becomes machine-readable source of truth
  that can drift from actual files, requires reindex to keep in sync, adds
  a new format.
- Full scan (same as story-level `readEntityFiles`): scan universe directory
  same as story directories. — Selected: no new code, nothing missed, cheap I/O.
  Compact reporting bounds LLM cost.

**Important**: `_index.md` files at the universe level mirror the existing
story-level `INDEX_SCHEMAS` (grouped registries per domain), but they remain
human-facing only. The CLI does not read them for entity discovery. They are
maintained by skills for agent/human navigation.

### Q5: What new entity types does the universe scaffold introduce?

**Decision**: Just `universe` — a top-level entity with its own `universe.md`
file and a directory structure for shared entities. No new entity types (races,
eras, pantheons, etc.) — those are deferred to later sub-projects.

**Options considered**:
- Universe entity only (minimal scaffold) — Selected: YAGNI. The scaffold only
  needs the container and cross-reference resolution. New entity types add
  scope without proven need yet.
- Universe + era entity — Rejected: timeline system is sub-project #2.
- Universe + race entity — Rejected: races are sub-project #3.
- Universe + series entity — Rejected: series are sub-project #4.

### Q6: How does a story opt into a universe?

**Decision**: `story.md` frontmatter gains a `universe` field with the
kebab-case id of the universe. The CLI resolves the universe.md by walking up
from the story root to find `universe.md`. If not found, the universe reference
is a validation warning but not an error (story still works standalone).

**Options considered**:
- Frontmatter id + upward walk — Selected: simple, resilient to directory
  moves within the universe tree, degrades gracefully (warning not error).
- Frontmatter relative path — Rejected: breaks if story directory is moved.
- Frontmatter id + config resolution — Rejected: adds config layer, decouples
  from directory structure unnecessarily.

### Q7: What does universe.md contain?

**Decision**: `universe.md` with YAML frontmatter (name, schema-version, genre,
tone, themes) + body sections for cosmological overview, universe history
summary, and notes. Registry layout mirrors the existing story-level
`INDEX_SCHEMAS` exactly: grouped registries per domain, not leaf-per-directory.
`characters/_index.md` covers all characters; `worldbuilding/_index.md` covers
locations, systems, factions, and artifacts in separate tables within one
file. There is no `worldbuilding/locations/_index.md`.

**Options considered**:
- Single `_index.md` at universe level — Rejected: single registry doesn't
  scale for epic universes, breaks existing `INDEX_SCHEMAS` pattern, single
  contention point for parallel agents.
- Grouped registries mirroring `INDEX_SCHEMAS` (universe.md + `_index.md` files
  matching the story-level layout: `characters/_index.md`,
  `worldbuilding/_index.md`, etc.) — Selected: matches existing story-level
  convention exactly. `worldbuilding/_index.md` holds Locations, Systems,
  Factions, and Artifacts tables in one file, not separate per-subdirectory
  registries. Each registry stays small and scoped, no contention between
  parallel agents.

**Trade-off accepted**: Multiple `_index.md` files to maintain vs. single
registry. Accepted because the grouped layout matches `INDEX_SCHEMAS` and
`readEntityFiles` ignores them anyway (they're human/agent-facing navigation,
not CLI entity discovery).

### Q8: What CLI commands does the universe scaffold introduce?

**Decision**: Separate `story universe` command group with: `init`, `scan`,
`validate`, `report`.

**Commands**:
- `story universe init <name>` — scaffold universe.md + directory structure +
  `_index.md` files mirroring `INDEX_SCHEMAS`
- `story universe scan [path]` — compact report of all universe-level entities
  (id, name, type, file path, no body content)
- `story universe validate [path]` — check universe entity frontmatter,
  cross-level references, id uniqueness, no shadowing
- `story universe report [path]` — full inventory summary

**Options considered**:
- Universe init + extended existing commands — Rejected: overloads `story init`
  with too many modes.
- No new commands, flag-based extension — Rejected: `story init` gets overloaded,
  unclear command surface.
- Separate universe command group — Selected: clean separation, discoverable,
  mirrors story-level command structure.

**Scope note**: Cross-level reference checks (story entity references universe
entity → file exists at universe level) are handled under `story universe
validate`, not a separate `story universe links` command. The MVP command set
is `init, scan, validate, report` — no `links` command.

### Q9: How does story init change?

**Decision**: `story init` auto-detects `universe.md` by walking up from the
target directory. If found, it writes the `universe` field into `story.md`
frontmatter automatically. No explicit flag needed. If no universe is found,
`story init` behaves exactly as today.

**Options considered**:
- Unchanged + optional --universe flag — Rejected: requires user to know and
  pass the universe id explicitly.
- Auto-detect universe context — Selected: zero-friction, does the right thing
  automatically.
- Completely unchanged — Rejected: user would need to manually edit story.md
  frontmatter after init, friction.

### Q10: What validation rules does the universe scaffold add?

**Decision**: Full mechanical validation — link resolution, id uniqueness, no
shadowing, frontmatter checks. All under `story universe validate`.

**Rules**:
1. `story.md` `universe` field must resolve to a `universe.md` in an ancestor
   directory (warning if missing, not error — story works standalone)
2. Universe-level entity ids must be kebab-case and unique within their entity
   type
3. Cross-level references: when a story entity references a universe-level id
   (e.g., `deity: the-old-gods`), validate the file exists at the universe
   level
4. No duplicate entity ids between story and universe level (a story character
   can't shadow a universe character)
5. `universe.md` must have required frontmatter (`name`, `schema-version`)

**Options considered**:
- Minimal: existence + frontmatter only — Rejected: cross-level reference
  validation is the core value of the universe scaffold. Without it, broken
  links go undetected.
- Full validation including enum inheritance — Rejected: enum validation for
  universe entity types can be deferred until those types exist (later
  sub-projects). For now, universe entities reuse existing entity types
  (character, location, faction, artifact, etc.) with existing enums.

**CLI vs LLM split**: CLI does mechanical checks (file exists, id is valid,
frontmatter is well-formed). Skills do creative guidance (deciding whether
an entity should be universe-level or story-level, creating entities in the
right place, maintaining `_index.md` files). This follows the existing pattern
where `story validate` = mechanical, `story links` = cross-reference checks,
skills = creative workflows.

### Q11: What skill changes does the universe scaffold need?

**Decision**: New `universe-management` skill + update 3 existing skills.

1. **New skill**: `skills/universe-management/SKILL.md` — guides agents through
   universe init, adding shared entities, cross-level referencing, and when to
   use universe vs story level.
2. **Update story-init skill**: mention auto-detection of `universe.md`.
3. **Update worldbuilding skill**: add guidance on universe-level entities
   (when to put a location/faction/artifact at universe level vs story level).
4. **Update character-management skill**: add guidance on universe-level
   characters (legends, immortals, gods that span multiple stories).

**Options considered**:
- New skill only, no updates — Rejected: existing skills don't mention universe
   level at all. Agents using them would never create universe-level entities.
- No skill work yet, CLI only — Rejected: CLI without skills means agents don't
   know how to use the new commands. The skills are the primary interface.

## Design Trade-offs

1. **Full scan vs. lazy resolution**: Full directory scan is simple and misses
   nothing, but reads all universe entity files on every command. Accepted
   because I/O is negligible (milliseconds) and compact reporting bounds LLM
   context. The alternative (selective frontmatter parsing) adds a new code
   path and risks missing entities.

2. **Grouped registries vs. single registry**: `_index.md` files mirroring
   `INDEX_SCHEMAS` match existing convention but require maintaining multiple
   files. Accepted because it matches the codebase pattern and scales better
   for epic universes.

3. **Universe-optional vs. universe-first**: Opt-in universe means no breaking
   change for existing users, but introduces a dual-mode system (with/without
   universe). Accepted because protecting existing users is more important than
   theoretical simplicity of always-universe.

4. **Auto-detect vs. explicit flag**: Auto-detection is zero-friction but
   implicit. A user might accidentally create a story inside a universe
   directory and get universe linkage they didn't intend. Accepted because the
   linkage is a warning, not an error, and can be removed by deleting the
   `universe` field from `story.md`.

## OpenSpec Capture Summary

### Evidence Checked

- `src/story.js` — `entityConfig()` (line 1253), `scanProject()` (line 140),
  `readEntityFiles()` (line 1920), `readMarkdown()` (line 1938), validation
  functions (lines 2088-2360)
- `src/continuity.js` — `checkContinuity()`, chapter-based death tracking,
  scene/chapter cast validation
- `src/cli.js` — command dispatch, HELP text, option parsing
- `skills/story-init/SKILL.md` — project scaffold structure, conventions
- `skills/worldbuilding/SKILL.md` — location/system/faction/artifact creation
  workflows, cross-referencing patterns
- `skills/character-management/SKILL.md` — character creation, relationships,
  family trees, cross-referencing
- `skills/plot-structure/SKILL.md` — arc/plot-point/timeline management,
  foreshadowing tracking
- `AGENTS.md` — architecture, data flow, entity-config table, conventions

**Key finding**: `readEntityFiles` explicitly skips `_index.md` (line 1928) and
reads every `.md` file in a directory. `_index.md` files are human/agent-facing
registries, NOT CLI entity discovery. This means grouped registries at
the universe level don't give "unchanged" lazy id→file mapping — the CLI always
scans directories directly. The hybrid approach (full scan + compact reporting)
resolves this.

### Domain Model

**Entities introduced**:
- `universe` — top-level container entity with `universe.md` and shared
  worldbuilding directories. Not a new entity *type* in `entityConfig()`; it's
  a new project-level artifact like `story.md`.

**Relationships**:
- `story.md` → `universe.md`: one-to-one optional reference via `universe`
  frontmatter field (kebab-case id), resolved by upward directory walk
- Story entity → universe entity: cross-level reference via existing
  frontmatter fields (e.g., `deity`, `faction`, `location`), resolved by
  checking universe level if not found at story level
- Universe entity → story entity: implicit (story entities reference up,
  universe entities are referenced down; no backlinks needed for MVP)

**Directory structure**:
```
{universe-name}/
├── universe.md                    # frontmatter: name, schema-version, genre, tone, themes
├── characters/                    # universe-spanning characters (legends, immortals)
│   └── _index.md                  # character-registry (mirrors story-level INDEX_SCHEMAS)
├── worldbuilding/
│   ├── _index.md                  # world-registry (Locations, Systems, Factions, Artifacts tables)
│   ├── locations/                  # shared locations (sacred mountains, etc.)
│   ├── systems/
│   ├── factions/
│   └── artifacts/
└── stories/                       # (convention, not enforced)
    ├── novel-fall-of-empires/     # story project (existing structure)
    │   ├── story.md               # frontmatter: universe: {universe-name}
    │   ├── characters/
    │   └── ...
    └── short-the-old-god/
        └── ...
```

- Universe level: any shared-worldbuilding entity type (characters, locations, systems, factions, artifacts), chosen per-entity (not per-type) [narrowed from "any entity type" — see D3 update in design.md]
- Story level: any entity type, chosen per-entity (narrative types remain story-level only)
- Resolution order: story-level first, then universe-level
- No id shadowing: a story entity id cannot match a universe entity id of the
  same type

### Grilling Decision Tree

**D1: Universe-first vs. universe-optional?**
- Q: Breaking change for existing users?
- A: Universe-first auto-migrates all projects → yes, breaking.
- Survivor: universe-optional (additive). No breaking change.

**D2: Type-based vs. per-entity level split?**
- Q: Can a character span multiple stories?
- A: Yes — legendary characters, gods, immortals appear as ghosts/visions.
- Q: Does type-based split capture this?
- A: No — characters would be forced to story level, but some characters are
  universe-spanning.
- Survivor: per-entity level choice. Directory IS the scope.

**D3: All-at-universe vs. both-levels?**
- Q: How does scanProject handle all-at-universe?
- A: Must read every entity across every story → context explosion. Tags don't
  help — still read all files to check tags.
- Q: Cross-entity tag maintenance?
- A: Adding/removing a story requires updating every entity's story list.
  Violates per-entity CRUD pattern.
- Survivor: both-levels. Each level scans independently.

**D4: Lazy resolution vs. full scan?**
- Q: Does `readEntityFiles` support lazy resolution?
- A: No — it reads every `.md` file in a directory (skipping `_index.md`).
- Q: Would `_index.md` give lazy id→file mapping?
- A: No — CLI never reads `_index.md` for entity discovery. It scans
  directories directly.
- Q: Is full scan expensive?
- A: No — milliseconds for 200 files. The expensive part is LLM context, not I/O.
- Survivor: full scan + compact reporting. No new readEntityFiles variant.

**D5: Separate command group vs. extended existing commands?**
- Q: Does flag-based extension overload `story init`?
- A: Yes — `story init --universe` mixes concerns.
- Q: Is a separate group more discoverable?
- A: Yes — `story universe init` is self-documenting.
- Survivor: separate `story universe` command group.

**D6: Minimal validation vs. full validation?**
- Q: Is cross-level reference validation the core value?
- A: Yes — without it, broken universe links go undetected.
- Q: Are enum validations needed now?
- A: No — universe entities reuse existing types with existing enums. New types
  come in later sub-projects.
- Survivor: full mechanical validation (links, uniqueness, shadowing,
  frontmatter), no new enums.

### Resolved Decisions

1. **Universe is opt-in and additive** — no breaking change to existing
   single-story projects.
2. **Universe lives in a parent directory above story projects** — `universe.md`
   + shared entity directories. Stories reference via `universe` frontmatter
   field (kebab-case id).
3. **Both levels can hold any shared-worldbuilding entity type** — level is chosen per-entity, not per-type. Directory IS the scope. [Narrowed from "any entity type" in follow-up docs commit — narrative types are story-level only. See D3 in design.md.]
4. **Full directory scan + compact reporting** — CLI scans universe directories
   fully (nothing missed, cheap I/O). `story universe scan` outputs compact
   registry (id, name, type, path — no body). Agents read full entity files on
   demand.
5. **Minimal entity introduction** — just `universe` as a project-level
   artifact (like `story.md`). No new entity types. YAGNI.
6. **`story.md` gains `universe` frontmatter field** — kebab-case id, resolved by
   upward directory walk. Missing universe = warning, not error.
7. **`universe.md` + grouped `_index.md` registries mirroring `INDEX_SCHEMAS`** —
   `characters/_index.md` (character-registry), `worldbuilding/_index.md`
   (world-registry with Locations/Systems/Factions/Artifacts tables), etc.
   `_index.md` files are human/agent-facing only (CLI doesn't read them for
   discovery).
8. **Separate `story universe` command group** — `init`, `scan`, `validate`,
   `report`. No `links` command (cross-level checks under `validate`).
9. **`story init` auto-detects universe** — walks up to find `universe.md`,
   writes `universe` field automatically. No flag needed.
10. **Full mechanical validation** — link resolution, id uniqueness, no
    shadowing, frontmatter checks. All under `story universe validate`.
11. **New `universe-management` skill + update 3 existing skills** —
    story-init, worldbuilding, character-management.

### Rejected Alternatives

1. **Universe-first (new default)** → Rejected: breaking change for existing
   users. Auto-migration of all projects is risky.
2. **All worldbuilding at universe level with tags** → Rejected: context
   explosion (scanProject reads all files), tag maintenance burden, breaks
   single-snapshot pattern.
3. **Type-based level split** → Rejected: a character can span stories
   (legends, gods). Type doesn't determine level; the entity's scope does.
4. **Selective frontmatter parsing (lazy resolution)** → Rejected: new code
   path, risk of missing entities, unnecessary given I/O is negligible.
5. **Machine-readable `_index.md`** → Rejected: creates a source of truth that
   can drift from actual files. `_index.md` stays human-facing.
6. **Single registry at universe level** → Rejected: doesn't scale for epic
   universes, breaks existing `INDEX_SCHEMAS` pattern.
7. **Flag-based command extension** → Rejected: overloads `story init`,
   unclear command surface.
8. **Minimal validation (existence + frontmatter only)** → Rejected:
   cross-level reference validation is the core value of the scaffold.
9. **CLI-only, no skill changes** → Rejected: agents won't know how to use
   the new commands without skill guidance.
10. **New entity types in the scaffold** → Rejected: YAGNI. Races, eras,
    pantheons, series are deferred to their own sub-projects.

### Risks / Trade-offs

- **[Risk] Full scan cost on very large universes** → Mitigated: I/O is
  milliseconds. Compact reporting bounds LLM context. If this becomes a real
  bottleneck, selective parsing can be added later without API change.
- **[Risk] Auto-detection false positives** → A story created inside a universe
  directory gets universe linkage unintentionally → Mitigated: linkage is a
  warning, not an error. User can remove the `universe` field from `story.md`.
- **[Risk] Dual-mode system complexity** → Every command must handle both
  with-universe and without-universe cases → Mitigated: universe resolution is
  additive. If `universe` field is absent, all commands behave exactly as today.
- **[Trade-off] Grouped `_index.md` maintenance** → Multiple registry
  files to maintain vs. single registry → Accepted: matches `INDEX_SCHEMAS`
  pattern, scales better, no contention for parallel agents.
- **[Trade-off] No machine-readable registry** → CLI scans directories
  directly instead of reading registry tables → Accepted: avoids drift risk.
  `_index.md` files are for human/agent navigation only.
- **[Risk] Cross-level reference resolution ambiguity** → If both story and
  universe have an entity with the same id → Mitigated: validation rule #4
  forbids id shadowing. Story-level is checked first; if found, universe-level
  is not consulted.

### Documentation Candidates

1. **Universe management guide** — user-facing docs on creating and managing
   universes, when to use universe vs. story level, cross-level referencing
2. **`story universe` command reference** — CLI help text and docs for the new
   command group
3. **Migration guide** — how existing single-story projects can opt into a
   universe (create universe.md, move project into stories/ subdirectory, add
   `universe` field to story.md)
4. **AGENTS.md update** — new entity in the architecture, new CLI commands in
   the command mapping table, new skill in the skill inventory
5. **Skill cross-reference guide** — how universe-management relates to
   story-init, worldbuilding, and character-management skills

### Validated Direction

The universe scaffold introduces an opt-in, additive universe container that
sits in a parent directory above story projects. A `universe.md` file with
frontmatter (`name`, `schema-version`, `genre`, `tone`, `themes`) serves as
the universe bible. Shared entities of any type (characters, locations,
factions, artifacts, systems) live at the universe level in grouped
structures mirroring `INDEX_SCHEMAS`, each with a human-facing
`_index.md` registry. Stories opt in via a `universe` frontmatter field in
`story.md`, resolved by upward directory walk — missing universe is a warning,
not an error. `story init` auto-detects universe context. The CLI gains a
separate `story universe` command group (`init`, `scan`, `validate`, `report`).
`scanProject` extends to optionally scan the universe level using the existing
`readEntityFiles` pattern (full directory scan, compact reporting). Validation
covers cross-level reference resolution, id uniqueness, no shadowing, and
frontmatter checks. A new `universe-management` skill guides agents, with
updates to `story-init`, `worldbuilding`, and `character-management` skills
adding universe-level awareness. No new entity types are introduced — the
scaffold is purely the container and cross-reference infrastructure. Subsequent
sub-projects (eras, races, pantheons, series, timeline-aware continuity, lore
generation, story generator) build on this foundation.
