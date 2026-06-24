## Context

Story Skills is a Bun/Node ESM package shipping agent skills for fiction-writing workflows plus a deterministic `story` CLI. The CLI operates on plain markdown with YAML frontmatter — no database, no async I/O. A single `scanProject(root)` call produces a flat snapshot consumed by all validators, reporters, and mutations.

Currently the system supports single-story scope only: 11 entity types (character, location, system, faction, artifact, arc, chapter, scene, question, promise, term), chapter-based continuity tracking, and a flat markdown timeline. There is no universe, series, or epic container — every project is an isolated story directory with `story.md` at its root.

The user wants to scale to Warhammer-40k-scale universe creation. The full vision decomposes into 7 independent sub-projects: (1) universe scaffold [this change], (2) era & timeline system, (3) races/cosmology/pantheons, (4) series & epic structure, (5) timeline-aware continuity, (6) lore text generation, (7) story generator. This design covers sub-project #1 only — the container and cross-reference infrastructure everything else builds on.

Key architectural constraints: fully synchronous I/O (`fs.readFileSync`/`fs.writeFileSync`), no external runtime dependencies, no breaking changes to existing projects, filesystem containment via `assertLexicallyInsideRoot`, idempotent writes via `writeChanged()`.

## Goals / Non-Goals

**Goals:**
- Introduce an opt-in, additive universe container (`universe.md`) that sits in a parent directory above story projects
- Enable cross-level entity resolution: story entities can reference universe-level entities, resolved by scanning the universe directory using the existing `readEntityFiles` pattern
- Add a `story universe` command group: `init`, `scan`, `validate`, `report`
- Provide full mechanical validation of cross-level references, id uniqueness, no shadowing, and frontmatter completeness
- Add a `universe-management` skill and update three existing skills (`story-init`, `worldbuilding`, `character-management`) with universe-level awareness
- Auto-detect universe context during `story init` via upward directory walk

**Non-Goals:**
- Era & timeline system (sub-project #2)
- Races, cosmology & pantheons as new entity types (sub-project #3)
- Series & epic structure (sub-project #4)
- Timeline-aware continuity validation (sub-project #5)
- Lore text generation (sub-project #6)
- Story generator (sub-project #7)
- New entity types in `entityConfig()` — the scaffold reuses existing types (character, location, faction, artifact, system, etc.) at the universe level
- Machine-readable `_index.md` registries — they remain human/agent-facing navigation only
- Enum inheritance for universe entity types — deferred until those types exist in later sub-projects

## Decisions

### D1: Universe is opt-in and additive

- **Choice**: Universe is optional. Single-story projects remain unchanged. A universe is an opt-in wrapper.
- **Rationale**: Universe-first (new default) would auto-migrate all existing projects — a breaking change. Opt-in means zero impact on existing users.
- **Alternatives considered**: Universe-first (rejected: breaking change, risky auto-migration). Universe as separate workspace (rejected: path management burden, unnecessary decoupling).

### D2: Universe lives in a parent directory above story projects

- **Choice**: A `universe.md` file sits in a parent directory above one or more story projects. Shared worldbuilding lives at the universe level. Story projects keep their own entities.
- **Rationale**: Natural directory hierarchy — shared entities are siblings of story projects. Putting `universe.md` inside a story project couples the universe to one story and creates ownership ambiguity.
- **Alternatives considered**: Inside primary story project (rejected: ownership ambiguity). External reference by relative path (rejected: breaks if directories are moved).

### D3: Both levels can hold any entity type — level is chosen per-entity, not per-type

- **Choice**: If an entity can appear in multiple stories, put it at the universe level. If it belongs to one story, put it in that story's directory. The directory IS the scope.
- **Rationale**: A legendary character or a sacred mountain location can span stories. A type-based split (universe gets races/pantheons, story gets locations/artifacts) doesn't capture this — a character can be story-specific or universe-spanning depending on the entity, not the type.
- **Alternatives considered**: Type-based split (rejected: doesn't capture cross-story characters). All worldbuilding at universe level with story tags (rejected: context explosion from scanning all files, tag maintenance burden, breaks per-entity CRUD pattern).

### D4: Full directory scan + compact reporting (no lazy resolution)

- **Choice**: The CLI scans universe directories fully using the existing `readEntityFiles` pattern (which reads every `.md` file in a directory, skipping `_index.md`). `story universe scan` outputs a compact registry — id, name, type, file path, no body content. Agents read full entity files on demand.
- **Rationale**: `readEntityFiles` (line 1920 of `src/story.js`) already reads every `.md` file in a directory and parses frontmatter. Node reads 200 small markdown files in <50ms — I/O is not the bottleneck. The expensive part is LLM context, which compact reporting bounds. No new code path needed.
- **Alternatives considered**: Selective frontmatter parse via a new `readEntityFiles` variant (rejected: new code path, risks missing entities, unnecessary complexity). Machine-readable `_index.md` registry (rejected: creates a source of truth that can drift from actual files, requires reindex to sync).

### D5: Minimal entity introduction — just `universe` as a project-level artifact

- **Choice**: No new entity types in `entityConfig()`. The universe is a project-level artifact like `story.md`, with its own `universe.md` file and directory structure for shared entities.
- **Rationale**: YAGNI. The scaffold only needs the container and cross-reference resolution. New entity types (races, eras, pantheons, series) add scope without proven need yet — they belong in their own sub-projects.
- **Alternatives considered**: Universe + era entity (rejected: timeline is sub-project #2). Universe + race entity (rejected: races are sub-project #3). Universe + series entity (rejected: series are sub-project #4).

### D6: Story opt-in via frontmatter field + upward directory walk

- **Choice**: `story.md` frontmatter gains a `universe` field (kebab-case id). The CLI resolves `universe.md` by walking up from the story root. If not found, the universe reference is a validation warning, not an error — the story still works standalone.
- **Rationale**: Simple, resilient to directory moves within the universe tree, degrades gracefully.
- **Alternatives considered**: Frontmatter relative path (rejected: breaks if story directory is moved). Frontmatter id + config resolution (rejected: adds config layer, unnecessary decoupling from directory structure).

### D7: `universe.md` frontmatter + grouped `_index.md` registries mirroring `INDEX_SCHEMAS`

- **Choice**: `universe.md` with YAML frontmatter (`name`, `schema-version`, `genre`, `tone`, `themes`) + body sections for cosmological overview, universe history summary, and notes. Registry layout mirrors the existing story-level `INDEX_SCHEMAS` exactly: grouped registries per domain (`characters/_index.md`, `worldbuilding/_index.md`, etc.), not leaf-per-directory. `worldbuilding/_index.md` holds Locations, Systems, Factions, and Artifacts tables in one file.
- **Rationale**: Matches existing story-level convention exactly. Each registry stays small and scoped, avoiding contention for parallel agents. `readEntityFiles` ignores `_index.md` anyway — they are human/agent-facing navigation, not CLI entity discovery.
- **Alternatives considered**: Single `_index.md` at universe level (rejected: doesn't scale for epic universes, breaks `INDEX_SCHEMAS` pattern, single contention point). Leaf-per-directory registries like `worldbuilding/locations/_index.md` (rejected: doesn't match `INDEX_SCHEMAS` which groups all worldbuilding types into one `worldbuilding/_index.md`).

### D8: Separate `story universe` command group

- **Choice**: New `story universe` command group with `init`, `scan`, `validate`, `report`. Cross-level reference checks are under `validate`, not a separate `links` command.
- **Rationale**: Clean separation from story-level commands. `story init --universe` would mix concerns and overload the command surface. A separate group is self-documenting and mirrors story-level structure.
- **Alternatives considered**: Extended existing commands (rejected: overloads `story init`). Flag-based extension (rejected: unclear command surface).

### D9: `story init` auto-detects universe context

- **Choice**: `story init` walks up from the target directory to find `universe.md`. If found, it writes the `universe` field into `story.md` frontmatter automatically. No explicit flag needed. If no universe is found, `story init` behaves exactly as today.
- **Rationale**: Zero-friction opt-in — does the right thing automatically. The linkage is a warning, not an error, and can be removed by deleting the `universe` field from `story.md`.
- **Alternatives considered**: Unchanged + optional `--universe` flag (rejected: requires user to know and pass universe id explicitly). Completely unchanged (rejected: user must manually edit frontmatter after init, friction).

### D10: Full mechanical validation under `story universe validate`

- **Choice**: Five validation rules: (1) `story.md` `universe` field must resolve to `universe.md` in ancestor directory (warning if missing), (2) universe-level entity ids must be kebab-case and unique within entity type, (3) cross-level references: story entity referencing a universe-level id must have the file exist at universe level, (4) no duplicate entity ids between story and universe level of same type, (5) `universe.md` must have required frontmatter (`name`, `schema-version`).
- **Rationale**: Cross-level reference validation is the core value of the scaffold. Without it, broken links go undetected. Enum validation for new entity types can be deferred — universe entities reuse existing types with existing enums.
- **Alternatives considered**: Minimal validation — existence + frontmatter only (rejected: misses cross-level reference validation, the core value). Full validation including enum inheritance (rejected: no new enums needed until new entity types exist in later sub-projects).

### D11: New `universe-management` skill + update 3 existing skills

- **Choice**: New `skills/universe-management/SKILL.md` guides agents through universe init, adding shared entities, cross-level referencing, and when to use universe vs. story level. Update `story-init` (mention auto-detection), `worldbuilding` (universe-level entity guidance), `character-management` (universe-level characters — legends, immortals, gods).
- **Rationale**: CLI without skills means agents don't know how to use the new commands. Existing skills don't mention universe level at all — agents using them would never create universe-level entities.
- **Alternatives considered**: New skill only, no updates (rejected: existing skills would never guide universe-level work). CLI only, no skill changes (rejected: agents won't discover or use the new commands).

### D12: Path-safety boundary and snapshot isolation for universe entities

- **Choice**: The scan snapshot gains a separate `project.universe` object (with its own `characters`, `locations`, `systems`, `factions`, `artifacts` arrays) and a `project.universeRoot` path. Universe entities are never merged into the top-level `project.characters`/`project.locations`/etc. arrays. Universe directory scanning uses `universeRoot` as its root argument to `readEntityFiles`/`readMarkdown`/`assertLexicallyInsideRoot` — not `storyRoot`. Cross-level link validation builds combined lookup maps (story + universe) at validation time without mutating the snapshot.
- **Rationale**: Two constraints force this design:
  1. **Path safety**: `readEntityFiles` and `readMarkdown` call `assertLexicallyInsideRoot(path, root)`. The universe directory is an *ancestor* of the story root, so passing universe file paths through `storyRoot` would be rejected by the containment guard. Universe scanning must use `universeRoot` as its own root argument.
  2. **Consumer isolation**: Existing consumers like `reindexProject()` iterate `project.characters` to build story-level `_index.md` registries. If universe entities were merged into those arrays, `reindexProject` would accidentally write universe entities into story registries. Keeping universe entities in `project.universe` prevents any existing consumer from touching them without explicit opt-in.
  Cross-level reference validation needs to resolve an id against both levels, but this is done by building a transient combined map (`new Map([...storyIds, ...universeIds])`) at validation time — the snapshot itself stays partitioned.
- **Alternatives considered**: Merge universe entities into top-level arrays with a `level` tag (rejected: every existing consumer — `reindexProject`, `computeWordCounts`, `exportManuscript`, `formatProjectReport` — would need to learn to filter by level; high risk of missed filtering causing universe data to leak into story artifacts). Pass `storyRoot` for universe paths and relax the containment guard (rejected: defeats the filesystem safety invariant; universe files are lexically outside `storyRoot` by design).

## Risks / Trade-offs

- [Risk] Full scan cost on very large universes → Mitigation: I/O is milliseconds for 200 files. Compact reporting bounds LLM context. If this becomes a real bottleneck, selective parsing can be added later without API change.
- [Risk] Auto-detection false positives — a story created inside a universe directory gets universe linkage unintentionally → Mitigation: linkage is a warning, not an error. User can remove the `universe` field from `story.md`.
- [Risk] Dual-mode system complexity — every command must handle both with-universe and without-universe cases → Mitigation: universe resolution is additive. If `universe` field is absent, all commands behave exactly as today.
- [Risk] Cross-level reference resolution ambiguity — if both story and universe have an entity with the same id → Mitigation: validation rule #4 forbids id shadowing. Story-level is checked first; if found, universe-level is not consulted.
- [Trade-off] Grouped `_index.md` maintenance — multiple registry files to maintain vs. single registry → Reason accepted: matches `INDEX_SCHEMAS` pattern, scales better for epic universes, no contention for parallel agents.
- [Trade-off] No machine-readable registry — CLI scans directories directly instead of reading registry tables → Reason accepted: avoids drift risk. `_index.md` files are for human/agent navigation only.

## Migration Plan

**Deployment**: No deployment changes — this is a pure code/package change. The new `story universe` commands and `scanProject` extension ship in the next package release.

**Existing project adoption**: Existing single-story projects are unaffected — no migration required. Projects that want to opt into a universe:
1. Create a `universe.md` in a parent directory above the story project
2. Scaffold universe entity directories (`characters/`, `worldbuilding/`, etc.) via `story universe init`
3. Move the story project into a `stories/` subdirectory (convention, not enforced)
4. Add `universe: <kebab-case-id>` to `story.md` frontmatter (or re-run `story init` for auto-detection)

**Rollback**: Remove the `universe` field from `story.md`. The story reverts to standalone mode. Universe entity files are independent and can be deleted or archived separately.

**Acceptance criteria**:
- `story universe init <name>` creates `universe.md` + directory structure with `_index.md` files mirroring `INDEX_SCHEMAS`
- `story universe scan` outputs compact registry (id, name, type, path — no body)
- `story universe validate` catches: broken cross-level references, id shadowing, missing frontmatter, non-kebab ids
- `story init` inside a universe directory auto-writes the `universe` field
- Existing single-story projects pass `story validate` unchanged
- `bun run test` passes with new universe test coverage
- Fallback bundle (`skills/story-maintenance/scripts/story.js`) is regenerated and passes `check:fallback`

## Open Questions

None — all decisions were settled during brainstorming. The 7 deferred sub-projects will each have their own brainstorm → proposal → design cycle.
