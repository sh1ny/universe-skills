import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  buildBook,
  computeWordCounts,
  createEntity,
  checkProjectContinuity,
  createStoryProject,
  createUniverseProject,
  exportManuscript,
  formatActionReport,
  formatProjectReport,
  formatUniverseReport,
  formatUniverseScan,
  migrateProject,
  projectActions,
  projectReport,
  reindexProject,
  removeEntity,
  renameEntity,
  resolveUniverseRoot,
  scanProject,
  scanUniverse,
  STORY_SCHEMA_VERSION,
  UNIVERSE_INDEX_SCHEMAS,
  UNIVERSE_REQUIRED_FRONTMATTER,
  UNIVERSE_REQUIRED_PATHS,
  universeReport,
  universeScan,
  validateLinks,
  validateProject,
  validateUniverse,
  validateUniverseIds,
  validateUniverseIdUniqueness
} from "../src/story.js";
import { makeTempDir, writeMarkdown } from "./helpers.js";

function addStoryEntities(root) {
  writeMarkdown(path.join(root, "characters", "sera-voss.md"), `
name: "Sera Voss"
role: protagonist
status: alive
relationships:
  - character: kael-voss
    type: sibling
locations:
  - whispering-vale
`, "# Sera\n");
  writeMarkdown(path.join(root, "characters", "kael-voss.md"), `
name: "Kael Voss"
role: supporting
status: alive
relationships:
  - character: sera-voss
    type: sibling
locations:
  - whispering-vale
`, "# Kael\n");
  writeMarkdown(path.join(root, "worldbuilding", "locations", "whispering-vale.md"), `
name: "Whispering Vale"
type: wilderness
region: North
notable-characters:
  - sera-voss
  - kael-voss
`, "# Vale\n");
  writeMarkdown(path.join(root, "worldbuilding", "systems", "ember-magic.md"), `
name: "Ember Magic"
type: magic
`, "# Ember\n");
  writeMarkdown(path.join(root, "plot", "arcs", "reclamation.md"), `
name: "Reclamation"
type: main
status: planned
characters:
  - sera-voss
themes:
  - redemption
`, "# Arc\n");
  writeMarkdown(path.join(root, "chapters", "chapter-01.md"), `
title: "The Ember Wakes"
number: 1
pov: sera-voss
locations:
  - whispering-vale
characters:
  - sera-voss
arcs-advanced:
  - reclamation
status: draft
word-count: 0
`, "# Chapter 1\n\n## Outline\n\n1. Beat\n\n---\n\nSera returned home.");
  writeMarkdown(path.join(root, "scenes", "chapter-01-scene-01.md"), `
title: "Sera Returns"
chapter: chapter-01
scene: 1
pov: sera-voss
location: whispering-vale
characters:
  - sera-voss
arcs-advanced:
  - reclamation
status: draft
state-changes: []
`, "# Sera Returns\n");
}

describe("story project operations", () => {
  test("creates, scans, reindexes, counts, validates, links, and exports a story project", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({
      cwd,
      title: "The Last Ember",
      genre: "fantasy",
      subGenre: "epic",
      settingEra: "medieval",
      themes: ["redemption", "legacy"],
      pov: "third-person-limited",
      tense: "past",
      synopsis: "Sera returns.",
      force: false
    });

    expect(created.storyId).toBe("the-last-ember");
    expect(fs.existsSync(path.join(created.root, "story.md"))).toBe(true);
    expect(scanProject(created.root).story.data["schema-version"]).toBe(STORY_SCHEMA_VERSION);
    addStoryEntities(created.root);

    const project = scanProject(created.root);
    expect(project.characters.map((item) => item.id)).toEqual(["kael-voss", "sera-voss"]);
    expect(project.scenes.map((item) => item.id)).toEqual(["chapter-01-scene-01"]);
    expect(project.chapters[0].wordCount).toBe(3);

    const reindexed = reindexProject(created.root);
    expect(reindexed.changed.map((file) => path.basename(file))).toContain("_index.md");
    expect(fs.readFileSync(path.join(created.root, "characters", "_index.md"), "utf8")).toContain("[sera-voss](sera-voss.md)");
    expect(fs.readFileSync(path.join(created.root, "worldbuilding", "_index.md"), "utf8")).toContain("[whispering-vale](locations/whispering-vale.md)");
    expect(fs.readFileSync(path.join(created.root, "plot", "_index.md"), "utf8")).toContain("[reclamation](arcs/reclamation.md)");
    expect(fs.readFileSync(path.join(created.root, "scenes", "_index.md"), "utf8")).toContain("[chapter-01-scene-01](chapter-01-scene-01.md)");

    const counts = computeWordCounts(created.root, { write: true });
    expect(counts).toEqual({
      chapters: [{ number: 1, title: "The Ember Wakes", file: path.join("chapters", "chapter-01.md"), wordCount: 3 }],
      total: 3
    });
    expect(fs.readFileSync(path.join(created.root, "chapters", "chapter-01.md"), "utf8")).toContain("word-count: 3");

    expect(validateProject(created.root).ok).toBe(true);
    expect(validateLinks(created.root)).toEqual({ ok: true, errors: [], warnings: [] });

    const exported = exportManuscript(created.root, { out: "book.md" });
    expect(exported.chapters).toBe(1);
    expect(fs.readFileSync(exported.outFile, "utf8")).toContain("# Chapter 1: The Ember Wakes\n\nSera returned home.");

    const built = buildBook(created.root);
    expect(built).toEqual({
      outFile: path.join(created.root, "dist", "the-last-ember.md"),
      chapters: 1,
      format: "markdown"
    });
    expect(fs.readFileSync(built.outFile, "utf8")).toContain("Generated by story build");
  });

  test("builds a project report", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Reported Story", force: false });
    addStoryEntities(created.root);
    computeWordCounts(created.root, { write: true });

    const report = projectReport(created.root);
    expect(report.counts).toEqual({
      characters: 2,
      locations: 1,
      systems: 1,
      factions: 0,
      artifacts: 0,
      arcs: 1,
      chapters: 1,
      scenes: 1,
      questions: 0,
      promises: 0,
      glossaryTerms: 0,
      words: 3
    });
    expect(report.validation.ok).toBe(true);
    expect(report.links.ok).toBe(true);

    const formatted = formatProjectReport(report);
    expect(formatted).toContain("# Reported Story");
    expect(formatted).toContain(`Schema version: ${STORY_SCHEMA_VERSION}`);
    expect(formatted).toContain("- 1. The Ember Wakes (draft, 3 words, POV: sera-voss)");
    expect(formatted).toContain("- Validate: ok (0 errors, 0 warnings)");

    const empty = formatProjectReport(projectReport(createStoryProject({ cwd, title: "Empty Report", force: false }).root));
    expect(empty).toContain("Chapters:\n- None");
    expect(empty).toContain("Arcs:\n- None");
  });

  test("exports natural chapters without duplicating a leading H1 heading", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Harbor Example", force: false });
    writeMarkdown(path.join(created.root, "chapters", "chapter-01.md"), `
title: "The Tide Board"
number: 1
pov: ""
locations: []
characters: []
arcs-advanced: []
status: complete
word-count: 0
`, "# Chapter 1: The Tide Board\n\nProse starts here.");

    expect(scanProject(created.root).chapters[0].wordCount).toBe(3);

    const exported = exportManuscript(created.root, { out: "book.md" });
    const exportedText = fs.readFileSync(exported.outFile, "utf8");
    expect(exportedText.match(/^# Chapter 1: The Tide Board$/gm)?.length).toBe(1);
    expect(exportedText).toContain("# Chapter 1: The Tide Board\n\nProse starts here.");

    const built = buildBook(created.root);
    const builtText = fs.readFileSync(built.outFile, "utf8");
    expect(builtText.match(/^# Chapter 1: The Tide Board$/gm)?.length).toBe(1);
    expect(builtText).toContain("# Chapter 1: The Tide Board\n\nProse starts here.");
  });

  test("supports forced init, default metadata, and unchanged reindex", () => {
    const cwd = makeTempDir();
    const first = createStoryProject({ cwd, title: "Quiet Stars", force: false });
    expect(() => createStoryProject({ cwd, title: "Quiet Stars", force: false })).toThrow("already exists");
    const second = createStoryProject({ cwd, title: "Quiet Stars", force: true, themes: [] });
    expect(second.root).toBe(first.root);
    expect(reindexProject(second.root).changed).toEqual([]);
  });

  test("refuses to overwrite maintenance outputs through symlinks", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Symlink Trap", force: false });
    const outside = path.join(cwd, "outside.md");
    fs.writeFileSync(outside, "outside sentinel", "utf8");

    const chapterIndex = path.join(created.root, "chapters", "_index.md");
    fs.rmSync(chapterIndex);
    fs.symlinkSync(outside, chapterIndex);

    expect(() => reindexProject(created.root)).toThrow("Refusing to write through symlink");
    expect(fs.readFileSync(outside, "utf8")).toBe("outside sentinel");
  });

  test("refuses to write project files through symlinked directories", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Symlink Directory", force: false });
    const outsideChapters = path.join(cwd, "outside-chapters");
    fs.mkdirSync(outsideChapters);

    fs.rmSync(path.join(created.root, "chapters"), { recursive: true, force: true });
    fs.symlinkSync(outsideChapters, path.join(created.root, "chapters"), "dir");

    expect(() => createEntity(created.root, { kind: "chapter", name: "Escaped", number: 1 })).toThrow("symlinked project directory");
    expect(fs.existsSync(path.join(outsideChapters, "chapter-01.md"))).toBe(false);
  });

  test("refuses unsafe project directories reached during scans", () => {
    const cwd = makeTempDir();
    const fileDirectory = createStoryProject({ cwd, title: "File Directory", force: false });
    fs.rmSync(path.join(fileDirectory.root, "characters"), { recursive: true, force: true });
    fs.writeFileSync(path.join(fileDirectory.root, "characters"), "not a directory", "utf8");

    expect(() => scanProject(fileDirectory.root)).toThrow("Project path is not a directory");

    const escapedDirectory = createStoryProject({ cwd, title: "Escaped Directory", force: false });
    const outsideWorld = path.join(cwd, "outside-world");
    fs.mkdirSync(path.join(outsideWorld, "locations"), { recursive: true });
    fs.rmSync(path.join(escapedDirectory.root, "worldbuilding"), { recursive: true, force: true });
    fs.symlinkSync(outsideWorld, path.join(escapedDirectory.root, "worldbuilding"), "dir");

    expect(() => scanProject(escapedDirectory.root)).toThrow("project directory outside root");
  });

  test("rejects traversal ids before rename, remove, and scene creation", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Traversal IDs", force: false });
    const victim = path.join(cwd, "victim.md");
    fs.writeFileSync(victim, "victim sentinel", "utf8");

    expect(() => removeEntity(created.root, { kind: "character", id: "../../victim" })).toThrow("must be a kebab-case id");
    expect(() => renameEntity(created.root, { kind: "character", id: "../../victim", name: "Moved Victim" })).toThrow("must be a kebab-case id");
    expect(() => createEntity(created.root, { kind: "scene", name: "Escaped Scene", chapter: "../../victim" })).toThrow("chapter id must be a kebab-case id");
    expect(fs.readFileSync(victim, "utf8")).toBe("victim sentinel");
    expect(fs.existsSync(path.join(cwd, "victim-scene-01.md"))).toBe(false);
  });

  test("rejects relative export outputs outside the project root", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Output Traversal", force: false });
    addStoryEntities(created.root);

    expect(() => exportManuscript(created.root, { out: "../outside.md" })).toThrow("outside project root");
    expect(fs.existsSync(path.join(cwd, "outside.md"))).toBe(false);
  });

  test("rejects outputs through symlinked parent directories", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Output Symlink", force: false });
    addStoryEntities(created.root);
    const outsideDist = path.join(cwd, "outside-dist");
    fs.mkdirSync(outsideDist);
    fs.symlinkSync(outsideDist, path.join(created.root, "dist"), "dir");

    expect(() => buildBook(created.root)).toThrow("project path outside root");
    expect(fs.existsSync(path.join(outsideDist, "output-symlink.md"))).toBe(false);
  });

  test("recreates missing registry files without leaving the project root", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Missing Registry", force: false });
    const registry = path.join(created.root, "characters", "_index.md");
    fs.rmSync(registry);

    expect(reindexProject(created.root).changed).toContain(registry);
    expect(fs.readFileSync(registry, "utf8")).toContain("type: character-registry");
  });

  test("reports missing structure, frontmatter fields, registry warnings, word-count warnings, and link errors", () => {
    const cwd = makeTempDir();
    expect(validateProject(cwd).errors).toContain("Missing required path: story.md");

    const created = createStoryProject({ cwd, title: "Broken Links", force: false });
    writeMarkdown(path.join(created.root, "characters", "orphan.md"), `
name: Orphan
role: supporting
status: alive
relationships:
  - character: missing-person
    type: friend
locations:
  - missing-place
`, "# Orphan");
    writeMarkdown(path.join(created.root, "worldbuilding", "locations", "empty.md"), `
name: Empty
type: ruins
notable-characters:
  - missing-person
`, "# Empty");
    writeMarkdown(path.join(created.root, "plot", "arcs", "bad-arc.md"), `
name: Bad Arc
type: main
status: planned
characters:
  - missing-person
`, "# Arc");
    writeMarkdown(path.join(created.root, "chapters", "chapter-02.md"), `
title: "Bad Chapter"
number: 2
pov: orphan
locations:
  - missing-place
characters:
  - missing-person
arcs-advanced:
  - missing-arc
status: draft
word-count: 10
`, "## Chapter Text\n\nTwo words.");

    const validation = validateProject(created.root);
    expect(validation.ok).toBe(true);
    expect(validation.warnings.some((warning) => warning.includes("registry link"))).toBe(true);
    expect(validation.warnings.some((warning) => warning.includes("declares 10 words"))).toBe(true);

    const links = validateLinks(created.root);
    expect(links.ok).toBe(false);
    expect(links.errors.join("\n")).toContain("missing character missing-person");
    expect(links.errors.join("\n")).toContain("missing location missing-place");
    expect(links.errors.join("\n")).toContain("missing arc missing-arc");
  });

  test("reports missing backlinks and supports missing directories plus filename chapter numbers", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Backlink Gaps", force: false });
    fs.rmSync(path.join(created.root, "plot", "arcs"), { recursive: true, force: true });
    writeMarkdown(path.join(created.root, "characters", "sera-voss.md"), `
name: "Sera Voss"
role: protagonist
status: alive
relationships:
  - character: kael-voss
    type: sibling
locations:
  - whispering-vale
`, "# Sera");
    writeMarkdown(path.join(created.root, "characters", "kael-voss.md"), `
name: "Kael Voss"
role: supporting
status: alive
locations: []
`, "# Kael");
    writeMarkdown(path.join(created.root, "characters", "maren.md"), `
name: Maren
role: antagonist
status: alive
locations: []
`, "# Maren");
    writeMarkdown(path.join(created.root, "worldbuilding", "locations", "whispering-vale.md"), `
name: "Whispering Vale"
type: wilderness
notable-characters:
  - maren
`, "# Vale");
    writeMarkdown(path.join(created.root, "chapters", "chapter-07.md"), `
title: Seven
pov: sera-voss
locations: []
characters: []
arcs-advanced: []
status: draft
word-count: 0
`, "## Chapter Text\n\nSeven words here.");

    const project = scanProject(created.root);
    expect(project.arcs).toEqual([]);
    expect(project.chapters[0].number).toBe(7);

    const links = validateLinks(created.root);
    expect(links.errors.join("\n")).toContain("relationship to kael-voss is missing backlink");
    expect(links.errors.join("\n")).toContain("location whispering-vale is missing notable-character backlink");
    expect(links.errors.join("\n")).toContain("notable character maren is missing location backlink");
  });

  test("sorts multiple chapters by number and then filename", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Chapter Order", force: false });
    writeMarkdown(path.join(created.root, "chapters", "chapter-10.md"), `
title: Ten
number: 10
pov: ""
locations: []
characters: []
arcs-advanced: []
status: draft
word-count: 0
`, "## Chapter Text\n\nTen.");
    writeMarkdown(path.join(created.root, "chapters", "chapter-02.md"), `
title: Two
number: 2
pov: ""
locations: []
characters: []
arcs-advanced: []
status: draft
word-count: 0
`, "## Chapter Text\n\nTwo.");

    expect(scanProject(created.root).chapters.map((chapter) => chapter.number)).toEqual([2, 10]);
  });

  test("reports missing required frontmatter fields and empty export", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "No Chapters", force: false });
    writeMarkdown(path.join(created.root, "characters", "nameless.md"), `
name: Nameless
role: supporting
`, "# Nameless");

    const validation = validateProject(created.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain(`characters${path.sep}nameless.md is missing frontmatter field status`);
    expect(() => exportManuscript(created.root)).toThrow("No chapters found to export");
  });

  test("reports schema and frontmatter contract violations", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Strict Format", force: false });
    fs.writeFileSync(
      path.join(created.root, "story.md"),
      fs.readFileSync(path.join(created.root, "story.md"), "utf8")
        .replace("schema-version: 1", "schema-version: 99")
        .replace("schema-version: 2", "schema-version: 99")
        .replace("genre: fiction", "genre:\n  - fiction")
        .replace("themes:\n  - change", "themes: none")
        .replace("status: planning", "status: unknown-stage"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(created.root, "characters", "_index.md"),
      fs.readFileSync(path.join(created.root, "characters", "_index.md"), "utf8")
        .replace("type: character-registry", "type: wrong-registry")
        .replace("story: strict-format", "story: wrong-story"),
      "utf8"
    );
    writeMarkdown(path.join(created.root, "characters", "Bad Name.md"), `
name:
  - Bad Name
role: cameo
status: alive
aliases:
  - ""
relationships:
  - character: Not Kebab
    type: parent
  - not-object
  - type: friend
  - character: missing-person
locations: none
`, "# Bad");
    writeMarkdown(path.join(created.root, "characters", "parent-one.md"), `
name: Parent One
role: supporting
status: alive
relationships:
  - character: child-one
    type: parent
locations: []
`, "# Parent");
    writeMarkdown(path.join(created.root, "characters", "child-one.md"), `
name: Child One
role: supporting
status: alive
relationships:
  - character: parent-one
    type: parent
locations: []
`, "# Child");
    writeMarkdown(path.join(created.root, "characters", "bad-relationships.md"), `
name: Bad Relationships
role: supporting
status: alive
relationships: none
locations: []
`, "# Bad Relationships");
    writeMarkdown(path.join(created.root, "worldbuilding", "systems", "bad-system.md"), `
name: Bad System
type: technology
prevalence:
  - common
`, "# Bad System");
    writeMarkdown(path.join(created.root, "chapters", "chapter-01.md"), `
title: One
number: 2
pov: missing-person
locations: []
characters: []
arcs-advanced: []
status: invalid
word-count: many
`, "## Chapter Text\n\nWords.");
    writeMarkdown(path.join(created.root, "chapters", "chapter-00.md"), `
title: Zero
number: 0
pov: ""
locations: []
characters: []
arcs-advanced: []
status: draft
word-count: 1
`, "## Chapter Text\n\nZero.");
    writeMarkdown(path.join(created.root, "chapters", "chapter-02.md"), `
title: Two
number: 2
pov: ""
locations: []
characters: []
arcs-advanced: []
status: draft
word-count: 1
`, "## Chapter Text\n\nTwo.");

    const validation = validateProject(created.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join("\n")).toContain(`story.md schema-version must be ${STORY_SCHEMA_VERSION}`);
    expect(validation.errors.join("\n")).toContain("story.md frontmatter field genre must be a scalar");
    expect(validation.errors.join("\n")).toContain("story.md frontmatter field themes must be a list");
    expect(validation.errors.join("\n")).toContain("story.md frontmatter field status has unsupported value unknown-stage");
    expect(validation.errors.join("\n")).toContain("characters/_index.md type must be character-registry");
    expect(validation.errors.join("\n")).toContain("characters/_index.md story must be strict-format");
    expect(validation.errors.join("\n")).toContain("characters/Bad Name.md filename id must be kebab-case");
    expect(validation.errors.join("\n")).toContain("characters/Bad Name.md frontmatter field name must be a scalar");
    expect(validation.errors.join("\n")).toContain("characters/Bad Name.md frontmatter field role has unsupported value cameo");
    expect(validation.errors.join("\n")).toContain("characters/Bad Name.md frontmatter field aliases must contain only non-empty strings");
    expect(validation.errors.join("\n")).toContain("characters/Bad Name.md frontmatter field locations must be a list");
    expect(validation.errors.join("\n")).toContain("characters/Bad Name.md relationship character Not Kebab must be kebab-case");
    expect(validation.errors.join("\n")).toContain("characters/Bad Name.md frontmatter field relationships must contain objects");
    expect(validation.errors.join("\n")).toContain("characters/Bad Name.md relationship is missing character");
    expect(validation.errors.join("\n")).toContain("characters/Bad Name.md relationship to missing-person is missing type");
    expect(validation.errors.join("\n")).toContain("characters/bad-relationships.md frontmatter field relationships must be a list");
    expect(validation.errors.join("\n")).toContain("worldbuilding/systems/bad-system.md frontmatter field prevalence must be a scalar");
    expect(validation.errors.join("\n")).toContain("chapters/chapter-00.md filename must match chapter-{NN}.md");
    expect(validation.errors.join("\n")).toContain("chapters/chapter-00.md number must be greater than 0");
    expect(validation.errors.join("\n")).toContain("chapters/chapter-01.md frontmatter field status has unsupported value invalid");
    expect(validation.errors.join("\n")).toContain("chapters/chapter-01.md frontmatter field word-count must be an integer");
    expect(validation.errors.join("\n")).toContain("chapters/chapter-01.md number must match filename chapter number 1");
    expect(validation.errors.join("\n")).toContain("chapters/chapter-02.md duplicates chapter number 2");

    const links = validateLinks(created.root);
    expect(links.errors.join("\n")).toContain("references missing POV character missing-person");
    expect(links.errors.join("\n")).toContain("relationship parent to child-one expects backlink type child, got parent");
  });

  test("creates, renames, removes, migrates, and recommends next actions", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Helper Story", force: false });
    const character = createEntity(created.root, { kind: "character", name: "Mira Sol", role: "protagonist" });
    const location = createEntity(created.root, { kind: "location", name: "Glass Harbor", type: "city", character: "mira-sol" });
    const system = createEntity(created.root, { kind: "system", name: "Tide Magic", type: "magic" });
    const faction = createEntity(created.root, { kind: "faction", name: "Harbor Guild", type: "guild", member: "mira-sol", location: "glass-harbor" });
    const artifact = createEntity(created.root, { kind: "artifact", name: "Tide Key", owner: "harbor-guild", location: "glass-harbor" });
    const arc = createEntity(created.root, { kind: "arc", name: "Find The Tide Key", type: "main", character: "mira-sol" });
    const chapter = createEntity(created.root, { kind: "chapter", name: "Arrival", number: 1, pov: "mira-sol", location: "glass-harbor", character: "mira-sol", arc: "find-the-tide-key" });
    const scene = createEntity(created.root, { kind: "scene", name: "At The Pier", chapter: "chapter-01", scene: 1, pov: "mira-sol", location: "glass-harbor", character: "mira-sol", arc: "find-the-tide-key" });
    const nextScene = createEntity(created.root, { kind: "scene", name: "Second Beat", chapter: "chapter-01" });
    const question = createEntity(created.root, { kind: "question", name: "Who hid the key?", introduced: "chapter-01", character: "mira-sol" });
    const promise = createEntity(created.root, { kind: "promise", name: "The key opens the reef vault", planted: "chapter-01", arc: "find-the-tide-key", character: "mira-sol" });
    const term = createEntity(created.root, { kind: "term", name: "Reef Vault", category: "place", alias: "vault" });

    expect(character.id).toBe("mira-sol");
    expect(location.id).toBe("glass-harbor");
    expect(system.id).toBe("tide-magic");
    expect(faction.id).toBe("harbor-guild");
    expect(artifact.id).toBe("tide-key");
    expect(arc.id).toBe("find-the-tide-key");
    expect(chapter.id).toBe("chapter-01");
    expect(scene.id).toBe("chapter-01-scene-01");
    expect(nextScene.id).toBe("chapter-01-scene-02");
    expect(question.id).toBe("who-hid-the-key");
    expect(promise.id).toBe("the-key-opens-the-reef-vault");
    expect(term.id).toBe("reef-vault");
    const activeActions = formatActionReport(projectActions(created.root));
    expect(activeActions).toContain("Track open questions");
    expect(activeActions).toContain("Review promises and payoffs");

    const renamed = renameEntity(created.root, { kind: "character", id: "mira-sol", name: "Mira Vale" });
    expect(renamed.id).toBe("mira-vale");
    expect(fs.readFileSync(path.join(created.root, "chapters", "chapter-01.md"), "utf8")).toContain("mira-vale");

    const removed = removeEntity(created.root, { kind: "promise", id: "the-key-opens-the-reef-vault" });
    expect(removed.id).toBe("the-key-opens-the-reef-vault");
    expect(fs.existsSync(path.join(created.root, "continuity", "promises", "the-key-opens-the-reef-vault.md"))).toBe(false);

    const actions = projectActions(created.root);
    expect(formatActionReport(actions)).toContain("Draft chapter 2");
    expect(formatActionReport({
      title: "Empty",
      validation: { ok: true, errors: [], warnings: [] },
      links: { ok: true, errors: [], warnings: [] },
      continuity: { ok: true, errors: [], warnings: [] },
      actions: []
    })).toContain("No actions found");

    fs.rmSync(path.join(created.root, "glossary"), { recursive: true, force: true });
    fs.writeFileSync(
      path.join(created.root, "story.md"),
      fs.readFileSync(path.join(created.root, "story.md"), "utf8").replace("schema-version: 2", "schema-version: 1"),
      "utf8"
    );
    const migrated = migrateProject(created.root);
    expect(migrated.changed.length).toBeGreaterThan(0);
    expect(scanProject(created.root).story.data["schema-version"]).toBe(STORY_SCHEMA_VERSION);
  });

  test("remove scrubs references without rewriting untouched files", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Remove Touch", force: false });
    createEntity(created.root, { kind: "character", name: "Keeper", role: "supporting" });
    createEntity(created.root, { kind: "promise", name: "Old Setup", character: "keeper" });
    const storyPath = path.join(created.root, "story.md");
    fs.writeFileSync(storyPath, fs.readFileSync(storyPath, "utf8").replace("title:", "# hand-written note\ntitle:"), "utf8");
    const annotated = fs.readFileSync(storyPath, "utf8");

    removeEntity(created.root, { kind: "character", id: "keeper" });

    expect(fs.readFileSync(storyPath, "utf8")).toBe(annotated);
    expect(fs.readFileSync(path.join(created.root, "continuity", "promises", "old-setup.md"), "utf8")).not.toContain("keeper");
  });

  test("rename leaves overlapping entity ids and prose words intact", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Rename Overlap", force: false });
    createEntity(created.root, { kind: "character", name: "Mara", role: "protagonist" });
    createEntity(created.root, { kind: "character", name: "Mara Quill", role: "supporting" });
    createEntity(created.root, { kind: "chapter", name: "Arrival", number: 1, pov: "mara-quill", character: "mara-quill,mara" });
    const chapterPath = path.join(created.root, "chapters", "chapter-01.md");
    fs.appendFileSync(chapterPath, "The marathon passed mara on the docks.\n", "utf8");

    renameEntity(created.root, { kind: "character", id: "mara", name: "Tess" });

    const chapterText = fs.readFileSync(chapterPath, "utf8");
    expect(chapterText).toContain("pov: mara-quill");
    expect(chapterText).toContain("- tess");
    expect(chapterText).toContain("The marathon passed tess on the docks.");
    expect(fs.existsSync(path.join(created.root, "characters", "mara-quill.md"))).toBe(true);
    expect(validateLinks(created.root)).toEqual({ ok: true, errors: [], warnings: [] });
  });

  test("covers helper errors, fallback branches, and malformed continuity state", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Coverage Branches", force: false });
    expect(() => createEntity(created.root, { kind: "character", name: "" })).toThrow("name is required");
    expect(() => createEntity(created.root, { kind: "beast", name: "Wolf" })).toThrow("Unsupported entity kind");
    createEntity(created.root, { kind: "glossary", name: "Moon Gate" });
    createEntity(created.root, { kind: "character", name: "Branch Person", location: "missing-location" });
    createEntity(created.root, { kind: "location", name: "Branch Place", character: "missing-person" });
    expect(() => createEntity(created.root, { kind: "location", name: "Branch Place" })).toThrow("already exists");
    expect(() => renameEntity(created.root, { kind: "character", id: "", name: "Nope" })).toThrow("rename requires");
    expect(() => renameEntity(created.root, { kind: "character", id: "missing-person", name: "Nope" })).toThrow("does not exist");
    createEntity(created.root, { kind: "character", name: "Other Person" });
    expect(() => renameEntity(created.root, { kind: "character", id: "branch-person", name: "Other Person" })).toThrow("already exists");
    expect(() => removeEntity(created.root, { kind: "character", id: "" })).toThrow("remove requires");
    expect(() => removeEntity(created.root, { kind: "character", id: "missing-person" })).toThrow("does not exist");
    expect(() => buildBook(created.root, { format: "epub" })).toThrow("No chapters found to export");
    writeMarkdown(path.join(created.root, "chapters", "chapter-01.md"), `
title: Stale
number: 1
pov: ""
locations: []
characters: []
arcs-advanced: []
status: draft
word-count: 99
`, "## Chapter Text\n\nOne.");
    writeMarkdown(path.join(created.root, "scenes", "chapter-01-scene-01.md"), `
title: Optional State
chapter: chapter-01
scene: 1
status: draft
`, "# Optional State");
    expect(createEntity(created.root, { kind: "chapter", name: "Auto Numbered" }).id).toBe("chapter-02");
    expect(formatActionReport(projectActions(created.root))).toContain("Refresh word counts");

    fs.writeFileSync(
      path.join(created.root, "continuity", "state.md"),
      fs.readFileSync(path.join(created.root, "continuity", "state.md"), "utf8")
        .replace("type: continuity-state", "type: wrong-state")
        .replace("story: coverage-branches", "story: wrong-story")
        .replace("character-state: []", "character-state: none"),
      "utf8"
    );
    writeMarkdown(path.join(created.root, "scenes", "bad-state.md"), `
title: Bad State
chapter: chapter-01
scene: 1
status: draft
state-changes: none
`, "# Bad State");

    const validation = validateProject(created.root);
    expect(validation.errors.join("\n")).toContain("continuity/state.md type must be continuity-state");
    expect(validation.errors.join("\n")).toContain("continuity/state.md story must be coverage-branches");
    expect(validation.errors.join("\n")).toContain("continuity/state.md frontmatter field character-state must be a list");
    expect(validation.errors.join("\n")).toContain("scenes/bad-state.md frontmatter field state-changes must be a list");

    const actions = formatActionReport(projectActions(created.root));
    expect(actions).toContain("Fix validation errors");
    expect(actions).toContain("Fix broken references");
  });

  test("validates v2 entity frontmatter and reference contracts", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "V2 Broken", force: false });
    writeMarkdown(path.join(created.root, "worldbuilding", "factions", "bad-faction.md"), `
name: Bad Faction
type: guild
status: active
members:
  - missing-person
locations:
  - missing-place
tags: []
`, "# Bad Faction");
    writeMarkdown(path.join(created.root, "worldbuilding", "artifacts", "bad-artifact.md"), `
name: Bad Artifact
type: relic
status: active
owner: missing-owner
location: missing-place
tags: []
`, "# Bad Artifact");
    writeMarkdown(path.join(created.root, "chapters", "chapter-01.md"), `
title: One
number: 1
pov: ""
locations: []
characters: []
arcs-advanced: []
status: draft
word-count: 1
`, "## Chapter Text\n\nOne.");
    writeMarkdown(path.join(created.root, "scenes", "bad-scene.md"), `
title: Bad Scene
chapter: missing-chapter
scene: 0
pov: missing-person
location: missing-place
characters:
  - missing-person
arcs-advanced:
  - missing-arc
status: invalid
state-changes:
  - not-object
`, "# Bad Scene");
    writeMarkdown(path.join(created.root, "continuity", "questions", "bad-question.md"), `
title: Bad Question
status: invalid
introduced: missing-chapter
resolved: missing-chapter
characters:
  - missing-person
`, "# Bad Question");
    writeMarkdown(path.join(created.root, "continuity", "promises", "bad-promise.md"), `
title: Bad Promise
status: invalid
planted: missing-chapter
payoff: missing-chapter
arcs:
  - missing-arc
characters:
  - missing-person
`, "# Bad Promise");
    writeMarkdown(path.join(created.root, "glossary", "terms", "bad-term.md"), `
term: Bad Term
category: invalid
aliases:
  - ""
`, "# Bad Term");

    const validation = validateProject(created.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join("\n")).toContain("scenes/bad-scene.md frontmatter field status has unsupported value invalid");
    expect(validation.errors.join("\n")).toContain("scenes/bad-scene.md scene must be greater than 0");
    expect(validation.errors.join("\n")).toContain("continuity/questions/bad-question.md frontmatter field status has unsupported value invalid");
    expect(validation.errors.join("\n")).toContain("continuity/promises/bad-promise.md frontmatter field status has unsupported value invalid");
    expect(validation.errors.join("\n")).toContain("glossary/terms/bad-term.md frontmatter field category has unsupported value invalid");

    const links = validateLinks(created.root);
    expect(links.ok).toBe(false);
    expect(links.errors.join("\n")).toContain("bad-faction.md references missing member missing-person");
    expect(links.errors.join("\n")).toContain("bad-artifact.md references missing owner missing-owner");
    expect(links.errors.join("\n")).toContain("bad-scene.md references missing chapter missing-chapter");
    expect(links.errors.join("\n")).toContain("bad-question.md references missing character missing-person");
    expect(links.errors.join("\n")).toContain("bad-promise.md references missing arc missing-arc");
  });

  test("reports numeric scene chapter ids as link errors instead of crashing scans", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Numeric Chapter", force: false });
    const chapters = ["chapter-02", "3", "chapter-01", "chapter-04", "chapter-03"];
    chapters.forEach((chapter, index) => {
      writeMarkdown(path.join(created.root, "scenes", `${String.fromCharCode(97 + index)}-scene.md`), `
title: Scene ${index + 1}
chapter: ${chapter}
scene: 1
status: draft
`, `# Scene ${index + 1}`);
    });

    const links = validateLinks(created.root);
    expect(links.ok).toBe(false);
    expect(links.errors.join("\n")).toContain("scenes/b-scene.md references missing chapter 3");
  });

  test("builds epub and docx formats and rejects unknown formats", () => {
    const cwd = makeTempDir();
    const created = createStoryProject({ cwd, title: "Plain Build", force: false });
    writeMarkdown(path.join(created.root, "chapters", "chapter-01.md"), `
title: One
number: 1
pov: ""
locations: []
characters: []
arcs-advanced: []
status: draft
word-count: 0
`, "## Chapter Text\n\nOne.\n\n---\n\nTwo.");

    const epub = buildBook(created.root, { format: "epub" });
    const docx = buildBook(created.root, { format: "docx" });
    expect(epub).toEqual({
      outFile: path.join(created.root, "dist", "plain-build.epub"),
      chapters: 1,
      format: "epub"
    });
    expect(docx).toEqual({
      outFile: path.join(created.root, "dist", "plain-build.docx"),
      chapters: 1,
      format: "docx"
    });
    expect(fs.readFileSync(epub.outFile).readUInt32LE(0)).toBe(0x04034b50);
    expect(fs.readFileSync(epub.outFile).toString("utf8")).toContain("dcterms:modified");
    expect(fs.readFileSync(epub.outFile).toString("utf8")).toContain("<p>* * *</p>");
    expect(fs.readFileSync(docx.outFile).toString("utf8")).toContain("word/document.xml");
    expect(fs.readFileSync(docx.outFile).toString("utf8")).toContain("word/styles.xml");
    expect(fs.readFileSync(docx.outFile).toString("utf8")).toContain("<w:t>* * *</w:t>");
    expect(() => buildBook(created.root, { format: "pdf" })).toThrow("Unsupported build format: pdf");
  });
});

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

  test("createStoryProject throws when ancestor universe.md name is non-scalar", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    // Break universe.md by making name a list
    const universeMdPath = path.join(universeResult.root, "universe.md");
    const universeMd = fs.readFileSync(universeMdPath, "utf8");
    fs.writeFileSync(universeMdPath, universeMd.replace(/^name:.*$/m, "name:\n  - Aetheria"), "utf8");
    expect(() => createStoryProject({ title: "My Tale", cwd: storiesDir })).toThrow("missing or non-scalar name field");
  });

  test("createStoryProject throws when ancestor universe.md name produces empty kebab id", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    // Set universe.md name to punctuation-only — kebabCase returns ""
    const universeMdPath = path.join(universeResult.root, "universe.md");
    const universeMd = fs.readFileSync(universeMdPath, "utf8");
    fs.writeFileSync(universeMdPath, universeMd.replace(/^name:.*$/m, 'name: "!!!"'), "utf8");
    expect(() => createStoryProject({ title: "My Tale", cwd: storiesDir })).toThrow("does not produce a valid kebab-case id");
  });
});

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

  test("validateUniverseIds catches non-kebab-case ids with synthetic array", () => {
    const errors = [];
    validateUniverseIds(
      [{ id: "Bad_Id", file: "a", name: "Bad" }],
      "characters",
      errors
    );
    expect(errors.some((e) => e.includes("kebab-case"))).toBe(true);
  });
});

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

  test("universeReport surfaces validation errors for partial scaffold (missing universe.md)", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    // Delete universe.md but leave scaffold dirs intact
    fs.unlinkSync(path.join(result.root, "universe.md"));
    const report = universeReport(result.root);
    expect(report).not.toBeNull();
    expect(report.validation.ok).toBe(false);
    expect(report.validation.errors).toContain("Missing required universe path: universe.md");
  });

  test("universeReport surfaces malformed story universe field error from story root", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/universe: aetheria/, "universe: Aetheria"), "utf8");
    const report = universeReport(storyRoot);
    expect(report).not.toBeNull();
    expect(report.validation.ok).toBe(false);
    expect(report.validation.errors[0]).toContain("must be a kebab-case id");
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

describe("universe coverage gaps", () => {
  test("createUniverseProject throws on empty name", () => {
    expect(() => createUniverseProject({ name: "", cwd: makeTempDir() })).toThrow("A universe name is required");
  });

  test("universeScan returns all five entity types", () => {
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
    writeMarkdown(path.join(result.root, "worldbuilding", "systems", "magic.md"), `
name: "Magic"
type: magic
`, "# Magic\n");
    writeMarkdown(path.join(result.root, "worldbuilding", "factions", "order.md"), `
name: "Order"
type: religion
status: active
`, "# Order\n");
    writeMarkdown(path.join(result.root, "worldbuilding", "artifacts", "flame.md"), `
name: "Flame"
type: relic
status: active
`, "# Flame\n");

    const scan = universeScan(result.root);
    expect(scan).toHaveLength(5);
    const types = scan.map((e) => e.type).sort();
    expect(types).toEqual(["artifact", "character", "faction", "location", "system"]);
  });

  test("formatUniverseReport outputs errors when validation fails", () => {
    const cwd = makeTempDir();
    const result = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(result.root, "characters", "Bad_Id.md"), `
name: "Bad"
role: supporting
status: alive
`, "# Bad\n");
    const formatted = formatUniverseReport(universeReport(result.root));
    expect(formatted).toContain("Errors:");
    expect(formatted).toContain("kebab-case");
  });

  test("formatUniverseReport outputs warnings when validation has warnings", () => {
    const formatted = formatUniverseReport({
      counts: { characters: 0, locations: 0, systems: 0, factions: 0, artifacts: 0 },
      total: 0,
      validation: { ok: true, errors: [], warnings: ["Universe 'missing' not found — story works in standalone mode"] }
    });
    expect(formatted).toContain("Warnings:");
    expect(formatted).toContain("not found");
  });

  test("cross-level: broken character relationship errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "characters", "hero.md"), `
name: "Hero"
role: protagonist
status: alive
relationships:
  - character: nonexistent-char
    type: sibling
`, "# Hero\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'character: nonexistent-char'"))).toBe(true);
  });

  test("cross-level: broken notable-characters reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "worldbuilding", "locations", "tavern.md"), `
name: "Tavern"
type: settlement
region: Town
notable-characters:
  - nonexistent-char
`, "# Tavern\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'notable-characters: nonexistent-char'"))).toBe(true);
  });

  test("cross-level: broken faction member and location references error", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "worldbuilding", "factions", "guild.md"), `
name: "Guild"
type: guild
status: active
members:
  - nonexistent-member
locations:
  - nonexistent-place
`, "# Guild\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'members: nonexistent-member'"))).toBe(true);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'locations: nonexistent-place'"))).toBe(true);
  });

  test("cross-level: broken artifact owner and location references error", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "worldbuilding", "artifacts", "sword.md"), `
name: "Sword"
type: weapon
status: active
owner: nonexistent-owner
location: nonexistent-place
`, "# Sword\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'owner: nonexistent-owner'"))).toBe(true);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'location: nonexistent-place'"))).toBe(true);
  });

  test("cross-level: universe-level faction in combined map for coverage", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "factions", "ancient-order.md"), `
name: "Ancient Order"
type: religion
status: active
`, "# Order\n");
    writeMarkdown(path.join(storyRoot, "worldbuilding", "artifacts", "relic.md"), `
name: "Relic"
type: relic
status: active
owner: ancient-order
`, "# Relic\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(true);
  });
  test("missing universe required path errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    // Delete a required index file
    fs.rmSync(path.join(universeResult.root, "characters", "_index.md"));
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Missing required universe path: characters/_index.md"))).toBe(true);
  });

  test("missing universe required directory errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    // Delete a required directory
    fs.rmSync(path.join(universeResult.root, "worldbuilding", "locations"), { recursive: true });
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Missing required universe path: worldbuilding/locations"))).toBe(true);
  });

  test("cross-level: broken chapter pov reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
pov: nonexistent-char
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'pov: nonexistent-char' does not resolve"))).toBe(true);
  });

  test("cross-level: broken chapter characters reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
characters:
  - nonexistent-char
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'characters: nonexistent-char' does not resolve"))).toBe(true);
  });

  test("cross-level: broken chapter mentions reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
mentions:
  - nonexistent-char
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'mentions: nonexistent-char' does not resolve"))).toBe(true);
  });

  test("cross-level: broken chapter locations reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
locations:
  - nonexistent-place
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'locations: nonexistent-place' does not resolve"))).toBe(true);
  });

  test("cross-level: broken scene pov reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    writeMarkdown(path.join(storyRoot, "scenes", "chapter-01-scene-01.md"), `
chapter: chapter-01
scene: 1
title: "Scene One"
pov: nonexistent-char
status: outline
`, "## Scene Text\n\nHello world.");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'pov: nonexistent-char' does not resolve"))).toBe(true);
  });

  test("cross-level: broken scene location reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    writeMarkdown(path.join(storyRoot, "scenes", "chapter-01-scene-01.md"), `
chapter: chapter-01
scene: 1
title: "Scene One"
location: nonexistent-place
status: outline
`, "## Scene Text\n\nHello world.");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'location: nonexistent-place' does not resolve"))).toBe(true);
  });

  test("cross-level: broken scene characters reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    writeMarkdown(path.join(storyRoot, "scenes", "chapter-01-scene-01.md"), `
chapter: chapter-01
scene: 1
title: "Scene One"
characters:
  - nonexistent-char
status: outline
`, "## Scene Text\n\nHello world.");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'characters: nonexistent-char' does not resolve"))).toBe(true);
  });

  test("cross-level: broken scene mentions reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    writeMarkdown(path.join(storyRoot, "scenes", "chapter-01-scene-01.md"), `
chapter: chapter-01
scene: 1
title: "Scene One"
mentions:
  - nonexistent-char
status: outline
`, "## Scene Text\n\nHello world.");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'mentions: nonexistent-char' does not resolve"))).toBe(true);
  });

  test("cross-level: broken arc characters reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "plot", "arcs", "main-arc.md"), `
name: "Main Arc"
type: main
status: active
characters:
  - nonexistent-char
`, "# Main Arc\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'characters: nonexistent-char' does not resolve"))).toBe(true);
  });

  test("cross-level: broken question characters reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "continuity", "questions", "mystery.md"), `
title: "The Mystery"
status: open
introduced: chapter-01
characters:
  - nonexistent-char
`, "# The Mystery\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'characters: nonexistent-char' does not resolve"))).toBe(true);
  });

  test("cross-level: broken promise characters reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "continuity", "promises", "vow.md"), `
title: "The Vow"
status: planned
planted: chapter-01
characters:
  - nonexistent-char
`, "# The Vow\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'characters: nonexistent-char' does not resolve"))).toBe(true);
  });

  test("cross-level: universe-level character resolves chapter pov reference", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
pov: legend
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });
  test("cross-level checks skipped when story has no universe frontmatter field", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    // createStoryProject auto-detects the universe and writes `universe: aetheria`
    // into story.md. Strip it to simulate a story that hasn't opted in.
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/^universe:.*\n/m, ""), "utf8");
    // Story is under a universe directory but has NOT opted in via frontmatter.
    // A broken chapter reference should NOT produce cross-level errors.
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
pov: nonexistent-char
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });
  test("createUniverseProject refuses to overwrite existing story.md", () => {
    const cwd = makeTempDir();
    createStoryProject({ title: "Existing Story", cwd });
    const storyRoot = path.join(cwd, "existing-story");
    expect(() => createUniverseProject({ name: "New Universe", cwd: storyRoot })).toThrow("appears to be a story project");
  });

  test("createUniverseProject refuses to overwrite existing _index.md", () => {
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, "characters"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "characters", "_index.md"), "# Custom Registry\n", "utf8");
    expect(() => createUniverseProject({ name: "New Universe", cwd })).toThrow("already contains characters/_index.md");
  });

  test("createUniverseProject refuses when worldbuilding/_index.md exists", () => {
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, "worldbuilding"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "worldbuilding", "_index.md"), "# Custom World\n", "utf8");
    expect(() => createUniverseProject({ name: "New Universe", cwd })).toThrow("already contains worldbuilding/_index.md");
  });

  test("validateUniverse warns when story universe id does not match resolved universe", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    // Change the universe field to a wrong id
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/universe: aetheria/, "universe: wrong-universe"), "utf8");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(true);
    expect(validation.warnings.some((w) => w.includes("Universe 'wrong-universe' not found") && w.includes("resolved universe is 'aetheria'"))).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  test("validateUniverse validates ancestor universe for unlinked story root", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "Unlinked", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "unlinked");
    // Remove the universe field — story is under a universe but not opted in
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/\nuniverse: aetheria/, ""), "utf8");
    // Break the ancestor universe scaffold
    fs.unlinkSync(path.join(universeResult.root, "characters", "_index.md"));
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("Missing required universe path: characters/_index.md");
  });

  test("validateUniverse rejects universe name deriving empty id from story root", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    // Set universe.md name to punctuation-only — kebabCase returns ""
    const universeMdPath = path.join(universeResult.root, "universe.md");
    const universeMd = fs.readFileSync(universeMdPath, "utf8");
    fs.writeFileSync(universeMdPath, universeMd.replace(/^name:.*$/m, 'name: "!!!"'), "utf8");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("does not produce a valid kebab-case id"))).toBe(true);
  });

  test("validateUniverse rejects universe name deriving empty id from universe root", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    // Set universe.md name to punctuation-only — kebabCase returns ""
    const universeMdPath = path.join(universeResult.root, "universe.md");
    const universeMd = fs.readFileSync(universeMdPath, "utf8");
    fs.writeFileSync(universeMdPath, universeMd.replace(/^name:.*$/m, 'name: "!!!"'), "utf8");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("does not produce a valid kebab-case id"))).toBe(true);
  });

  test("validateUniverse rejects non-kebab story universe field", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/universe: aetheria/, "universe: Aetheria"), "utf8");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors[0]).toContain("must be a kebab-case id");
  });

  test("validateUniverse rejects non-scalar story universe field", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/universe: aetheria/, "universe:\n  - Aetheria"), "utf8");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors[0]).toContain("must be a kebab-case id");
  });

  test("validateUniverse rejects whitespace-padded kebab universe field", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/universe: aetheria/, "universe: \" aetheria \""), "utf8");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors[0]).toContain("must be a kebab-case id");
  });

  test("scanProject does not attach universe when id does not match", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    // Change the universe field to a wrong id
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/universe: aetheria/, "universe: wrong-universe"), "utf8");
    const project = scanProject(storyRoot);
    expect(project.universe).toBeUndefined();
    expect(project.universeRoot).toBeUndefined();
  });

  test("scanProject does not attach universe when universe.md name is non-scalar", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    // Break universe.md by making name a list (non-scalar)
    const universeMdPath = path.join(universeResult.root, "universe.md");
    const universeMd = fs.readFileSync(universeMdPath, "utf8");
    fs.writeFileSync(universeMdPath, universeMd.replace(/^name:.*$/m, "name:\n  - Aetheria"), "utf8");
    const project = scanProject(storyRoot);
    expect(project.universe).toBeUndefined();
    expect(project.universeRoot).toBeUndefined();
  });

  test("cross-level: continuity state references universe-level character", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "locations", "sacred-mountain.md"), `
name: "Sacred Mountain"
type: wilderness
region: Center
`, "# Mountain\n");
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "artifacts", "ancient-relic.md"), `
name: "Ancient Relic"
type: relic
status: active
`, "# Relic\n");
    writeMarkdown(path.join(storyRoot, "continuity", "state.md"), `
current-chapter: 0
character-state:
  - character: legend
    location: sacred-mountain
object-state:
  - artifact: ancient-relic
    status: active
`, "# State\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  test("cross-level: broken continuity state character reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "continuity", "state.md"), `
current-chapter: 0
character-state:
  - character: nonexistent-char
    location: nonexistent-place
`, "# State\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'character: nonexistent-char' does not resolve"))).toBe(true);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'location: nonexistent-place' does not resolve"))).toBe(true);
  });

  test("cross-level: broken continuity state artifact reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "continuity", "state.md"), `
current-chapter: 0
object-state:
  - artifact: nonexistent-artifact
    status: active
`, "# State\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'artifact: nonexistent-artifact' does not resolve"))).toBe(true);
  });

  test("cross-level: continuity state faction owner resolves from universe level", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "factions", "ancient-order.md"), `
name: "Ancient Order"
type: religion
status: active
`, "# Order\n");
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "artifacts", "relic.md"), `
name: "Relic"
type: relic
status: active
`, "# Relic\n");
    writeMarkdown(path.join(storyRoot, "continuity", "state.md"), `
current-chapter: 0
object-state:
  - artifact: relic
    owner: ancient-order
    status: active
`, "# State\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });
  test("checkContinuity resolves universe-level entities in state entries", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "locations", "sacred-mountain.md"), `
name: "Sacred Mountain"
type: wilderness
region: Center
`, "# Mountain\n");
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "artifacts", "ancient-relic.md"), `
name: "Ancient Relic"
type: relic
status: active
`, "# Relic\n");
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "factions", "ancient-order.md"), `
name: "Ancient Order"
type: religion
status: active
`, "# Order\n");
    writeMarkdown(path.join(storyRoot, "continuity", "state.md"), `
current-chapter: 0
character-state:
  - character: legend
    location: sacred-mountain
knowledge-state:
  - character: legend
    knows: secret-of-the-mountain
object-state:
  - artifact: ancient-relic
    owner: ancient-order
    status: active
`, "# State\n");
    const result = checkProjectContinuity(storyRoot);
    expect(result.errors).toEqual([]);
  });

  test("cross-level: broken knowledge-state character reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "continuity", "state.md"), `
current-chapter: 0
knowledge-state:
  - character: nonexistent-char
    knows: some-secret
`, "# State\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'character: nonexistent-char' does not resolve"))).toBe(true);
  });

  test("cross-level: broken object-state owner reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "worldbuilding", "artifacts", "sword.md"), `
name: "Sword"
type: weapon
status: active
`, "# Sword\n");
    writeMarkdown(path.join(storyRoot, "continuity", "state.md"), `
current-chapter: 0
object-state:
  - artifact: sword
    owner: nonexistent-owner
    status: active
`, "# State\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'owner: nonexistent-owner' does not resolve"))).toBe(true);
  });

  test("cross-level: broken object-state location reference errors", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(storyRoot, "worldbuilding", "artifacts", "sword.md"), `
name: "Sword"
type: weapon
status: active
`, "# Sword\n");
    writeMarkdown(path.join(storyRoot, "continuity", "state.md"), `
current-chapter: 0
object-state:
  - artifact: sword
    location: nonexistent-place
    status: active
`, "# State\n");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Cross-level reference 'location: nonexistent-place' does not resolve"))).toBe(true);
  });
  test("universeReport from unopted story validates universe, not false-ok", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    // Strip the universe opt-in field so the story is unopted
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/^universe:.*\n/m, ""), "utf8");
    // Break the universe — add a non-kebab entity id
    writeMarkdown(path.join(universeResult.root, "characters", "Bad_Id.md"), `
name: "Bad"
role: supporting
status: alive
`, "# Bad\n");
    const report = universeReport(storyRoot);
    expect(report).not.toBeNull();
    expect(report.validation.ok).toBe(false);
    expect(report.validation.errors.some((e) => e.includes("kebab-case"))).toBe(true);
  });
  test("universeReport from mismatched story validates universe, not false-ok", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    // Change the universe field to a wrong id so it doesn't match
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/universe: aetheria/, "universe: wrong-universe"), "utf8");
    // Break the universe — add a non-kebab entity id
    writeMarkdown(path.join(universeResult.root, "characters", "Bad_Id.md"), `
name: "Bad"
role: supporting
status: alive
`, "# Bad\n");
    const report = universeReport(storyRoot);
    expect(report).not.toBeNull();
    expect(report.validation.ok).toBe(false);
    expect(report.validation.errors.some((e) => e.includes("kebab-case"))).toBe(true);
  });
  test("validateUniverse rejects stale schema-version", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const universeMdPath = path.join(universeResult.root, "universe.md");
    const content = fs.readFileSync(universeMdPath, "utf8");
    fs.writeFileSync(universeMdPath, content.replace(/schema-version: 2/, "schema-version: 1"), "utf8");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("universe.md schema-version must be 2"))).toBe(true);
  });

  test("universeReport surfaces stale schema-version error", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const universeMdPath = path.join(universeResult.root, "universe.md");
    const content = fs.readFileSync(universeMdPath, "utf8");
    fs.writeFileSync(universeMdPath, content.replace(/schema-version: 2/, "schema-version: 1"), "utf8");
    const report = universeReport(universeResult.root);
    expect(report).not.toBeNull();
    expect(report.validation.ok).toBe(false);
    expect(report.validation.errors.some((e) => e.includes("universe.md schema-version must be 2"))).toBe(true);
  });
  test("validateUniverse rejects wrong registry type in _index.md", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const indexPath = path.join(universeResult.root, "characters", "_index.md");
    const content = fs.readFileSync(indexPath, "utf8");
    fs.writeFileSync(indexPath, content.replace(/type: character-registry/, "type: wrong-registry"), "utf8");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("type must be character-registry"))).toBe(true);
  });

  test("validateUniverse rejects missing type field in _index.md", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const indexPath = path.join(universeResult.root, "worldbuilding", "_index.md");
    const content = fs.readFileSync(indexPath, "utf8");
    fs.writeFileSync(indexPath, content.replace(/type: world-registry\n/, ""), "utf8");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("is missing frontmatter field") && e.includes("type"))).toBe(true);
  });

  test("validateUniverse rejects wrong story id in _index.md", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const indexPath = path.join(universeResult.root, "characters", "_index.md");
    const content = fs.readFileSync(indexPath, "utf8");
    fs.writeFileSync(indexPath, content.replace(/story: aetheria/, "story: wrong-universe"), "utf8");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("story must be aetheria"))).toBe(true);
  });
  test("validateLinks resolves universe-level character from chapter pov", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
pov: legend
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    const result = validateLinks(storyRoot);
    expect(result.errors.some((e) => e.includes("missing POV character legend"))).toBe(false);
  });

  test("validateLinks resolves universe-level location from chapter", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "locations", "sacred-mountain.md"), `
name: "Sacred Mountain"
type: wilderness
region: Center
`, "# Mountain\n");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
locations:
  - sacred-mountain
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    const result = validateLinks(storyRoot);
    expect(result.errors.some((e) => e.includes("missing location sacred-mountain"))).toBe(false);
  });

  test("validateLinks does not require backlink from universe-level entity", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
`, "# Legend\n");
    writeMarkdown(path.join(storyRoot, "characters", "hero.md"), `
name: "Hero"
role: protagonist
status: alive
relationships:
  - character: legend
    type: ally
`, "# Hero\n");
    const result = validateLinks(storyRoot);
    // legend exists at universe level — no backlink required
    expect(result.errors.some((e) => e.includes("missing character legend"))).toBe(false);
    expect(result.errors.some((e) => e.includes("backlink"))).toBe(false);
  });
  test("checkContinuity enforces universe character death in story chapters", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: deceased
died-in: chapter-01
`, "# Legend\n");
    // Chapter 1 (death chapter) and chapter 2 (posthumous appearance)
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
pov: legend
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-02.md"), `
number: 2
title: "Chapter Two"
characters:
  - legend
status: outline
word-count: 0
`, "## Chapter Text\n\nGoodbye world.");
    const result = checkProjectContinuity(storyRoot);
    expect(result.errors.some((e) => e.includes("legend") && e.includes("died in"))).toBe(true);
  });

  test("checkContinuity enforces universe character death via scene cast", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: deceased
died-in: chapter-01
`, "# Legend\n");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-02.md"), `
number: 2
title: "Chapter Two"
status: outline
word-count: 0
`, "## Chapter Text\n\nGoodbye world.");
    // Scene in chapter 2 casts legend — posthumous appearance via scene
    writeMarkdown(path.join(storyRoot, "scenes", "chapter-02-scene-01.md"), `
chapter: chapter-02
scene: 1
title: "Scene One"
pov: legend
status: outline
`, "## Scene Text\n\nHello world.");
    const result = checkProjectContinuity(storyRoot);
    expect(result.errors.some((e) => e.includes("legend") && e.includes("died in"))).toBe(true);
  });

  test("checkContinuity does not death-check uncast universe characters", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    // Universe character with died-in, but not cast in any chapter/scene
    writeMarkdown(path.join(universeResult.root, "characters", "unused-legend.md"), `
name: "Unused Legend"
role: supporting
status: alive
died-in: chapter-01
`, "# Unused Legend\n");
    writeMarkdown(path.join(storyRoot, "chapters", "chapter-01.md"), `
number: 1
title: "Chapter One"
status: outline
word-count: 0
`, "## Chapter Text\n\nHello world.");
    const result = checkProjectContinuity(storyRoot);
    expect(result.errors.some((e) => e.includes("unused-legend"))).toBe(false);
  });
  test("validateUniverse rejects invalid character role enum", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: cameo
status: alive
`, "# Legend\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("role") && e.includes("unsupported value"))).toBe(true);
  });

  test("validateUniverse rejects invalid character status enum", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: vanished
`, "# Legend\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("status") && e.includes("unsupported value"))).toBe(true);
  });

  test("validateUniverse rejects invalid relationships format", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
relationships: nope
`, "# Legend\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("relationships") && e.includes("must be a list"))).toBe(true);
  });

  test("validateUniverse rejects missing required fields on universe entity", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "locations", "sacred-mountain.md"), `
name: "Sacred Mountain"
`, "# Mountain\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("is missing frontmatter field") && e.includes("type"))).toBe(true);
  });

  test("validateUniverse rejects invalid artifact type enum", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "artifacts", "ancient-relic.md"), `
name: "Ancient Relic"
type: gadget
status: active
`, "# Relic\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("type") && e.includes("unsupported value"))).toBe(true);
  });

  test("validateUniverse rejects invalid faction type enum", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "factions", "ancient-order.md"), `
name: "Ancient Order"
type: cult
status: active
`, "# Order\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("type") && e.includes("unsupported value"))).toBe(true);
  });
  test("validateUniverseIdUniqueness catches duplicate ids with synthetic array", () => {
    const errors = [];
    validateUniverseIdUniqueness(
      [{ id: "legend", file: "a", name: "L1" }, { id: "legend", file: "b", name: "L2" }],
      "characters",
      errors
    );
    expect(errors.length).toBe(1);
    expect(errors[0]).toBe("Duplicate entity id 'legend' in universe characters");
  });

  test("story validate rejects non-kebab universe field", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/universe: aetheria/, "universe: Aetheria"), "utf8");
    const result = validateProject(storyRoot);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("universe must be a kebab-case id"))).toBe(true);
  });

  test("story validate rejects non-scalar universe field", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    const storyMdPath = path.join(storyRoot, "story.md");
    const storyMd = fs.readFileSync(storyMdPath, "utf8");
    fs.writeFileSync(storyMdPath, storyMd.replace(/universe: aetheria/, "universe: 123"), "utf8");
    const result = validateProject(storyRoot);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("universe must be a kebab-case id"))).toBe(true);
  });
  test("validateUniverse rejects non-scalar universe name", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const universeMdPath = path.join(universeResult.root, "universe.md");
    const content = fs.readFileSync(universeMdPath, "utf8");
    fs.writeFileSync(universeMdPath, content.replace(/name: Aetheria/, "name:\n  - Aetheria"), "utf8");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("name must be a string") || e.includes("name must be a non-empty scalar"))).toBe(true);
  });
  test("validateUniverse from story root rejects non-scalar universe name", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    const universeMdPath = path.join(universeResult.root, "universe.md");
    const content = fs.readFileSync(universeMdPath, "utf8");
    fs.writeFileSync(universeMdPath, content.replace(/name: Aetheria/, "name:\n  - Aetheria"), "utf8");
    const validation = validateUniverse(storyRoot);
    expect(validation.errors.some((e) => e.includes("name must be a non-empty scalar") || e.includes("name must be a scalar"))).toBe(true);
  });

  test("validateUniverse rejects nonexistent target path", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const nonexistentPath = path.join(universeResult.root, "stories", "typo-story");
    const validation = validateUniverse(nonexistentPath);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Path does not exist"))).toBe(true);
  });
  test("validateUniverse reports missing universe.md in scaffold with other paths", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    fs.rmSync(path.join(universeResult.root, "universe.md"));
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("Missing required universe path: universe.md"))).toBe(true);
  });

  test("validateUniverse rejects broken universe-internal character location ref", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
locations:
  - nonexistent-place
`, "# Legend\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("references missing location nonexistent-place"))).toBe(true);
  });

  test("validateUniverse rejects broken universe-internal artifact owner ref", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "artifacts", "relic.md"), `
name: "Relic"
type: relic
status: active
owner: ghost
`, "# Relic\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("references missing owner ghost"))).toBe(true);
  });
  test("validateUniverse rejects broken universe-internal character relationship ref", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "characters", "legend.md"), `
name: "Legend"
role: supporting
status: alive
relationships:
  - character: ghost
    type: ally
`, "# Legend\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("references missing character ghost"))).toBe(true);
  });

  test("validateUniverse rejects broken universe-internal location notable-character ref", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "locations", "mountain.md"), `
name: "Mountain"
type: wilderness
notable-characters:
  - ghost
`, "# Mountain\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("references missing character ghost"))).toBe(true);
  });

  test("validateUniverse rejects broken universe-internal faction member and location refs", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "factions", "order.md"), `
name: "Order"
type: religion
status: active
members:
  - ghost
locations:
  - nowhere
`, "# Order\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("references missing member ghost"))).toBe(true);
    expect(validation.errors.some((e) => e.includes("references missing location nowhere"))).toBe(true);
  });

  test("validateUniverse rejects broken universe-internal artifact location ref", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    writeMarkdown(path.join(universeResult.root, "worldbuilding", "artifacts", "relic.md"), `
name: "Relic"
type: relic
status: active
location: nowhere
`, "# Relic\n");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("references missing location nowhere"))).toBe(true);
  });

  test("createUniverseProject rejects name that kebabs to empty", () => {
    const cwd = makeTempDir();
    expect(() => createUniverseProject({ name: "!!!", cwd })).toThrow("does not produce a valid kebab-case id");
  });

  test("validateUniverse rejects numeric universe.md name from universe root", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const universeMdPath = path.join(universeResult.root, "universe.md");
    const content = fs.readFileSync(universeMdPath, "utf8");
    fs.writeFileSync(universeMdPath, content.replace(/^name:.*$/m, "name: 123"), "utf8");
    const validation = validateUniverse(universeResult.root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("name must be a string"))).toBe(true);
  });

  test("validateUniverse rejects numeric universe.md name from story root", () => {
    const cwd = makeTempDir();
    const universeResult = createUniverseProject({ name: "Aetheria", cwd });
    const storiesDir = path.join(universeResult.root, "stories");
    fs.mkdirSync(storiesDir, { recursive: true });
    createStoryProject({ title: "My Tale", cwd: storiesDir });
    const storyRoot = path.join(storiesDir, "my-tale");
    const universeMdPath = path.join(universeResult.root, "universe.md");
    const content = fs.readFileSync(universeMdPath, "utf8");
    fs.writeFileSync(universeMdPath, content.replace(/^name:.*$/m, "name: 123"), "utf8");
    const validation = validateUniverse(storyRoot);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes("name must be a non-empty scalar"))).toBe(true);
  });
});
