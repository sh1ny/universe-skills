import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs, runCli } from "../src/cli.js";
import { createStoryProject, createUniverseProject } from "../src/story.js";
import { makeTempDir, memoryIo, writeMarkdown } from "./helpers.js";

function invoke(cwd, argv) {
  const io = memoryIo(cwd);
  const code = runCli(argv, io);
  return { code, out: io.output(), err: io.error() };
}

function addMinimalChapter(root) {
  writeMarkdown(path.join(root, "chapters", "chapter-01.md"), `
title: One
number: 1
pov: ""
locations: []
characters: []
arcs-advanced: []
status: draft
word-count: 0
`, "## Chapter Text\n\nOne two.");
}

describe("cli", () => {
  test("parses options and repeated values", () => {
    expect(parseArgs(["init", "A", "--theme", "x", "--theme=y", "--force", "-h"])).toEqual({
      positionals: ["init", "A"],
      options: { theme: ["x", "y"], force: true, help: true }
    });
  });

  test("prints help and handles unknown commands", () => {
    const cwd = makeTempDir();
    expect(invoke(cwd, []).out).toContain("Usage: story");
    expect(invoke(cwd, ["help"]).out).toContain("Commands:");
    const help = invoke(cwd, ["--help"]).out;
    expect(help).toContain("validate");
    expect(help).toContain("continuity [path]");
    expect(help).toContain("import <source>");
    expect(help).toContain("--title <name>");
    expect(help).toContain("--role <name>");
    expect(help).toContain("--introduced <id>");
    expect(help).toContain("--category <name>");
    const unknown = invoke(cwd, ["nope"]);
    expect(unknown.code).toBe(1);
    expect(unknown.err).toContain("Unknown command: nope");
  });

  test("runs init, validate, wordcount, reindex, links, and export commands", () => {
    const cwd = makeTempDir();
    const init = invoke(cwd, [
      "init",
      "CLI",
      "Story",
      "--genre=fantasy",
      "--sub-genre",
      "epic",
      "--setting-era",
      "future",
      "--themes",
      "hope,loss",
      "--pov",
      "first-person",
      "--tense",
      "present",
      "--synopsis",
      "A test story.",
      "--force"
    ]);
    expect(init.code).toBe(0);
    expect(init.out).toContain("Created story project:");

    const root = path.join(cwd, "cli-story");
    addMinimalChapter(root);
    expect(invoke(cwd, ["wordcount", root]).out).toContain("Total: 2");
    expect(invoke(cwd, ["wordcount", root, "--write"]).out).toContain("chapters/chapter-01.md: 2");
    expect(fs.readFileSync(path.join(root, "chapters", "_index.md"), "utf8")).toContain("Total Word Count: 2");
    expect(invoke(cwd, ["reindex", root]).out).toContain("Registries already up to date");
    expect(invoke(cwd, ["validate", root]).out).toContain("Project is valid");
    expect(invoke(cwd, ["links", root]).out).toContain("Links are valid");
    const report = invoke(cwd, ["report", root]);
    expect(report.out).toContain("# CLI Story");
    expect(report.out).toContain("Schema version: 2");
    expect(report.out).toContain("- Total words: 2");
    expect(invoke(cwd, ["report", root, "--actionable"]).out).toContain("Next Actions:");
    expect(invoke(cwd, ["next", root]).out).toContain("Draft chapter 2");
    expect(invoke(cwd, ["doctor", root]).out).toContain("Story Doctor");
    expect(invoke(cwd, ["export", root, "--out", "out.md"]).out).toContain("Exported 1 chapters");
    const build = invoke(cwd, ["build", root]);
    expect(build.out).toContain("Built 1 chapters as markdown");
    expect(fs.existsSync(path.join(root, "dist", "cli-story.md"))).toBe(true);
    expect(invoke(cwd, ["build", root, "--format", "epub"]).out).toContain("as epub");
    expect(fs.existsSync(path.join(root, "dist", "cli-story.epub"))).toBe(true);
  });

  test("reports command failures", () => {
    const cwd = makeTempDir();
    const init = invoke(cwd, ["init"]);
    expect(init.code).toBe(1);
    expect(init.err).toContain("A story title is required");

    const validate = invoke(cwd, ["validate"]);
    expect(validate.code).toBe(1);
    expect(validate.err).toContain("Missing required path");

    const created = invoke(cwd, ["init", "Broken"]);
    expect(created.code).toBe(0);
    writeMarkdown(path.join(cwd, "broken", "chapters", "chapter-01.md"), `
title: Broken
number: 1
pov: ""
locations:
  - missing-place
characters: []
arcs-advanced: []
status: draft
word-count: 0
`, "## Chapter Text\n\nWords.");
    const links = invoke(cwd, ["links", path.join(cwd, "broken")]);
    expect(links.code).toBe(1);
    expect(links.err).toContain("references missing location missing-place");

    const build = invoke(cwd, ["build", path.join(cwd, "broken"), "--format", "pdf"]);
    expect(build.code).toBe(1);
    expect(build.err).toContain("Unsupported build format: pdf");
  });

  test("runs add, rename, remove, and migrate commands", () => {
    const cwd = makeTempDir();
    expect(invoke(cwd, ["init", "Helpers"]).code).toBe(0);
    const root = path.join(cwd, "helpers");

    const character = invoke(cwd, ["add", "character", "Ada Reed", "--path", root, "--role", "protagonist"]);
    expect(character.code).toBe(0);
    expect(character.out).toContain("Created character ada-reed");
    expect(fs.existsSync(path.join(root, "characters", "ada-reed.md"))).toBe(true);

    const renamed = invoke(cwd, ["rename", "character", "ada-reed", "Ada Vale", "--path", root]);
    expect(renamed.code).toBe(0);
    expect(fs.existsSync(path.join(root, "characters", "ada-vale.md"))).toBe(true);

    const removed = invoke(cwd, ["remove", "character", "ada-vale", "--path", root]);
    expect(removed.code).toBe(0);
    expect(fs.existsSync(path.join(root, "characters", "ada-vale.md"))).toBe(false);

    fs.rmSync(path.join(root, "scenes"), { recursive: true, force: true });
    fs.writeFileSync(
      path.join(root, "story.md"),
      fs.readFileSync(path.join(root, "story.md"), "utf8").replace("schema-version: 2", "schema-version: 1"),
      "utf8"
    );
    const migrated = invoke(cwd, ["migrate", root]);
    expect(migrated.code).toBe(0);
    expect(migrated.out).toContain("Migrated project");
    expect(fs.existsSync(path.join(root, "scenes", "_index.md"))).toBe(true);
  });

  test("runs continuity and import commands", () => {
    const cwd = makeTempDir();
    expect(invoke(cwd, ["init", "Checked"]).code).toBe(0);
    const root = path.join(cwd, "checked");
    addMinimalChapter(root);

    const clean = invoke(cwd, ["continuity", root]);
    expect(clean.code).toBe(0);
    expect(clean.out).toContain("Continuity is consistent");

    writeMarkdown(path.join(root, "continuity", "promises", "ghost-payoff.md"), `
title: Ghost Payoff
status: paid-off
planted: ""
payoff: ""
`, "# Ghost Payoff\n");
    const broken = invoke(cwd, ["continuity", root]);
    expect(broken.code).toBe(1);
    expect(broken.err).toContain("ghost-payoff.md is paid-off but has no payoff chapter");

    fs.writeFileSync(path.join(cwd, "book.md"), "## Chapter 1: Door\n\nThe door held fast.\n\n## Chapter 2: Smoke\n\nSmoke crept under it.", "utf8");
    const imported = invoke(cwd, ["import", "book.md", "--title", "Imported Tale", "--genre", "mystery"]);
    expect(imported.code).toBe(0);
    expect(imported.out).toContain("Imported 2 chapters");
    expect(invoke(cwd, ["validate", path.join(cwd, "imported-tale")]).code).toBe(0);

    fs.writeFileSync(path.join(cwd, "names.md"), "## Chapter 1\n\nHe met Vex Marrow. She trusted Vex Marrow. They feared Vex Marrow.", "utf8");
    const withCandidates = invoke(cwd, ["import", "names.md", "--title", "Named Tale"]);
    expect(withCandidates.out).toContain("Entity candidates");
    expect(withCandidates.out).toContain("- Vex Marrow (3 mentions)");

    const failed = invoke(cwd, ["import"]);
    expect(failed.code).toBe(1);
    expect(failed.err).toContain("An import source file or directory is required");
  });

  test("prints validation warnings on successful validation", () => {
    const cwd = makeTempDir();
    expect(invoke(cwd, ["init", "Warned"]).code).toBe(0);
    const root = path.join(cwd, "warned");
    writeMarkdown(path.join(root, "chapters", "chapter-01.md"), `
title: Warned
number: 1
pov: ""
locations: []
characters: []
arcs-advanced: []
status: draft
word-count: 9
`, "## Chapter Text\n\nTwo words.");

    const validation = invoke(cwd, ["validate", root]);
    expect(validation.code).toBe(0);
    expect(validation.out).toContain("warning:");
    expect(validation.out).toContain("declares 9 words");
  });

  test("runs the bundled story-maintenance fallback script", () => {
    const result = spawnSync(process.execPath, ["skills/story-maintenance/scripts/story.js", "--help"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: story");
    expect(result.stdout).toContain("wordcount");
    expect(result.stdout).toContain("build");
  });
});

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
  test("story universe init passes genre, tone, and theme options", () => {
    const cwd = makeTempDir();
    const result = invoke(cwd, ["universe", "init", "My", "Universe", "--genre", "fantasy", "--tone", "dark", "--theme", "hope"]);
    expect(result.code).toBe(0);
    const universeMd = fs.readFileSync(path.join(cwd, "universe.md"), "utf8");
    expect(universeMd).toContain("genre: fantasy");
    expect(universeMd).toContain("tone: dark");
    expect(universeMd).toContain("hope");
  });
});

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
