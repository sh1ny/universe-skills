# Repository Guidelines

Story Skills is a Bun/Node ESM package (v0.3.1) that ships **Agent Skills** for fiction-writing workflows plus a deterministic `story` CLI. Skills guide creative workflows (story init, character management, worldbuilding, plot structure, chapter writing, revision/continuity). The CLI handles mechanical maintenance (validate, reindex, word counts, link checks, continuity checks, exports, disposable builds). The core format is plain markdown with YAML frontmatter — no database, no config files, no async I/O.

## Architecture & Data Flow

Three layers compose cleanly:

1. **Creative skills** (`skills/<name>/SKILL.md`) — Agent-facing workflows. Each skill is a single `SKILL.md` with YAML frontmatter (`name`, `description`) plus a body that walks an agent through what to read, write, and which CLI commands to run. Structured templates live in `references/` subdirectories. The eight skills chain as: `story-init` scaffolds → `character-management` / `worldbuilding` / `plot-structure` populate → `chapter-writing` drafts → `revision-continuity` audits → `story-maintenance` runs deterministic CLI checks. `universe-management` provides opt-in shared-entity workflows above story projects.

2. **CLI** (`src/`) — Pure mechanical surface. `bin/story.js` is a 5-line shim importing `runCli` from `src/cli.js`. `cli.js` does arg parsing + command dispatch via an if-chain into `src/story.js`. All operations are synchronous (`fs.readFileSync` / `fs.writeFileSync`), returning plain objects or writing to stdout/stderr.

3. **Distribution artifacts** — `skills/story-maintenance/scripts/story.js` is a Bun-generated single-file Node bundle inlining all of `src/*` for copied-skill installs. Plugin manifests under `.codex-plugin/`, `.claude-plugin/`, `.agents/` describe the same skill bundle for three install paths.

### Data Flow

```
process.argv → parseArgs → runCli dispatch
                                  │
                                  ▼
              scanProject(root)   ◀── single read-only snapshot
              │   reads .md files with parseFrontmatter (YAML)
              │   → { story, characters, locations, systems, factions,
              │      artifacts, arcs, chapters, scenes, questions,
              │      promises, glossaryTerms, continuity }
              │   → if story.data.universe: resolveUniverseRoot + scanUniverse
              │      → project.universe = { characters, locations, systems,
              │         factions, artifacts }, project.universeRoot
              │
              ├─→ validateProject / validateLinks / checkContinuity
              ├─→ projectReport / projectActions
              └─→ computeWordCounts / exportManuscript / buildBook
                                  │
                                  ▼
                          format*Report → stdout

Mutations (add/rename/remove/init/import/reindex/wordcount --write):
  scanProject → change state → writeFile(stringifyFrontmatter(...))
  All writes go through assertLexicallyInsideRoot (path-traversal guard)
  writeChanged() compares before writing → idempotent on re-run
```

### Key Architectural Patterns

- **Single-snapshot**: `scanProject(root)` is the only reader. Every validator, reporter, and action builder takes that snapshot (or rescans itself). Trivially mockable in tests.
- **Pure-data results**: Validation/continuity/link checks return `{ ok: boolean, errors: string[], warnings: string[] }`. CLI counts errors for exit code, dumps messages.
- **Filesystem containment**: Every write goes through `prepareWriteTarget → assertLexicallyInsideRoot`. Every read goes through `safeRead` / `readMarkdown`. No command can read or write outside the project root.
- **Idempotent writes**: `reindexProject`, `migrateProject`, `computeWordCounts --write` use `writeChanged(filePath, contents, changed, root)` — running twice is a no-op.
- **Entity-config table**: `entityConfig(kind)` in `src/story.js` (~line 1254) is the source of truth for `dir` and `titleField` per kind: `character`, `location`, `system`, `faction`, `artifact`, `arc`, `chapter`, `scene`, `question`, `promise`, `term`. New kinds slot in here and propagate through CRUD automatically.
- **Schema enforcement**: `STORY_SCHEMA_VERSION = 2` checked by `validateProject`, stamped by `migrateProject`. Enums (statuses, roles, types, categories) are frozen `Set`s at the top of `src/story.js`.

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/` | CLI source modules (7 files, all ESM, synchronous) |
| `bin/` | Package binary entrypoint (`story.js` — 5-line shim) |
| `skills/` | Published `SKILL.md` workflows and their `references/` files |
| `test/` | Bun test files (`*.test.js`) + shared `helpers.js` |
| `examples/` | Three sample Story Skills projects (CI fixtures) |
| `scripts/` | Quality-gate scripts: `check-coverage.js`, `check-fallback.js`, `check-metadata.js`, `check-examples.js` |
| `schemas/` | JSON Schema files published with the package |
| `docs/` | Documentation published with the package |
| `.codex-plugin/` | Codex plugin manifest |
| `.claude-plugin/` | Claude Code plugin + marketplace manifests |
| `.agents/` | Local Agent Skills marketplace manifest |

### Source Module Inventory

| File | Purpose | Key Exports |
|------|---------|-------------|
| `bin/story.js` | Process entry; thin shim | — |
| `src/cli.js` | Arg parsing + command dispatch | `runCli(argv, io)`, `parseArgs(argv)` |
| `src/story.js` | Domain core (~2,483 LOC): project lifecycle, validation, reporting, I/O, export, entity CRUD | `createStoryProject`, `scanProject`, `validateProject`, `validateLinks`, `checkProjectContinuity`, `projectReport`, `formatProjectReport`, `projectActions`, `formatActionReport`, `formatDoctorReport`, `reindexProject`, `computeWordCounts`, `exportManuscript`, `buildBook`, `migrateProject`, `createEntity`, `renameEntity`, `removeEntity`, `createUniverseProject`, `resolveUniverseRoot`, `scanUniverse`, `validateUniverse`, `universeScan`, `formatUniverseScan`, `universeReport`, `formatUniverseReport` |
| `src/continuity.js` | Deterministic continuity checker | `checkContinuity(project)` → `{ ok, errors, warnings }` |
| `src/frontmatter.js` | Zero-dependency YAML-frontmatter parser/stringifier | `parseFrontmatter`, `stringifyFrontmatter`, `replaceFrontmatter` |
| `src/markdown.js` | Markdown helpers and slug utilities | `kebabCase`, `titleCaseSlug`, `wordCount`, `chapterProse`, `extractSection`, `escapeRegExp` |
| `src/import.js` | Manuscript importer (splits external `.md`/`.txt` into per-chapter files) | `importManuscript(options)`, `extractNameCandidates(prose)` |

### CLI Command → Source Mapping

| Command | Source Function |
|---------|----------------|
| `story init <title>` | `story.js → createStoryProject` |
| `story import <source>` | `import.js → importManuscript` |
| `story validate [path]` | `story.js → validateProject` |
| `story links [path]` | `story.js → validateLinks` |
| `story continuity [path]` | `story.js → checkProjectContinuity` → `continuity.js#checkContinuity` |
| `story report [path]` | `story.js → formatProjectReport(projectReport(root))` |
| `story next [path]` | `story.js → formatActionReport(projectActions(root))` |
| `story doctor [path]` | `story.js → formatDoctorReport(projectActions(root))` |
| `story migrate [path]` | `story.js → migrateProject` |
| `story add <kind> <name>` | `story.js → createEntity` |
| `story rename <kind> <id> <name>` | `story.js → renameEntity` |
| `story remove <kind> <id>` | `story.js → removeEntity` |
| `story reindex [path]` | `story.js → reindexProject` |
| `story wordcount [path]` | `story.js → computeWordCounts` (`--write` to persist) |
| `story export [path]` | `story.js → exportManuscript` |
| `story build [path]` | `story.js → buildBook` (`--format markdown\|epub\|docx`) |
| `story universe init <name>` | `story.js → createUniverseProject` |
| `story universe scan [path]` | `story.js → formatUniverseScan(universeScan(root))` |
| `story universe validate [path]` | `story.js → validateUniverse` |
| `story universe report [path]` | `story.js → formatUniverseReport(universeReport(root))` |

## Development Commands

```shell
bun install                        # install deps (no devDependencies)
bun run story -- --help            # run CLI locally
bun run test                       # run test suite
bun run test:coverage              # tests + 100% coverage gate + fallback check
bun run build:fallback             # regenerate skills/story-maintenance/scripts/story.js
bun run check:fallback             # verify committed fallback is current
bun run check:metadata             # validate plugin metadata consistency
bun run test:examples               # validate example projects via CLI
```

### CI Pipeline (`.github/workflows/ci.yml`)

Triggered on push to `main` and all PRs. Stages:

1. Checkout → setup Bun 1.3.14
2. `bun install`
3. `bun run check:metadata` — plugin metadata consistency
4. `bun run test` — test suite
5. `bun run test:coverage` — coverage + fallback checks
6. `bun run test:examples` — example project validation
7. `node skills/story-maintenance/scripts/story.js --help` — fallback runs under Node

### Build Process

`build:fallback` runs `bun build ./bin/story.js --target=node --outfile=skills/story-maintenance/scripts/story.js`. This bundles all `src/*` modules into a single Node-compatible file for copied-skill installs. `check:fallback` byte-compares the committed file against a fresh build — exits 1 if out of sync.

**Rule**: After changing CLI behavior in `src/`, always run `bun run build:fallback` then `bun run check:fallback`.

## Code Conventions & Common Patterns

### Module System & Runtime

- **ESM** (`"type": "module"`). Always use `node:` prefix for built-ins (`node:fs`, `node:path`, `node:buffer`).
- **Fully synchronous** — no `Promise`, `async`/`await`, or streams. `fs.readFileSync` / `fs.writeFileSync` everywhere.
- **No external runtime dependencies**. `devDependencies` is empty. The frontmatter parser is hand-rolled to avoid a YAML dependency.
- **Named exports only** — no `default` exports. Cross-module imports via relative paths (`./story.js`, `./frontmatter.js`). No barrel files.

### Naming

| Context | Convention | Example |
|---------|-----------|---------|
| Functions, variables, JS keys | `camelCase` | `scanProject`, `createEntity` |
| CLI flags, file/directory names, entity ids | `kebab-case` | `--sub-genre`, `characters/mara-quill.md` |
| Module-level constants, enum `Set`s | `SCREAMING_SNAKE_CASE` | `STORY_SCHEMA_VERSION`, `REQUIRED_PATHS`, `CHAPTER_STATUSES` |

### Error Handling

- Throw `new Error("…")` with short human-readable messages.
- `runCli` is the only `try/catch` — catches all errors, writes `error.message` to stderr, returns exit code 1.
- Validators accumulate errors/warnings into arrays rather than throwing.
- Missing preconditions throw early (e.g., `"A story title is required"`, `"Unsupported entity kind: …"`).

### State Management

- All state lives in markdown files with YAML frontmatter. No config file loader, no plugin system, no in-memory state across commands.
- `scanProject(root)` produces a flat snapshot object consumed by all operations.
- Mutations write back via `writeFile` + `stringifyFrontmatter`. `writeChanged()` skips unchanged files.

### Reference Rewrites

- `renameEntity` calls `replaceEntityReferences(root, oldId, newId)` — regex over all `.md` files.
- `removeEntity` calls `removeEntityReferences` — walks frontmatter, strips list entries.
- `applyEntityBacklinks` mirrors character↔location joins when corresponding fields are present.

### Filesystem Safety

- All writes go through `assertLexicallyInsideRoot + assertSafeProjectParent`.
- All reads go through `safeRead` or `readMarkdown`, which call `assertSafeProjectPath`.
- Symlink traversal is refused — tested explicitly for files-in-place-of-dirs, symlinked chapters/worldbuilding/dist.

### Skill Authoring

- Every skill: `skills/<skill-name>/SKILL.md` with YAML frontmatter (`name`, `description`).
- `description` doubles as a trigger-phrase index — list natural-language prompts users would say.
- Reference files (templates, taxonomies) go under `skills/<skill-name>/references/`.
- Entity identifiers are `kebab-case`. Maintain bidirectional links where the domain requires them.
- After instructions that add/remove/rename/revise entities, direct agents to run: `story reindex`, `story wordcount --write`, `story links`, and/or `story validate`.
- **Never** copy `scripts/story.js` into a user's project or invent project-local build/generator scripts.

## Important Files

| File | Role |
|------|------|
| `bin/story.js` | Package binary entrypoint (5-line shim → `runCli`) |
| `src/cli.js` | Arg parser + command dispatcher + `HELP` text |
| `src/story.js` | Domain core (~2,483 LOC) — all project-level operations |
| `src/continuity.js` | Continuity rule engine (deaths, POV, sequence gaps, promises/questions) |
| `src/frontmatter.js` | Zero-dependency YAML frontmatter parser/stringifier |
| `src/markdown.js` | Slug, word-count, and prose-extraction helpers |
| `src/import.js` | Manuscript import (splits external text into v2 project) |
| `package.json` | Manifest: `type: module`, `engines.node: >=18`, `packageManager: bun@1.3.14` |
| `bunfig.toml` | Bun test config (`coverageSkipTestFiles = true`) |
| `skills/story-maintenance/scripts/story.js` | Generated single-file Node bundle (do not edit directly) |
| `.github/workflows/ci.yml` | CI pipeline |
| `.codex-plugin/plugin.json` | Codex plugin manifest (includes `interface` block) |
| `.claude-plugin/plugin.json` | Claude Code plugin manifest |
| `.claude-plugin/marketplace.json` | Claude marketplace entry (points to GitHub URL) |
| `.agents/plugins/marketplace.json` | Local Agent Skills marketplace entry |

## Runtime/Tooling Preferences

- **Runtime**: Bun primary (`packageManager: bun@1.3.14`); Node ≥18 fallback.
- `bin/story.js` uses `#!/usr/bin/env node` shebang — runs under either runtime.
- **No TypeScript** — plain JavaScript ESM. No `tsconfig.json`, no transpilation step.
- **No linter/formatter config** — no ESLint, Biome, Prettier, or Makefile. Code style is enforced by convention and review.
- **No lockfile committed** — `bun install` resolves at install time.
- **Published files**: `bin`, `docs`, `schemas`, `src`, `skills`, `README.md`, `LICENSE`.

### Version Alignment

Keep version metadata aligned across:
- `package.json`
- `.codex-plugin/plugin.json`
- `.claude-plugin/plugin.json`

## Testing & QA

### Framework

Bun's built-in test runner (`bun:test`). No Jest, Vitest, or external test config. Tests import `{ describe, expect, test }` from `"bun:test"`.

### Running Tests

```shell
bun run test                 # bun test test/*.test.js
bun run test:coverage        # tests + lcov coverage + 100% gate + fallback check
```

### Test Files

| File | Tests | What It Covers |
|------|-------|----------------|
| `test/cli.test.js` | 23 | CLI surface: arg parsing, help, all commands round-trip, failure paths, fallback binary smoke test; universe commands (init/scan/validate/report) and story-root invocation |
| `test/story.test.js` | 169 | Project lifecycle: create/scan/reindex/validate/links/export/build, schema/frontmatter contract violations, entity CRUD, symlink traversal refusals, epub/docx binary builds; universe scaffold, resolution, validation, scan/report, regression, path safety, coverage gaps |
| `test/frontmatter.test.js` | 6 | YAML frontmatter parse/stringify round-trip, scalar/array/object types, error paths |
| `test/import.test.js` | 4 | Manuscript import from file/directory, name candidate extraction, rejection paths |
| `test/continuity.test.js` | 3 | Continuity engine: dead characters, cast mismatches, numbering gaps, promise/question/completion/state contradictions |
| `test/markdown.test.js` | 3 | `kebabCase`, `wordCount`, `chapterProse`, `extractSection` |
| `test/workflow-eval.test.js` | 1 | Black-box "first story" workflow: init → add ×10 → wordcount → validate → links → next → build |
| `test/helpers.js` | — | Shared utilities: `makeTempDir()`, `memoryIo(cwd)`, `writeMarkdown(path, fm, body)` |

### Testing Patterns

- **No hooks**: No `beforeEach`/`afterAll` — each test does inline setup/teardown.
- **Isolation**: Filesystem tests use `makeTempDir()` → `os.tmpdir()/story-skills-*` per test; parallel-safe.
- **CLI testing**: `invoke(cwd, argv)` wraps `runCli` with `memoryIo(cwd)` capturing stdout/stderr → `{ code, out, err }`.
- **Assertions**: Inline `toContain` / `toEqual` / `toThrow` — no snapshot files, no `.snap` directories, no fixture data.
- **Test types**: Pure unit (frontmatter, markdown), module-integration (story, continuity, import), CLI e2e (cli), workflow smoke (workflow-eval).

### Coverage Gate

100% line + function coverage on every `src/*.js` file, enforced by `scripts/check-coverage.js`. Parses `coverage/lcov.info`, builds a per-file map, and requires `lines.found === lines.hit` AND `functions.found === functions.hit` for every source file. Exits non-zero with a failure list if any file is missing or under-covered.

### Quality Gates Summary

| Script | Gate |
|--------|------|
| `bun run test` | Test suite passes |
| `bun run test:coverage` | Tests + 100% coverage + fallback current |
| `bun run check:fallback` | Committed fallback byte-matches fresh build |
| `bun run check:metadata` | Plugin metadata consistency |
| `bun run test:examples` | Example projects validate via CLI |

### Before Finishing Changes

- Run the relevant tests: `bun run test`.
- If `src/` changed: `bun run build:fallback` then `bun run check:fallback`.
- Verify fallback runs under Node: `node skills/story-maintenance/scripts/story.js --help`.
- If CLI behavior changed: `bun run test:coverage`.
- Keep examples valid: `bun run test:examples`.
