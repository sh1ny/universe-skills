# Universe Scaffold Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add an opt-in universe container above story projects with cross-level entity resolution, validation, and a `story universe` command group.

**Architecture:** A `universe.md` file sits in a parent directory above story projects. `scanProject` is extended to optionally scan universe entities into a separate `project.universe` snapshot field. A new `story universe` command group (init/scan/validate/report) handles universe-level operations. Universe entity scanning uses `universeRoot` as its root argument (not `storyRoot`) for path-safety isolation.

**Tech Stack:** Bun/Node ESM, synchronous I/O (`fs.readFileSync`/`fs.writeFileSync`), no external dependencies, `bun:test` testing framework.

## Global Constraints

- Fully synchronous — no `Promise`, `async`/`await`, or streams
- No external runtime dependencies — only `node:fs`, `node:path`, `node:buffer`
- Named exports only — no `default` exports
- `node:` prefix required for all built-in imports
- All writes go through `assertLexicallyInsideRoot` — universe writes use `universeRoot`, story writes use `storyRoot`
- `writeChanged()` for idempotent writes — running twice is a no-op
- 100% line + function coverage on every `src/*.js` file
- After changing `src/`: run `bun run build:fallback` then `bun run check:fallback`
- Universe is opt-in and additive — existing projects must behave identically when no universe is present

---
## Source Artifacts

This plan was built from the following dependency artifacts in this change directory:

- `tasks.md` — implementation checklist this plan decomposes (items 1.1 through 10.7)
- `design.md` — architectural decisions (D1–D12) and design rationale
- `specs/universe-scaffold/spec.md` — formal requirements and acceptance scenarios

---

## Task 1: Universe Scaffold Foundation

**Files:**
- Create: (none — all additions to existing file)
- Modify: `src/story.js` (add `export const` constants after line 58, add `universeBible()` after line 901, add `createUniverseProject()` after line 138)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `STORY_SCHEMA_VERSION`, `kebabCase()`, `titleCaseSlug()`, `path`, `fs`, `stringifyFrontmatter()`, `writeFile()`, `ensureDirectory()`, `characterIndex()`, `worldIndex()`, `normalizeList()`
- Produces: `export const UNIVERSE_REQUIRED_PATHS`, `export const UNIVERSE_INDEX_SCHEMAS`, `export const UNIVERSE_REQUIRED_FRONTMATTER`, `universeBible(options) → string`, `createUniverseProject(options) → { root, universeId, files }`

- [ ] **Step 1: Write the failing test**

```javascript
import {
  createUniverseProject,
  UNIVERSE_REQUIRED_PATHS,
  UNIVERSE_INDEX_SCHEMAS,
  UNIVERSE_REQUIRED_FRONTMATTER
} from "../src/story.js";

describe("universe scaffold", () => {
  test("UNIVERSE_REQUIRED_PATHS lists universe-scoped paths only", () => {
    expect(UNIVERSE_REQUIRED_PATHS).toEqual([
      "universe.md",
      "characters/_index.md",
      "worldbuilding/_index.md",
      "worldbuilding/locations",
      "worldbuilding/systems",
      "worldbuilding/factions",
      "worldbuilding/artifacts"
    ]);
  });

  test("UNIVERSE_INDEX_SCHEMAS maps registry files to types", () => {
    expect(UNIVERSE_INDEX_SCHEMAS).toEqual([
      [path.join("characters", "_index.md"), "character-registry"],
      [path.join("worldbuilding", "_index.md"), "world-registry"]
    ]);
  });

  test("UNIVERSE_REQUIRED_FRONTMATTER lists name and schema-version", () => {
    expect(UNIVERSE_REQUIRED_FRONTMATTER).toEqual(["name", "schema-version"]);
  });

  test("createUniverseProject creates universe.md with correct frontmatter", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    const universeMd = fs.readFileSync(path.join(result.root, "universe.md"), "utf8");
    expect(universeMd).toContain("name: Aetheria");
    expect(universeMd).toContain("schema-version: 2");
    expect(universeMd).toContain("genre:");
    expect(universeMd).toContain("tone:");
    expect(universeMd).toContain("themes:");
    expect(universeMd).toContain("# Aetheria");
    expect(universeMd).toContain("## Cosmological Overview");
    expect(universeMd).toContain("## Universe History");
    expect(universeMd).toContain("## Notes");
  });

  test("createUniverseProject creates all required subdirectories", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    for (const required of UNIVERSE_REQUIRED_PATHS) {
      expect(fs.existsSync(path.join(result.root, required))).toBe(true);
    }
  });

  test("createUniverseProject creates _index.md files with correct registry types", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    const charIndex = fs.readFileSync(path.join(result.root, "characters", "_index.md"), "utf8");
    expect(charIndex).toContain("type: character-registry");
    const worldIndex = fs.readFileSync(path.join(result.root, "worldbuilding", "_index.md"), "utf8");
    expect(worldIndex).toContain("type: world-registry");
  });

  test("createUniverseProject returns root, universeId, and files", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    expect(result.root).toBe(path.resolve(cwd));
    expect(result.files).toContain("universe.md");
  });

  test("createUniverseProject throws if universe.md already exists", () => {
    const cwd = makeTempDir();
    createUniverseProject({ name: "Aetheria", cwd });
    expect(() => createUniverseProject({ name: "Aetheria", cwd })).toThrow("already contains a universe.md");
  });

  test("createUniverseProject accepts genre, tone, and themes", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({
      name: "My Epic Universe",
      cwd,
      genre: "fantasy",
      tone: "epic",
      themes: ["hope", "sacrifice"]
    });
    const universeMd = fs.readFileSync(path.join(result.root, "universe.md"), "utf8");
    expect(universeMd).toContain("name: My Epic Universe");
    expect(universeMd).toContain("genre: fantasy");
    expect(universeMd).toContain("tone: epic");
    expect(universeMd).toContain("- hope");
    expect(universeMd).toContain("- sacrifice");
  });

  test("createUniverseProject converts kebab-case name to display name", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "my-epic-universe", cwd });
    const universeMd = fs.readFileSync(path.join(result.root, "universe.md"), "utf8");
    expect(universeMd).toContain("name: My Epic Universe");
    expect(result.universeId).toBe("my-epic-universe");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/story.test.js -t "universe scaffold"`
Expected: FAIL — `createUniverseProject`, `UNIVERSE_REQUIRED_PATHS`, `UNIVERSE_INDEX_SCHEMAS`, `UNIVERSE_REQUIRED_FRONTMATTER` are not exported

- [ ] **Step 3: Write minimal implementation**

Add `export const` constants after line 58 (after `TERM_CATEGORIES`):

```javascript
export const UNIVERSE_REQUIRED_PATHS = [
  "universe.md",
  "characters/_index.md",
  "worldbuilding/_index.md",
  "worldbuilding/locations",
  "worldbuilding/systems",
  "worldbuilding/factions",
  "worldbuilding/artifacts"
];

export const UNIVERSE_INDEX_SCHEMAS = [
  [path.join("characters", "_index.md"), "character-registry"],
  [path.join("worldbuilding", "_index.md"), "world-registry"]
];

export const UNIVERSE_REQUIRED_FRONTMATTER = ["name", "schema-version"];
```

Add `universeBible()` template function after `storyBible()` (after line 901):

```javascript
function universeBible(options) {
  const themes = normalizeList(options.themes, ["change"]);
  return `${stringifyFrontmatter({
    name: options.name,
    "schema-version": STORY_SCHEMA_VERSION,
    genre: options.genre ?? "fiction",
    tone: options.tone ?? "epic",
    themes
  })}# ${options.name}

## Cosmological Overview

Describe the fundamental nature of the universe — cosmology, physics, magic systems, and metaphysical laws.

## Universe History

Provide a high-level summary of major epochs, cataclysms, and civilizational arcs.

## Notes

`;
}
```

Add `createUniverseProject()` exported function after `createStoryProject()` (after line 138). Uses `ensureDirectory` with `root` for path-safety containment — `ensureDirectory` calls `assertLexicallyInsideRoot(directory, root)` before `mkdirSync`, enforcing the root boundary on every directory creation:

```javascript
export function createUniverseProject(options) {
  const name = String(options.name ?? "").trim();
  if (!name) {
    throw new Error("A universe name is required");
  }

  const universeId = kebabCase(name);
  const displayName = titleCaseSlug(universeId);
  const root = path.resolve(options.cwd ?? process.cwd(), options.dir ?? ".");
  if (fs.existsSync(path.join(root, "universe.md"))) {
    throw new Error(`${root} already contains a universe.md`);
  }

  const changed = [];
  ensureDirectory(path.join(root, "characters"), changed, root);
  ensureDirectory(path.join(root, "worldbuilding", "locations"), changed, root);
  ensureDirectory(path.join(root, "worldbuilding", "systems"), changed, root);
  ensureDirectory(path.join(root, "worldbuilding", "factions"), changed, root);
  ensureDirectory(path.join(root, "worldbuilding", "artifacts"), changed, root);

  writeFile(path.join(root, "universe.md"), universeBible({
    name: displayName,
    genre: options.genre ?? "fiction",
    tone: options.tone ?? "epic",
    themes: normalizeList(options.themes, ["change"])
  }), { root });
  writeFile(path.join(root, "characters", "_index.md"), characterIndex(universeId, [], "", ""), { root });
  writeFile(path.join(root, "worldbuilding", "_index.md"), worldIndex(universeId, [], [], [], [], ""), { root });

  return { root, universeId, files: UNIVERSE_REQUIRED_PATHS.filter((entry) => entry.endsWith(".md")) };
}
```

> **Note on `ensureDirectory` vs `fs.mkdirSync`:** `createStoryProject()` (line 103) uses raw `fs.mkdirSync` for initial directory creation because it predates the `ensureDirectory` helper. `createUniverseProject` uses `ensureDirectory` instead, which calls `assertLexicallyInsideRoot(directory, root)` before `mkdirSync` — enforcing the root boundary on every directory creation. The `changed` array tracks created directories for potential future use but is not returned in the result (matching `createStoryProject`'s pattern of not tracking directory creation).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/story.test.js -t "universe scaffold"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/story.js test/story.test.js
git commit -m "feat: add universe scaffold foundation (constants, universeBible, createUniverseProject)"
```

---

## Task 2: Universe Resolution and Scan Extension

**Files:**
- Create: (none)
- Modify: `src/story.js` (add `resolveUniverseRoot()` and `scanUniverse()` after line 261, refactor `scanProject()` return at line 145 to conditionally attach `project.universe`)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `readEntityFiles(root, relativeDir, mapEntity)`, `readMarkdown(filePath, root)`, `path`, `fs`, `asArray()`, `titleCaseSlug()`, `kebabCase()`
- Produces: `resolveUniverseRoot(targetPath) → string|null`, `scanUniverse(universeRoot) → { characters, locations, systems, factions, artifacts }`, extended `scanProject(root)` with optional `project.universe` and `project.universeRoot`

- [ ] **Step 1: Write the failing test**

```javascript
import {
  resolveUniverseRoot,
  scanUniverse,
  scanProject,
  createUniverseProject,
  createStoryProject
} from "../src/story.js";

describe("universe resolution", () => {
  test("resolveUniverseRoot returns path when universe.md exists at target", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    expect(resolveUniverseRoot(result.root)).toBe(result.root);
  });

  test("resolveUniverseRoot walks up to find universe.md from story root", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storyRoot = path.join(universeResult.root, "stories", "my-story");
    fs.mkdirSync(storyRoot, { recursive: true });
    expect(resolveUniverseRoot(storyRoot)).toBe(universeResult.root);
  });

  test("resolveUniverseRoot returns null when no universe.md is found", () => {
    const cwd = makeTempDir();
    expect(resolveUniverseRoot(cwd)).toBeNull();
  });

  test("scanProject populates project.universe when universe is linked", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storyRoot = path.join(universeResult.root, "stories", "my-story");
    fs.mkdirSync(path.dirname(storyRoot), { recursive: true });
    createStoryProject({ title: "My Story", cwd: path.dirname(storyRoot), dir: "my-story" });

    // Manually inject the universe field — Task 3's auto-detection is not yet implemented.
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    const withUniverse = storyMd.replace("status: planning", "status: planning\nuniverse: aetheria");
    fs.writeFileSync(storyMdPath, withUniverse, "utf8");

    writeMarkdown(path.join(universeResult.root, "characters", "ancient-one.md"), `
name: "Ancient One"
role: supporting
status: alive
`, "# Ancient One\n");

    const project = scanProject(storyRoot);
    expect(project.universe).toBeDefined();
    expect(project.universeRoot).toBe(universeResult.root);
    expect(project.universe.characters).toHaveLength(1);
    expect(project.universe.characters[0].id).toBe("ancient-one");
  });

  test("scanProject leaves project.universe absent when no universe field in story.md", () => {
    const cwd = makeTempDir();
    createStoryProject({ title: "Standalone", cwd });
    const project = scanProject(path.join(cwd, "standalone"));
    expect(project.universe).toBeUndefined();
    expect(project.universeRoot).toBeUndefined();
  });

  test("scanProject leaves project.universe absent when universe field set but resolveUniverseRoot returns null", () => {
    const cwd = makeTempDir();
    createStoryProject({ title: "Orphaned", cwd });
    const storyMdPath = path.join(cwd, "orphaned", "story.md");
    const content = fs.readFileSync(storyMdPath, "utf8");
    const withUniverse = content.replace("status: planning", "status: planning\nuniverse: missing-universe");
    fs.writeFileSync(storyMdPath, withUniverse, "utf8");
    const project = scanProject(path.join(cwd, "orphaned"));
    expect(project.universe).toBeUndefined();
  });

  test("scanUniverse returns all five entity types from universe root", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });

    writeMarkdown(path.join(result.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");
    writeMarkdown(path.join(result.root, "worldbuilding", "locations", "sacred-mountain.md"), `
name: "Sacred Mountain"
type: wilderness
region: Center
`, "# Mountain\n");
    writeMarkdown(path.join(result.root, "worldbuilding", "systems", "high-magic.md"), `
name: "High Magic"
type: magic
`, "# High Magic\n");
    writeMarkdown(path.join(result.root, "worldbuilding", "factions", "ancient-order.md"), `
name: "Ancient Order"
type: religion
status: active
`, "# Order\n");
    writeMarkdown(path.join(result.root, "worldbuilding", "artifacts", "eternal-flame.md"), `
name: "Eternal Flame"
type: relic
status: active
`, "# Flame\n");

    const entities = scanUniverse(result.root);
    expect(entities.characters).toHaveLength(1);
    expect(entities.locations).toHaveLength(1);
    expect(entities.systems).toHaveLength(1);
    expect(entities.factions).toHaveLength(1);
    expect(entities.artifacts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/story.test.js -t "universe resolution"`
Expected: FAIL — `resolveUniverseRoot`, `scanUniverse` are not exported

- [ ] **Step 3: Write minimal implementation**

Add `resolveUniverseRoot()` after `scanProject()` (after line 261):

```javascript
export function resolveUniverseRoot(targetPath) {
  let current = path.resolve(targetPath);
  if (fs.existsSync(path.join(current, "universe.md"))) {
    return current;
  }

  while (true) {
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
    if (fs.existsSync(path.join(current, "universe.md"))) {
      return current;
    }
  }
}
```

Add `scanUniverse()` after `resolveUniverseRoot()`. Universe root is passed as the `root` argument to `readEntityFiles`/`readMarkdown`/`assertLexicallyInsideRoot` — never `storyRoot` (design decision D12: path-safety boundary):

```javascript
export function scanUniverse(universeRoot) {
  const resolvedRoot = path.resolve(universeRoot);
  return {
    characters: readEntityFiles(resolvedRoot, "characters", (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      role: data.role ?? "",
      status: data.status ?? "",
      diedIn: data["died-in"] ?? "",
      relationships: asArray(data.relationships),
      locations: asArray(data.locations)
    })),
    locations: readEntityFiles(resolvedRoot, path.join("worldbuilding", "locations"), (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      type: data.type ?? "",
      region: data.region ?? "",
      notableCharacters: asArray(data["notable-characters"])
    })),
    systems: readEntityFiles(resolvedRoot, path.join("worldbuilding", "systems"), (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      type: data.type ?? ""
    })),
    factions: readEntityFiles(resolvedRoot, path.join("worldbuilding", "factions"), (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      type: data.type ?? "",
      status: data.status ?? "",
      members: asArray(data.members),
      locations: asArray(data.locations)
    })),
    artifacts: readEntityFiles(resolvedRoot, path.join("worldbuilding", "artifacts"), (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      type: data.type ?? "",
      status: data.status ?? "",
      owner: data.owner ?? "",
      location: data.location ?? ""
    }))
  };
}
```

Refactor `scanProject()` — replace the `return { ... };` block (lines 145-261) to build a `const project = { ... };`, then conditionally attach universe fields before returning:

```javascript
export function scanProject(root) {
  const projectRoot = path.resolve(root);
  const story = readMarkdown(path.join(projectRoot, "story.md"), projectRoot);
  const storyId = kebabCase(story.data.title ?? path.basename(projectRoot));

  const project = {
    root: projectRoot,
    story,
    storyId,
    characters: readEntityFiles(projectRoot, "characters", (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      role: data.role ?? "",
      status: data.status ?? "",
      diedIn: data["died-in"] ?? "",
      relationships: asArray(data.relationships),
      locations: asArray(data.locations)
    })),
    locations: readEntityFiles(projectRoot, path.join("worldbuilding", "locations"), (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      type: data.type ?? "",
      region: data.region ?? "",
      notableCharacters: asArray(data["notable-characters"])
    })),
    systems: readEntityFiles(projectRoot, path.join("worldbuilding", "systems"), (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      type: data.type ?? ""
    })),
    factions: readEntityFiles(projectRoot, path.join("worldbuilding", "factions"), (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      type: data.type ?? "",
      status: data.status ?? "",
      members: asArray(data.members),
      locations: asArray(data.locations)
    })),
    artifacts: readEntityFiles(projectRoot, path.join("worldbuilding", "artifacts"), (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      type: data.type ?? "",
      status: data.status ?? "",
      owner: data.owner ?? "",
      location: data.location ?? ""
    })),
    arcs: readEntityFiles(projectRoot, path.join("plot", "arcs"), (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      type: data.type ?? "",
      status: data.status ?? "",
      characters: asArray(data.characters),
      themes: asArray(data.themes)
    })),
    chapters: readEntityFiles(projectRoot, "chapters", (id, file, data, markdown) => ({
      id,
      file,
      title: data.title ?? titleCaseSlug(id),
      number: Number(data.number ?? chapterNumberFromFile(file) ?? 0),
      pov: data.pov ?? "",
      status: data.status ?? "",
      characters: asArray(data.characters),
      mentions: asArray(data.mentions),
      locations: asArray(data.locations),
      arcsAdvanced: asArray(data["arcs-advanced"]),
      declaredWordCount: Number(data["word-count"] ?? 0),
      wordCount: wordCount(chapterProse(markdown.body))
    })).sort((left, right) => left.number - right.number || left.file.localeCompare(right.file)),
    scenes: readEntityFiles(projectRoot, "scenes", (id, file, data) => ({
      id,
      file,
      title: data.title ?? titleCaseSlug(id),
      chapter: String(data.chapter ?? ""),
      scene: Number(data.scene ?? sceneNumberFromFile(file) ?? 0),
      pov: data.pov ?? "",
      location: data.location ?? "",
      status: data.status ?? "",
      characters: asArray(data.characters),
      mentions: asArray(data.mentions),
      arcsAdvanced: asArray(data["arcs-advanced"]),
      stateChanges: asArray(data["state-changes"])
    })).sort((left, right) => left.chapter.localeCompare(right.chapter) || left.scene - right.scene || left.file.localeCompare(right.file)),
    questions: readEntityFiles(projectRoot, path.join("continuity", "questions"), (id, file, data) => ({
      id,
      file,
      title: data.title ?? titleCaseSlug(id),
      status: data.status ?? "",
      introduced: data.introduced ?? "",
      resolved: data.resolved ?? "",
      characters: asArray(data.characters)
    })),
    promises: readEntityFiles(projectRoot, path.join("continuity", "promises"), (id, file, data) => ({
      id,
      file,
      title: data.title ?? titleCaseSlug(id),
      status: data.status ?? "",
      planted: data.planted ?? "",
      payoff: data.payoff ?? "",
      arcs: asArray(data.arcs),
      characters: asArray(data.characters)
    })),
    glossaryTerms: readEntityFiles(projectRoot, path.join("glossary", "terms"), (id, file, data) => ({
      id,
      file,
      term: data.term ?? titleCaseSlug(id),
      category: data.category ?? "",
      aliases: asArray(data.aliases)
    })),
    continuity: fs.existsSync(path.join(projectRoot, "continuity", "state.md"))
      ? readMarkdown(path.join(projectRoot, "continuity", "state.md"), projectRoot)
      : null
  };

  if (story.data.universe) {
    const universeRoot = resolveUniverseRoot(projectRoot);
    if (universeRoot) {
      project.universe = scanUniverse(universeRoot);
      project.universeRoot = universeRoot;
    }
  }

  return project;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/story.test.js -t "universe resolution"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/story.js test/story.test.js
git commit -m "feat: add resolveUniverseRoot, scanUniverse, and scanProject universe extension"
```

---

## Task 3: Story Init Auto-Detection

**Files:**
- Create: (none)
- Modify: `src/story.js` (update `createStoryProject()` at lines 90-138, update `storyBible()` at lines 877-901)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `resolveUniverseRoot()`, `readMarkdown(filePath, root)`, `kebabCase()`
- Produces: `createStoryProject()` now writes `universe: <id>` frontmatter when a universe is detected above the target root; `storyBible()` accepts optional `universe` field

- [ ] **Step 1: Write the failing test**

```javascript
describe("story init universe auto-detection", () => {
  test("createStoryProject inside universe writes universe field to story.md", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });

    const storyMd = fs.readFileSync(path.join(storiesDir, "my-tale", "story.md"), "utf8");
    expect(storyMd).toContain("universe: aetheria");
  });

  test("createStoryProject outside universe has no universe field in story.md", () => {
    const cwd = makeTempDir();
    createStoryProject({ title: "Standalone", cwd });
    const storyMd = fs.readFileSync(path.join(cwd, "standalone", "story.md"), "utf8");
    expect(storyMd).not.toContain("universe:");
  });

  test("createStoryProject outside universe produces identical output to current behavior", () => {
    const cwd = makeTempDir();
    createStoryProject({ title: "Plain Story", cwd });
    const root = path.join(cwd, "plain-story");
    const project = scanProject(root);
    expect(project.universe).toBeUndefined();
    expect(project.universeRoot).toBeUndefined();
    expect(project.storyId).toBe("plain-story");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/story.test.js -t "story init universe auto-detection"`
Expected: FAIL — `story.md` does not contain `universe` field when created inside a universe directory

- [ ] **Step 3: Write minimal implementation**

Update `createStoryProject()` — after resolving the root (line 97) and before creating directories, add universe detection. Then pass `universe: universeId` into `storyBible()`:

```javascript
export function createStoryProject(options) {
  const title = String(options.title ?? "").trim();
  if (!title) {
    throw new Error("A story title is required");
  }

  const storyId = kebabCase(title);
  const root = path.resolve(options.cwd ?? process.cwd(), options.dir ?? storyId);
  if (fs.existsSync(root) && !options.force) {
    throw new Error(`${root} already exists. Use --force to overwrite starter files.`);
  }

  const themes = normalizeList(options.themes, ["change"]);

  // Universe auto-detection: walk up from target root to find universe.md
  const universeRoot = resolveUniverseRoot(root);
  let universeId = null;
  if (universeRoot) {
    const universeMd = readMarkdown(path.join(universeRoot, "universe.md"), universeRoot);
    if (universeMd.data.name) {
      universeId = kebabCase(universeMd.data.name);
    }
  }

  fs.mkdirSync(path.join(root, "characters"), { recursive: true });
  fs.mkdirSync(path.join(root, "worldbuilding", "locations"), { recursive: true });
  fs.mkdirSync(path.join(root, "worldbuilding", "systems"), { recursive: true });
  fs.mkdirSync(path.join(root, "worldbuilding", "factions"), { recursive: true });
  fs.mkdirSync(path.join(root, "worldbuilding", "artifacts"), { recursive: true });
  fs.mkdirSync(path.join(root, "plot", "arcs"), { recursive: true });
  fs.mkdirSync(path.join(root, "chapters"), { recursive: true });
  fs.mkdirSync(path.join(root, "scenes"), { recursive: true });
  fs.mkdirSync(path.join(root, "continuity", "questions"), { recursive: true });
  fs.mkdirSync(path.join(root, "continuity", "promises"), { recursive: true });
  fs.mkdirSync(path.join(root, "glossary", "terms"), { recursive: true });

  writeFile(path.join(root, "story.md"), storyBible({
    title,
    storyId,
    genre: options.genre ?? "fiction",
    subGenre: options.subGenre ?? "general",
    settingEra: options.settingEra ?? "unspecified",
    themes,
    pov: options.pov ?? "third-person-limited",
    tense: options.tense ?? "past",
    synopsis: options.synopsis ?? "Add a 2-3 sentence synopsis here.",
    universe: universeId
  }), { root });
  writeFile(path.join(root, "characters", "_index.md"), characterIndex(storyId, [], "", ""), { root });
  writeFile(path.join(root, "worldbuilding", "_index.md"), worldIndex(storyId, [], [], [], [], ""), { root });
  writeFile(path.join(root, "plot", "_index.md"), plotIndex(storyId, "three-act", [], "", ""), { root });
  writeFile(path.join(root, "plot", "timeline.md"), timeline(storyId), { root });
  writeFile(path.join(root, "chapters", "_index.md"), chapterIndex(storyId, []), { root });
  writeFile(path.join(root, "scenes", "_index.md"), sceneIndex(storyId, []), { root });
  writeFile(path.join(root, "continuity", "state.md"), continuityState(storyId), { root });
  writeFile(path.join(root, "continuity", "questions", "_index.md"), questionIndex(storyId, []), { root });
  writeFile(path.join(root, "continuity", "promises", "_index.md"), promiseIndex(storyId, []), { root });
  writeFile(path.join(root, "glossary", "_index.md"), glossaryIndex(storyId, []), { root });

  return { root, storyId, files: REQUIRED_PATHS.filter((entry) => entry.endsWith(".md")) };
}
```

Update `storyBible()` (line 877) to conditionally include the `universe` field:

```javascript
function storyBible(options) {
  const frontmatter = {
    title: options.title,
    "schema-version": STORY_SCHEMA_VERSION,
    genre: options.genre,
    "sub-genre": options.subGenre,
    "setting-era": options.settingEra,
    status: "planning",
    themes: options.themes,
    pov: options.pov,
    tense: options.tense
  };
  if (options.universe) {
    frontmatter.universe = options.universe;
  }
  return `${stringifyFrontmatter(frontmatter)}# ${options.title}

## Synopsis

${options.synopsis}

## Tone & Style

Add notes on the story's voice, texture, and emotional register.

## Notes

`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/story.test.js -t "story init universe auto-detection"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/story.js test/story.test.js
git commit -m "feat: auto-detect universe in createStoryProject and write universe frontmatter field"
```

---

## Task 4: Universe Validation Engine

**Files:**
- Create: (none)
- Modify: `src/story.js` (add `validateUniverse()` after `validateLinks()` at line 481)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `resolveUniverseRoot()`, `scanUniverse()`, `scanProject()`, `readMarkdown()`, `isKebabId()`, `requireFields()`, `UNIVERSE_REQUIRED_FRONTMATTER`, `path`, `fs`
- Produces: `validateUniverse(root) → { ok: boolean, errors: string[], warnings: string[] }`

- [ ] **Step 1: Write the failing test**

```javascript
import { validateUniverse, validateUniverseIds } from "../src/story.js";

describe("universe validation", () => {
  test("returns clean result when no universe field and no universe.md", () => {
    const cwd = makeTempDir();
    createStoryProject({ title: "Standalone", cwd });
    const result = validateUniverse(path.join(cwd, "standalone"));
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test("emits warning when story.md has universe field but universe.md not found", () => {
    const cwd = makeTempDir();
    createStoryProject({ title: "Orphaned", cwd });
    const storyMdPath = path.join(cwd, "orphaned", "story.md");
    const content = fs.readFileSync(storyMdPath, "utf8");
    const withUniverse = content.replace("status: planning", "status: planning\nuniverse: missing-universe");
    fs.writeFileSync(storyMdPath, withUniverse, "utf8");
    const result = validateUniverse(path.join(cwd, "orphaned"));
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("Universe 'missing-universe' not found"))).toBe(true);
  });

  test("validates universe entity ids are kebab-case", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(result.root, "characters", "Bad_Id.md"), `
name: "Bad Id"
role: supporting
status: alive
`, "# Bad\n");
    const validation = validateUniverse(result.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("kebab-case"))).toBe(true);
  });

  test("validates universe.md frontmatter completeness", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    const universeMdPath = path.join(result.root, "universe.md");
    const content = fs.readFileSync(universeMdPath, "utf8");
    const broken = content.replace(/name: Aetheria\n/, "");
    fs.writeFileSync(universeMdPath, broken, "utf8");
    const validation = validateUniverse(result.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("name"))).toBe(true);
  });

  test("cross-level reference to universe location resolves from story root", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });

    writeMarkdown(path.join(universeResult.root, "worldbuilding", "locations", "sacred-mountain.md"), `
name: "Sacred Mountain"
type: wilderness
region: Center
notable-characters:
  - my-tale-hero
`, "# Mountain\n");

    writeMarkdown(path.join(universeResult.root, "characters", "my-tale-hero.md"), `
name: "Hero"
role: protagonist
status: alive
locations:
  - sacred-mountain
`, "# Hero\n");

    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "characters", "story-hero.md"), `
name: "Story Hero"
role: protagonist
status: alive
locations:
  - sacred-mountain
`, "# Story Hero\n");

    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  test("broken cross-level reference errors from story root", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });

    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "characters", "story-hero.md"), `
name: "Story Hero"
role: protagonist
status: alive
locations:
  - nonexistent-place
`, "# Story Hero\n");

    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'locations: nonexistent-place' does not resolve"))).toBe(true);
  });

  test("id shadowing between story and universe errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });

    writeMarkdown(path.join(universeResult.root, "characters", "shared-hero.md"), `
name: "Universe Hero"
role: supporting
status: alive
`, "# Universe Hero\n");

    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "characters", "shared-hero.md"), `
name: "Story Hero"
role: protagonist
status: alive
`, "# Story Hero\n");

    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Entity id 'shared-hero' exists at both story and universe level — shadowing is not allowed"))).toBe(true);
  });

  test("validateUniverse from universe root only runs id and frontmatter checks", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(result.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");
    const validation = validateUniverse(result.root);
    expect(validation.ok).toBe(true);
  });

  test("validateUniverseIds catches duplicate ids with synthetic array", () => {
    const errors = [];
    validateUniverseIds(
      [{ id: "the-old-gods", file: "a", name: "Old Gods" }, { id: "the-old-gods", file: "b", name: "Old Gods 2" }],
      "characters",
      errors
    );
    expect(errors.length).toBe(1);
    expect(errors[0]).toBe("Duplicate entity id 'the-old-gods' in universe characters");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/story.test.js -t "universe validation"`
Expected: FAIL — `validateUniverse` is not exported

- [ ] **Step 3: Write minimal implementation**

Add `validateUniverse()` after `validateLinks()` (after line 481). Dual-mode: works from a universe root (no `story.md`) or a story root (has `story.md` with `universe` field). Universe scanning always uses `universeRoot` as the root argument — never `storyRoot` (D12 path-safety boundary):

```javascript
export function validateUniverseIds(entities, type, errors) {
  const seen = new Set();
  for (const entity of entities) {
    if (!isKebabId(entity.id)) {
      errors.push(`Universe entity id must be kebab-case: ${entity.id} (${type})`);
    }
    if (seen.has(entity.id)) {
      errors.push(`Duplicate entity id '${entity.id}' in universe ${type}`);
    }
    seen.add(entity.id);
  }
}

export function validateUniverse(root) {
  const resolvedRoot = path.resolve(root);
  const errors = [];
  const warnings = [];

  // Determine if we are in a story root (has story.md)
  const isStoryRoot = fs.existsSync(path.join(resolvedRoot, "story.md"));
  let storyData = null;
  if (isStoryRoot) {
    const story = readMarkdown(path.join(resolvedRoot, "story.md"), resolvedRoot);
    storyData = story.data;
  }

  // Rule 4.6: Universe resolution warning
  // If story.md has a universe field but resolveUniverseRoot returns null
  if (isStoryRoot && storyData.universe) {
    const universeRoot = resolveUniverseRoot(resolvedRoot);
    if (universeRoot === null) {
      warnings.push(`Universe '${storyData.universe}' not found — story works in standalone mode`);
      return { ok: true, errors, warnings };
    }
  }

  // If no story.md and no universe.md, nothing to validate
  const universeRoot = resolveUniverseRoot(resolvedRoot);
  if (universeRoot === null) {
    return { ok: true, errors, warnings };
  }

  // Scan universe entities using universeRoot (NOT storyRoot — D12 path-safety)
  const universeEntities = scanUniverse(universeRoot);

  // Rule 4.5: universe.md frontmatter completeness check
  const universeMd = readMarkdown(path.join(universeRoot, "universe.md"), universeRoot);
  for (const field of UNIVERSE_REQUIRED_FRONTMATTER) {
    if (universeMd.data[field] === undefined || universeMd.data[field] === "") {
      errors.push(`universe.md missing required frontmatter field: ${field}`);
    }
  }

  // Rule 4.3: Universe entity id validation — kebab-case and uniqueness.
  // Use a testable helper so the uniqueness branch can be covered with
  // synthetic arrays without needing duplicate filenames on disk.
  const entityTypes = ["characters", "locations", "systems", "factions", "artifacts"];
  for (const type of entityTypes) {
    validateUniverseIds(universeEntities[type], type, errors);
  }

  // Rules 4.2 and 4.4: Cross-level checks (only when story context is available)
  if (isStoryRoot) {
    const project = scanProject(resolvedRoot);

    // Rule 4.4: No-shadowing validation
    for (const type of entityTypes) {
      const storyIds = new Set(project[type].map((e) => e.id));
      for (const entity of universeEntities[type]) {
        if (storyIds.has(entity.id)) {
          errors.push(`Entity id '${entity.id}' exists at both story and universe level — shadowing is not allowed`);
        }
      }
    }

    // Rule 4.2: Cross-level reference resolution
    // Build combined maps: story-level takes precedence — if found at story level,
    // universe level is not consulted. JS new Map() keeps the LAST value for duplicate
    // keys, so universe entries are spread first and story entries second, ensuring
    // story-level overrides universe-level for any shared id. Existence-only check,
    // NO backlink enforcement.
    const combinedCharacters = new Map([
      ...universeEntities.characters.map((c) => [c.id, c]),
      ...project.characters.map((c) => [c.id, c])
    ]);
    const combinedLocations = new Map([
      ...universeEntities.locations.map((l) => [l.id, l]),
      ...project.locations.map((l) => [l.id, l])
    ]);
    const combinedFactions = new Map([
      ...universeEntities.factions.map((f) => [f.id, f]),
      ...project.factions.map((f) => [f.id, f])
    ]);

    // Check story entity references against combined maps
    for (const character of project.characters) {
      for (const relationship of character.relationships) {
        if (!combinedCharacters.has(relationship.character)) {
          errors.push(`Cross-level reference 'character: ${relationship.character}' does not resolve at story or universe level`);
        }
      }
      for (const locationId of character.locations) {
        if (!combinedLocations.has(locationId)) {
          errors.push(`Cross-level reference 'locations: ${locationId}' does not resolve at story or universe level`);
        }
      }
    }

    for (const location of project.locations) {
      for (const characterId of location.notableCharacters) {
        if (!combinedCharacters.has(characterId)) {
          errors.push(`Cross-level reference 'notable-characters: ${characterId}' does not resolve at story or universe level`);
        }
      }
    }

    for (const faction of project.factions) {
      for (const characterId of faction.members) {
        if (!combinedCharacters.has(characterId)) {
          errors.push(`Cross-level reference 'members: ${characterId}' does not resolve at story or universe level`);
        }
      }
      for (const locationId of faction.locations) {
        if (!combinedLocations.has(locationId)) {
          errors.push(`Cross-level reference 'locations: ${locationId}' does not resolve at story or universe level`);
        }
      }
    }

    for (const artifact of project.artifacts) {
      if (artifact.owner && !combinedCharacters.has(artifact.owner) && !combinedFactions.has(artifact.owner)) {
        errors.push(`Cross-level reference 'owner: ${artifact.owner}' does not resolve at story or universe level`);
      }
      if (artifact.location && !combinedLocations.has(artifact.location)) {
        errors.push(`Cross-level reference 'location: ${artifact.location}' does not resolve at story or universe level`);
      }
    }

  }

  return { ok: errors.length === 0, errors, warnings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/story.test.js -t "universe validation"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/story.js test/story.test.js
git commit -m "feat: add validateUniverse with cross-level reference resolution, shadowing, and frontmatter checks"
```

---

## Task 5: Universe Scan and Report

**Files:**
- Create: (none)
- Modify: `src/story.js` (add four functions after `formatProjectReport()` at line 596)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `resolveUniverseRoot()`, `scanUniverse()`, `validateUniverse()`, `formatCheck()`, `path`
- Produces: `universeScan(root) → { id, name, type, file }[] | null`, `formatUniverseScan(result) → string`, `universeReport(root) → { counts, total, validation } | null`, `formatUniverseReport(report) → string`

- [ ] **Step 1: Write the failing test**

```javascript
import {
  universeScan,
  formatUniverseScan,
  universeReport,
  formatUniverseReport
} from "../src/story.js";

describe("universe scan and report", () => {
  test("universeScan returns compact entity list from universe root", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(result.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");
    writeMarkdown(path.join(result.root, "worldbuilding", "locations", "sacred-mountain.md"), `
name: "Sacred Mountain"
type: wilderness
region: Center
`, "# Mountain\n");

    const scan = universeScan(result.root);
    expect(scan).not.toBeNull();
    expect(scan).toHaveLength(2);
    const legend = scan.find((e) => e.id === "legend");
    expect(legend).toBeDefined();
    expect(legend.name).toBe("Legend");
    expect(legend.type).toBe("character");
    expect(legend.file).toBe(path.join("characters", "legend.md"));
    const mountain = scan.find((e) => e.id === "sacred-mountain");
    expect(mountain.type).toBe("location");
  });

  test("universeScan resolves from story root by walking up", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");

    const scan = universeScan(path.join(storiesDir, "my-tale"));
    expect(scan).not.toBeNull();
    expect(scan).toHaveLength(1);
    expect(scan[0].id).toBe("legend");
  });

  test("universeScan returns null when no universe found", () => {
    const cwd = makeTempDir();
    expect(universeScan(cwd)).toBeNull();
  });

  test("formatUniverseScan outputs one line per entity", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(result.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");

    const formatted = formatUniverseScan(universeScan(result.root));
    expect(formatted).toContain("legend");
    expect(formatted).toContain("Legend");
    expect(formatted).toContain("character");
    expect(formatted).toContain(path.join("characters", "legend.md"));
  });

  test("formatUniverseScan reports no universe found", () => {
    const formatted = formatUniverseScan(null);
    expect(formatted).toContain("No universe found");
  });

  test("universeReport returns counts per type and total", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(result.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");
    writeMarkdown(path.join(result.root, "worldbuilding", "locations", "mountain.md"), `
name: "Mountain"
type: wilderness
region: North
`, "# Mountain\n");

    const report = universeReport(result.root);
    expect(report).not.toBeNull();
    expect(report.counts.characters).toBe(1);
    expect(report.counts.locations).toBe(1);
    expect(report.counts.systems).toBe(0);
    expect(report.counts.factions).toBe(0);
    expect(report.counts.artifacts).toBe(0);
    expect(report.total).toBe(2);
    expect(report.validation).toBeDefined();
  });

  test("universeReport returns null when no universe found", () => {
    const cwd = makeTempDir();
    expect(universeReport(cwd)).toBeNull();
  });

  test("universeReport on empty universe reports zero for each type", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    const report = universeReport(result.root);
    expect(report.counts.characters).toBe(0);
    expect(report.counts.locations).toBe(0);
    expect(report.counts.systems).toBe(0);
    expect(report.counts.factions).toBe(0);
    expect(report.counts.artifacts).toBe(0);
    expect(report.total).toBe(0);
  });

  test("formatUniverseReport outputs counts, total, and validation", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(result.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");

    const formatted = formatUniverseReport(universeReport(result.root));
    expect(formatted).toContain("Characters:");
    expect(formatted).toContain("Total entities:");
    expect(formatted).toContain("Validation:");
  });

  test("formatUniverseReport reports no universe found", () => {
    const formatted = formatUniverseReport(null);
    expect(formatted).toContain("No universe found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/story.test.js -t "universe scan and report"`
Expected: FAIL — `universeScan`, `formatUniverseScan`, `universeReport`, `formatUniverseReport` are not exported

- [ ] **Step 3: Write minimal implementation**

Add four functions after `formatProjectReport()` (after line 596). `universeScan` resolves `universeRoot` via `resolveUniverseRoot(root)` and calls `scanUniverse(universeRoot)` directly — NOT `scanProject` (a universe root has `universe.md` but no `story.md`, so `scanProject` would fail):

```javascript
export function universeScan(root) {
  const universeRoot = resolveUniverseRoot(root);
  if (universeRoot === null) {
    return null;
  }

  const entities = scanUniverse(universeRoot);
  const compact = [];

  for (const character of entities.characters) {
    compact.push({ id: character.id, name: character.name, type: "character", file: path.relative(universeRoot, character.file) });
  }
  for (const location of entities.locations) {
    compact.push({ id: location.id, name: location.name, type: "location", file: path.relative(universeRoot, location.file) });
  }
  for (const system of entities.systems) {
    compact.push({ id: system.id, name: system.name, type: "system", file: path.relative(universeRoot, system.file) });
  }
  for (const faction of entities.factions) {
    compact.push({ id: faction.id, name: faction.name, type: "faction", file: path.relative(universeRoot, faction.file) });
  }
  for (const artifact of entities.artifacts) {
    compact.push({ id: artifact.id, name: artifact.name, type: "artifact", file: path.relative(universeRoot, artifact.file) });
  }

  return compact;
}

export function formatUniverseScan(result) {
  if (result === null) {
    return "No universe found\n";
  }

  if (result.length === 0) {
    return "Universe is empty (no entities)\n";
  }

  const lines = ["# Universe Entities", ""];
  for (const entity of result) {
    lines.push(`- [${entity.type}] ${entity.id} — ${entity.name} (${entity.file})`);
  }
  return `${lines.join("\n")}\n`;
}

export function universeReport(root) {
  const universeRoot = resolveUniverseRoot(root);
  if (universeRoot === null) {
    return null;
  }

  const entities = scanUniverse(universeRoot);
  const validation = validateUniverse(root);

  return {
    counts: {
      characters: entities.characters.length,
      locations: entities.locations.length,
      systems: entities.systems.length,
      factions: entities.factions.length,
      artifacts: entities.artifacts.length
    },
    total: entities.characters.length + entities.locations.length + entities.systems.length +
           entities.factions.length + entities.artifacts.length,
    validation
  };
}

export function formatUniverseReport(report) {
  if (report === null) {
    return "No universe found\n";
  }

  const lines = [
    "# Universe Report",
    "",
    "Entity Counts:",
    `- Characters: ${report.counts.characters}`,
    `- Locations: ${report.counts.locations}`,
    `- Systems: ${report.counts.systems}`,
    `- Factions: ${report.counts.factions}`,
    `- Artifacts: ${report.counts.artifacts}`,
    `- Total entities: ${report.total}`,
    "",
    `Validation: ${formatCheck(report.validation)}`
  ];

  if (report.validation.errors.length > 0) {
    lines.push("", "Errors:");
    for (const error of report.validation.errors) {
      lines.push(`- ${error}`);
    }
  }
  if (report.validation.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of report.validation.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/story.test.js -t "universe scan and report"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/story.js test/story.test.js
git commit -m "feat: add universeScan, formatUniverseScan, universeReport, formatUniverseReport"
```

---

## Task 6: CLI Command Group

**Files:**
- Create: (none)
- Modify: `src/cli.js` (update imports at lines 3-21, update `HELP` at lines 23-83, add universe dispatch before line 239)
- Test: `test/cli.test.js`

**Interfaces:**
- Consumes: `createUniverseProject()`, `universeScan()`, `formatUniverseScan()`, `validateUniverse()`, `universeReport()`, `formatUniverseReport()`, `path`, `reportResult()`, `HELP`
- Produces: `story universe init/scan/validate/report` CLI commands dispatched from `runCli()`

- [ ] **Step 1: Write the failing test**

```javascript
import { createUniverseProject } from "../src/story.js";

describe("cli universe commands", () => {
  test("story universe init creates universe project", () => {
    const cwd = makeTempDir();
    const result = invoke(cwd, ["universe", "init", "My", "Universe"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("Created universe project:");
    expect(fs.existsSync(path.join(cwd, "universe.md"))).toBe(true);
  });

  test("story universe scan outputs entity list", () => {
    const cwd = makeTempDir();
    createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(cwd, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");
    const result = invoke(cwd, ["universe", "scan"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("legend");
    expect(result.out).toContain("Legend");
    expect(result.out).toContain("character");
  });

  test("story universe scan from universe root without path arg", () => {
    const cwd = makeTempDir();
    createUniverseProject({ name: "Aetheria", cwd });
    const result = invoke(cwd, ["universe", "scan"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("Universe is empty");
  });

  test("story universe scan reports no universe found", () => {
    const cwd = makeTempDir();
    const result = invoke(cwd, ["universe", "scan"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("No universe found");
  });

  test("story universe validate reports valid universe", () => {
    const cwd = makeTempDir();
    createUniverseProject({ name: "Aetheria", cwd });
    const result = invoke(cwd, ["universe", "validate"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("Universe is valid");
  });

  test("story universe validate reports errors", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(result.root, "characters", "Bad_Id.md"), `
name: "Bad"
role: supporting
status: alive
`, "# Bad\n");
    const cliResult = invoke(cwd, ["universe", "validate"]);
    expect(cliResult.code).toBe(1);
    expect(cliResult.err).toContain("kebab-case");
  });

  test("story universe report outputs counts and validation", () => {
    const cwd = makeTempDir();
    createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(cwd, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");
    const result = invoke(cwd, ["universe", "report"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("Characters: 1");
    expect(result.out).toContain("Total entities: 1");
    expect(result.out).toContain("Validation:");
  });

  test("story universe report on empty universe shows zero counts", () => {
    const cwd = makeTempDir();
    createUniverseProject({ name: "Aetheria", cwd });
    const result = invoke(cwd, ["universe", "report"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("Characters: 0");
    expect(result.out).toContain("Total entities: 0");
  });

  test("story universe report reports no universe found", () => {
    const cwd = makeTempDir();
    const result = invoke(cwd, ["universe", "report"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("No universe found");
  });

  test("story universe with unknown subcommand writes error", () => {
    const cwd = makeTempDir();
    const result = invoke(cwd, ["universe", "frobnicate"]);
    expect(result.code).toBe(1);
    expect(result.err).toContain("Unknown universe subcommand: frobnicate");
  });

  test("help text includes universe command group", () => {
    const cwd = makeTempDir();
    const help = invoke(cwd, ["--help"]).out;
    expect(help).toContain("universe");
    expect(help).toContain("universe init <name>");
    expect(help).toContain("universe scan [path]");
    expect(help).toContain("universe validate [path]");
    expect(help).toContain("universe report [path]");
  });

  test("story universe init without name throws error", () => {
    const cwd = makeTempDir();
    const result = invoke(cwd, ["universe", "init"]);
    expect(result.code).toBe(1);
    expect(result.err).toContain("A universe name is required");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/cli.test.js -t "cli universe commands"`
Expected: FAIL — `universe` command is not recognized, treated as unknown command

- [ ] **Step 3: Write minimal implementation**

Update imports in `src/cli.js` (lines 3-21) — add universe function imports:

```javascript
import path from "node:path";
import { importManuscript } from "./import.js";
import {
  buildBook,
  checkProjectContinuity,
  computeWordCounts,
  createEntity,
  createStoryProject,
  createUniverseProject,
  exportManuscript,
  formatActionReport,
  formatDoctorReport,
  formatProjectReport,
  formatUniverseReport,
  formatUniverseScan,
  migrateProject,
  projectReport,
  projectActions,
  reindexProject,
  removeEntity,
  renameEntity,
  universeReport,
  universeScan,
  validateLinks,
  validateProject,
  validateUniverse
} from "./story.js";
```

Update `HELP` text (lines 23-83) — add universe command group section after the `build` command line and before the `Options:` section:

```
  universe init <name>
                    Scaffold a universe project (parent container for stories)
  universe scan [path]
                    List universe entities (id, name, type, file)
  universe validate [path]
                    Validate universe structure, ids, and cross-level references
  universe report [path]
                    Summarize universe inventory and validation status
```

Add universe subcommand routing in `runCli()` — before the unknown command fallback (line 239):

```javascript
    if (command === "universe") {
      const subcommand = parsed.positionals[1];
      if (subcommand === "init") {
        const name = parsed.positionals.slice(2).join(" ");
        if (!name) {
          throw new Error("A universe name is required");
        }
        const result = createUniverseProject({ name, cwd, dir: parsed.options.dir });
        io.stdout.write(`Created universe project: ${result.root}\n`);
        return 0;
      }

      if (subcommand === "scan") {
        const root = path.resolve(cwd, parsed.positionals[2] ?? ".");
        io.stdout.write(formatUniverseScan(universeScan(root)));
        return 0;
      }

      if (subcommand === "validate") {
        const root = path.resolve(cwd, parsed.positionals[2] ?? ".");
        return reportResult(io, validateUniverse(root), "Universe is valid", "Universe validation failed");
      }

      if (subcommand === "report") {
        const root = path.resolve(cwd, parsed.positionals[2] ?? ".");
        io.stdout.write(formatUniverseReport(universeReport(root)));
        return 0;
      }

      io.stderr.write(`Unknown universe subcommand: ${subcommand}\n\n${HELP}`);
      return 1;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/cli.test.js -t "cli universe commands"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli.js test/cli.test.js
git commit -m "feat: add story universe command group (init/scan/validate/report)"
```

---

## Task 7: Skills

**Files:**
- Create: `skills/universe-management/SKILL.md`
- Modify: `skills/story-init/SKILL.md`
- Modify: `skills/worldbuilding/SKILL.md`
- Modify: `skills/character-management/SKILL.md`
- Test: N/A (documentation-only task — verified by `bun run check:metadata` in Task 10)

**Interfaces:**
- Consumes: CLI commands `story universe init/scan/validate/report`, `story init` auto-detection behavior
- Produces: Agent guidance for universe-level workflows, updated existing skills with universe awareness

- [ ] **Step 1: Write the failing test (metadata validation)**

Since skills are markdown documentation (not executable code), the "test" is the metadata consistency check that validates every `SKILL.md` has correct YAML frontmatter and is registered in plugin manifests:

Run: `bun run check:metadata`
Expected: FAIL — `skills/universe-management/SKILL.md` does not exist yet, so if it's referenced in plugin manifests the check fails; or PASS if not yet referenced (in which case we proceed to create it and register it)

- [ ] **Step 2: Run test to verify current state**

Run: `bun run check:metadata`
Expected: Documents current state — either PASS (skill not yet registered) or FAIL (if already referenced)

- [ ] **Step 3: Write minimal implementation**

Create `skills/universe-management/SKILL.md`:

````markdown
---
name: universe-management
description: This skill should be used when the user asks to "create a universe", "set up a shared world", "manage universe-level entities", "cross-level referencing", "shared characters across stories", "universe-level worldbuilding", "epic worldbuilding", or wants to create entities that span multiple stories.
---

# Universe Management

## Overview

Create and manage an opt-in universe container that sits above story projects. Shared characters, locations, systems, factions, and artifacts live at the universe level and are cross-referenceable from individual story projects.

## When to Use

- Creating a shared universe container for multiple stories
- Adding entities that span multiple stories (legends, sacred locations, world-spanning factions)
- Cross-level referencing from story entities to universe-level entities
- Deciding whether an entity belongs at universe or story level
- Running universe validation to check cross-level integrity

## Workflow

1. **Initialize the universe** — create a directory for the universe, then run `story universe init` inside it:

```shell
mkdir my-universe-name
cd my-universe-name
story universe init "My Universe Name"
```

This creates `universe.md` and entity directories in the current directory:
```
.
├── universe.md
├── characters/
│   └── _index.md
└── worldbuilding/
    ├── _index.md
    ├── locations/
    ├── systems/
    ├── factions/
    └── artifacts/
```

2. **Add shared entities** at the universe level. Place files in `characters/` for shared characters, `worldbuilding/locations/` for shared locations, etc. Use the same frontmatter format as story-level entities.

3. **Create stories inside the universe** — `story init` automatically detects the parent `universe.md` and writes the `universe` field into `story.md` frontmatter:

```shell
mkdir stories
cd stories
story init "My First Story"
```

4. **Cross-level referencing** — story entities reference universe entities by id. For example, a story character's `locations` field can include a universe-level location id:

```yaml
---
name: "Story Hero"
role: protagonist
status: alive
locations:
  - sacred-mountain       # universe-level location
  - local-tavern           # story-level location
---
```

5. **Validate the universe** after adding entities:

```shell
story universe validate .
```

This checks:
- Universe entity ids are kebab-case and unique
- No id shadowing between story and universe levels
- Cross-level references resolve (story entity → universe entity exists)
- `universe.md` frontmatter has required fields (`name`, `schema-version`)
- Story `universe` field resolves to an actual `universe.md` (warning if missing)

## Level Selection Guidance

| Entity appears in... | Place at... |
|----------------------|------------|
| Multiple stories | Universe level |
| One story only | Story level |
| All stories (world-spanning) | Universe level |
| One story's plot | Story level |

**Examples:**
- A sacred mountain mentioned in 3+ stories → universe level (`worldbuilding/locations/sacred-mountain.md`)
- A one-off tavern in a single story → story level
- An immortal character appearing across stories → universe level (`characters/ancient-one.md`)
- A minor character in one story → story level
- A world-spanning empire → universe level (`worldbuilding/factions/imperium.md`)

## Conventions

- **Kebab-case filenames** for all universe entity files (same as story level)
- **YAML frontmatter** on every file (same schema as story-level entities)
- **Universe id** is derived from `universe.md` frontmatter `name` via kebab-case
- **Story linkage** — `story.md` frontmatter `universe: <universe-id>` field auto-written by `story init`
- **No backlink enforcement** for cross-level references — story → universe is existence-only (unlike same-level `story links` which enforces bidirectional backlinks)
- **Universe scanning** uses `universeRoot` as the path-safety root, never `storyRoot`
- After adding/removing/rename universe entities, run `story universe validate` to verify integrity

## Commands

| Command | Purpose |
|---------|---------|
| `story universe init <name>` | Create universe scaffold |
| `story universe scan [path]` | List all universe entities |
| `story universe validate [path]` | Check universe integrity |
| `story universe report [path]` | Summary of universe inventory and validation |
````

Update `skills/story-init/SKILL.md` — add after the "Conventions" section:

````markdown
## Universe Auto-Detection

When running `story init`, the CLI automatically walks up the directory tree from the target directory to find a `universe.md` file. If found:

1. The universe `name` field is read from `universe.md` frontmatter
2. A `universe: <kebab-case-id>` field is written into `story.md` frontmatter
3. The story is linked to the universe container

If no `universe.md` is found, `story init` behaves exactly as before — no `universe` field is written.

**Note:** The linkage is a warning, not an error. If the universe directory is later moved or deleted, the story remains functional in standalone mode. Remove the `universe` field from `story.md` to unlink explicitly.

**Convention:** Place story projects in a `stories/` subdirectory inside the universe root:

```
my-universe/
├── universe.md
├── characters/
├── worldbuilding/
└── stories/
    └── my-story/        ← story init here auto-detects parent universe
```
````

Update `skills/worldbuilding/SKILL.md` — add a new section:

````markdown
## Universe-Level Worldbuilding

Locations, systems, factions, and artifacts can be placed at the universe level when they span multiple stories. See the `universe-management` skill for full guidance on creating and managing universe-level entities.

**When to use universe level:**
- A sacred mountain that appears in multiple stories → `universe/worldbuilding/locations/sacred-mountain.md`
- A world-spanning magic system → `universe/worldbuilding/systems/high-magic.md`
- An empire that affects all stories → `universe/worldbuilding/factions/imperium.md`
- An ancient relic sought across stories → `universe/worldbuilding/artifacts/eternal-flame.md`

**When to use story level:**
- A one-off tavern → `story/worldbuilding/locations/tavern.md`
- A story-specific power → `story/worldbuilding/systems/blood-magic.md`

Story entities can reference universe entities by id. Cross-level references are validated by `story universe validate` (existence-only, no backlink enforcement).
````

Update `skills/character-management/SKILL.md` — add a new section:

````markdown
## Universe-Level Characters

Characters that span multiple stories — legends, immortals, gods, recurring antagonists — should be placed at the universe level:

```
universe/characters/ancient-one.md
```

Use the same frontmatter format as story-level characters. Story entities can reference universe-level characters by id in relationship fields:

```yaml
---
name: "Story Hero"
role: protagonist
status: alive
relationships:
  - character: ancient-one    # universe-level character
    type: mentor
locations:
  - sacred-mountain            # universe-level location
---
```

**When to use universe level:**
- An immortal who appears across stories
- A legendary figure referenced in backstory
- A god worshipped by characters in multiple stories

**When to use story level:**
- A protagonist specific to one story
- A minor character in a single story

Cross-level references are validated by `story universe validate` — existence only, no backlink enforcement for cross-level (unlike same-level relationships which require bidirectional backlinks).
````

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run check:metadata`
Expected: PASS — all SKILL.md files have valid YAML frontmatter and are registered

- [ ] **Step 5: Commit**

```bash
git add skills/universe-management/SKILL.md skills/story-init/SKILL.md skills/worldbuilding/SKILL.md skills/character-management/SKILL.md
git commit -m "feat: add universe-management skill and update story-init, worldbuilding, character-management skills"
```

---

## Task 8: AGENTS.md Documentation

**Files:**
- Create: (none)
- Modify: `AGENTS.md` (CLI Command → Source Mapping table at lines 79-96, Source Module Inventory at line 71, architecture description at lines 8-13)
- Test: N/A (documentation-only task — verified by manual review)

**Interfaces:**
- Consumes: All new exported function names from Tasks 1-6
- Produces: Updated AGENTS.md with universe commands, function inventory, and architecture description

- [ ] **Step 1: Write the failing test (documentation consistency check)**

There is no automated test for AGENTS.md content. The verification is manual — confirm that `AGENTS.md` does not yet list the universe commands by searching for the string `universe`:

Run: `bun -e "const fs = require('fs'); const content = fs.readFileSync('AGENTS.md', 'utf8'); if (content.includes('universe init')) { console.log('FAIL: already documented'); process.exit(1); } else { console.log('PASS: not yet documented'); }"`
Expected: PASS — `universe init` is not yet in AGENTS.md

- [ ] **Step 2: Run test to verify current state**

Run: `bun -e "const fs = require('fs'); const c = fs.readFileSync('AGENTS.md','utf8'); console.log(c.includes('universe init') ? 'already present' : 'not present')"`
Expected: `not present`

- [ ] **Step 3: Write minimal implementation**

Update CLI Command → Source Mapping table (after line 96) — add four new rows:

```markdown
| `story universe init <name>` | `story.js → createUniverseProject` |
| `story universe scan [path]` | `story.js → formatUniverseScan(universeScan(root))` |
| `story universe validate [path]` | `story.js → validateUniverse` |
| `story universe report [path]` | `story.js → formatUniverseReport(universeReport(root))` |
```

Update Source Module Inventory (line 71) — add new exports to the `src/story.js` key exports list:

```
`createUniverseProject`, `resolveUniverseRoot`, `scanUniverse`, `validateUniverse`, `universeScan`, `formatUniverseScan`, `universeReport`, `formatUniverseReport`
```

Update architecture description (lines 8-13) — update the skills count and chain:

```markdown
1. **Creative skills** (`skills/<name>/SKILL.md`) — Agent-facing workflows. Each skill is a single `SKILL.md` with YAML frontmatter (`name`, `description`) plus a body that walks an agent through what to read, write, and which CLI commands to run. Structured templates live in `references/` subdirectories. The eight skills chain as: `story-init` scaffolds → `character-management` / `worldbuilding` / `plot-structure` populate → `chapter-writing` drafts → `revision-continuity` audits → `story-maintenance` runs deterministic CLI checks. `universe-management` provides opt-in shared-entity workflows above story projects.
```

Update the Data Flow diagram (after line 29) — add universe scanning as an opt-in extension:

```
              scanProject(root)   ◀── single read-only snapshot
              │   reads .md files with parseFrontmatter (YAML)
              │   → { story, characters, locations, systems, factions,
              │      artifacts, arcs, chapters, scenes, questions,
              │      promises, glossaryTerms, continuity }
              │   → if story.data.universe: resolveUniverseRoot + scanUniverse
              │      → project.universe = { characters, locations, systems,
              │         factions, artifacts }, project.universeRoot
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun -e "const fs = require('fs'); const c = fs.readFileSync('AGENTS.md','utf8'); console.log(c.includes('universe init') ? 'present' : 'missing')"`
Expected: `present`

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add universe commands and skill to AGENTS.md"
```

---

## Task 9: Tests

**Files:**
- Create: (none)
- Modify: `test/story.test.js` (add regression tests — item 9.7 — and path-safety tests — item 9.8; items 9.1–9.4 were written inline in Tasks 1–4)
- Modify: `test/cli.test.js` (add story-root invocation tests for universe scan/report — items 9.5–9.6; path-arg tests were written inline in Task 6)
- Test: `test/story.test.js`, `test/cli.test.js`

**Interfaces:**
- Consumes: All universe functions from Tasks 1-5, existing `scanProject`, `validateProject`, `validateLinks`, `createStoryProject`, `createUniverseProject`
- Produces: Regression coverage proving existing behavior is unchanged (9.7), path-safety isolation tests (9.8), and story-root CLI invocation tests for scan/report (9.5–9.6); items 9.1–9.4 and 9.5–9.6 path-arg tests are in Tasks 1–6

**Coverage mapping (tasks.md items 9.1–9.8):**
- **9.1** (universe init tests) — written in Task 1 Step 1: `describe("universe scaffold")` in `test/story.test.js`
- **9.2** (universe scan tests) — written in Task 2 Step 1: `describe("universe resolution")` in `test/story.test.js`
- **9.3** (story init auto-detection tests) — written in Task 3 Step 1: `describe("story init universe auto-detection")` in `test/story.test.js`
- **9.4** (universe validate tests) — written in Task 4 Step 1: `describe("universe validation")` in `test/story.test.js`
- **9.5** (universe scan command tests) — written in Task 6 Step 1: `describe("cli universe commands")` scan tests in `test/cli.test.js`
- **9.6** (universe report command tests) — written in Task 6 Step 1: `describe("cli universe commands")` report tests in `test/cli.test.js`
- **9.7** (regression tests) — written below in this task: `describe("universe regression")` in `test/story.test.js`
- **9.8** (universe path-safety tests) — written below in this task: `describe("universe path safety")` in `test/story.test.js`

- [ ] **Step 1: Write the failing test**

Items 9.1–9.6 tests were written inline in their implementation tasks (Tasks 1–6) as part of the TDD cycle — see the coverage mapping above. This task adds the remaining items 9.7–9.8 (regression and path-safety tests in `test/story.test.js`) plus story-root invocation tests for 9.5–9.6 in `test/cli.test.js`.

**`test/story.test.js`** — items 9.7, 9.8:

```javascript
// Extend the existing import from "../src/story.js" at the top of test/story.test.js
// to include validateProject and validateLinks if not already present.
// (createStoryProject, scanProject, createUniverseProject, scanUniverse are already
// imported via Tasks 1–4.)


// 9.7: Regression tests
describe("universe regression", () => {
  test("story validate output unchanged when no universe present", () => {
    const cwd = makeTempDir();
    createStoryProject({ title: "Regression Story", cwd });
    addStoryEntities(path.join(cwd, "regression-story"));
    const result = validateProject(path.join(cwd, "regression-story"));
    expect(result.ok).toBe(true);
  });

  test("story links output unchanged when no universe present", () => {
    const cwd = makeTempDir();
    createStoryProject({ title: "Links Story", cwd });
    addStoryEntities(path.join(cwd, "links-story"));
    const result = validateLinks(path.join(cwd, "links-story"));
    expect(result.ok).toBe(true);
  });

  test("story init outside universe produces identical output to current behavior", () => {
    const cwd = makeTempDir();
    createStoryProject({ title: "Plain Story", cwd });
    const root = path.join(cwd, "plain-story");
    const storyMd = fs.readFileSync(path.join(root, "story.md"), "utf8");
    expect(storyMd).not.toContain("universe:");
    const project = scanProject(root);
    expect(project.universe).toBeUndefined();
    expect(project.universeRoot).toBeUndefined();
  });

  test("all existing test entities still validate after scanProject extension", () => {
    const cwd = makeTempDir();
    createStoryProject({ title: "Full Story", cwd });
    addStoryEntities(path.join(cwd, "full-story"));
    const project = scanProject(path.join(cwd, "full-story"));
    expect(project.characters).toHaveLength(2);
    expect(project.locations).toHaveLength(1);
    expect(project.systems).toHaveLength(1);
    expect(project.arcs).toHaveLength(1);
    expect(project.chapters).toHaveLength(1);
    expect(project.scenes).toHaveLength(1);
  });
});

// 9.8: Universe path-safety tests
describe("universe path safety", () => {
  test("universe scanning uses universeRoot as root for assertLexicallyInsideRoot", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });

    // Universe entities must be scanned with universeRoot, not storyRoot.
    // If storyRoot were used, universe paths (ancestors of storyRoot)
    // would be rejected by assertLexicallyInsideRoot.
    const project = scanProject(path.join(storiesDir, "my-tale"));
    expect(project.universe).toBeDefined();
    expect(project.universe.characters).toEqual([]);
  });

  test("universe entity files are accessible from story context via scanProject", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });

    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");

    // Universe entity must appear in project.universe, NOT in project.characters
    const project = scanProject(path.join(storiesDir, "my-tale"));
    expect(project.universe.characters).toHaveLength(1);
    expect(project.universe.characters[0].id).toBe("legend");
    expect(project.characters.find((c) => c.id === "legend")).toBeUndefined();
  });

  test("universe entity files outside universeRoot are refused", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    // readEntityFiles filters to .md files in the directory; a file outside the
    // universe directory cannot be read via readEntityFiles because the directory
    // scan only lists files in the target directory.
    const entities = scanUniverse(universeResult.root);
    expect(entities.characters).toEqual([]);
    expect(entities.locations).toEqual([]);
  });

  test("symlinked universe directories are rejected", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    // Replace the characters/ directory with a symlink pointing outside universeRoot.
    // assertSafeProjectDirectory() checks stats.isSymbolicLink() on directories —
    // readEntityFiles uses Dirent.isFile() which ignores symlinks to files, so the
    // rejection path is only exercised by a symlinked directory, not a symlinked file.
    const charDir = path.join(universeResult.root, "characters");
    const realOutside = path.join(path.dirname(cwd), `${path.basename(cwd)}-outside-characters`);
    fs.mkdirSync(realOutside, { recursive: true });
    fs.writeFileSync(path.join(realOutside, "evil.md"), "# Evil\n", "utf8");
    fs.rmSync(charDir, { recursive: true });
    fs.symlinkSync(realOutside, charDir);
    expect(() => scanUniverse(universeResult.root)).toThrow();
  });
});
```

**`test/cli.test.js`** — story-root invocation tests for items 9.5, 9.6:

```javascript
// Add createUniverseProject and createStoryProject to the existing import
// from "../src/story.js" at the top of test/cli.test.js.
// 9.5/9.6: Universe scan and report from story root (walks up to find universe)
describe("cli universe story-root invocation", () => {
  test("story universe scan resolves from story root by walking up", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");

    const storyRoot = path.join(storiesDir, "my-tale");
    const result = invoke(storyRoot, ["universe", "scan"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("legend");
    expect(result.out).toContain("Legend");
  });

  test("story universe report resolves from story root by walking up", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");

    const storyRoot = path.join(storiesDir, "my-tale");
    const result = invoke(storyRoot, ["universe", "report"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("Characters: 1");
    expect(result.out).toContain("Total entities: 1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/story.test.js -t "universe regression"`
Run: `bun test test/story.test.js -t "universe path safety"`
Run: `bun test test/cli.test.js -t "cli universe story-root invocation"`
Expected: The regression tests should PASS immediately (they prove existing behavior is unchanged). The path-safety tests should PASS once `scanUniverse` is implemented (from Task 2). If `scanUniverse` is not yet implemented, path-safety tests will FAIL. The CLI story-root tests should PASS once Tasks 1–6 are complete.

- [ ] **Step 3: Write minimal implementation**

No new implementation needed — these tests exercise functions implemented in Tasks 1-5. If any regression test fails, it indicates a bug in the universe implementation that must be fixed before proceeding.

If regression tests fail, the fix is to ensure `scanProject` does not modify any existing fields when `story.data.universe` is absent. Verify the conditional block:

```javascript
  if (story.data.universe) {
    const universeRoot = resolveUniverseRoot(projectRoot);
    if (universeRoot) {
      project.universe = scanUniverse(universeRoot);
      project.universeRoot = universeRoot;
    }
  }
```

This block only fires when the `universe` field is present in `story.md` frontmatter. Existing projects without the field are unaffected.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/story.test.js -t "universe regression"`
Run: `bun test test/story.test.js -t "universe path safety"`
Run: `bun test test/cli.test.js -t "cli universe story-root invocation"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/story.test.js test/cli.test.js
git commit -m "test: add universe regression, path-safety, and story-root CLI tests"
```

---

## Task 10: Fallback Bundle and Final Verification

**Files:**
- Create: (none — regenerates existing artifact)
- Modify: `skills/story-maintenance/scripts/story.js` (auto-generated by `bun run build:fallback`)
- Test: N/A (verification-only task — runs existing test suite and quality gates)

**Interfaces:**
- Consumes: All universe functions in `src/story.js` and `src/cli.js`
- Produces: Verified fallback bundle, passing test suite, 100% coverage, metadata consistency

- [ ] **Step 1: Run full test suite to verify all tests pass**

Run: `bun run test`
Expected: All existing tests plus all new universe tests pass. If any fail, fix the implementation before proceeding.

- [ ] **Step 2: Verify coverage and confirm stale fallback fails**

Run: `bun test test/*.test.js --coverage --coverage-reporter=lcov --coverage-dir=coverage && node scripts/check-coverage.js coverage/lcov.info src`
Expected: 100% line + function coverage on all `src/*.js` files including new universe functions. If coverage is under 100%, add tests for uncovered branches.

Note: We run the coverage check directly rather than `bun run test:coverage` because the latter ends with `&& bun run check:fallback`, which would fail here since the fallback hasn't been regenerated yet.

Run: `bun run check:fallback`
Expected: FAIL — the committed fallback bundle does not yet include the new universe functions. This confirms the fallback is stale and needs regeneration in Step 3.

- [ ] **Step 3: Regenerate fallback bundle**

Run: `bun run build:fallback`
Expected: `skills/story-maintenance/scripts/story.js` is regenerated with all new universe functions inlined.

Then verify the fallback runs under Node and shows universe commands:

Run: `node skills/story-maintenance/scripts/story.js --help`
Expected: HELP output contains `universe init <name>`, `universe scan [path]`, `universe validate [path]`, `universe report [path]`

Run: `bun run check:fallback`
Expected: PASS — committed fallback byte-matches fresh build

Run: `bun run test:examples`
Expected: All example projects validate unchanged

Run: `bun run check:metadata`
Expected: Plugin metadata consistency passes


- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test`
Run: `bun run test:coverage`
Run: `bun run check:fallback`
Run: `bun run test:examples`
Run: `bun run check:metadata`
Expected: ALL PASS — full green suite

- [ ] **Step 5: Commit**

```bash
git add skills/story-maintenance/scripts/story.js
git commit -m "chore: regenerate fallback bundle with universe commands"
```
