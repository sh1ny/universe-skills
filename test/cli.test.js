import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs, runCli } from "../src/cli.js";
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
    expect(invoke(cwd, ["--help"]).out).toContain("validate");
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
    expect(report.out).toContain("Schema version: 1");
    expect(report.out).toContain("- Total words: 2");
    expect(invoke(cwd, ["export", root, "--out", "out.md"]).out).toContain("Exported 1 chapters");
    const build = invoke(cwd, ["build", root]);
    expect(build.out).toContain("Built 1 chapters");
    expect(fs.existsSync(path.join(root, "dist", "cli-story.md"))).toBe(true);
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

    const build = invoke(cwd, ["build", path.join(cwd, "broken"), "--format", "epub"]);
    expect(build.code).toBe(1);
    expect(build.err).toContain("Unsupported build format: epub");
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
