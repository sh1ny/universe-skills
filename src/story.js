import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter, replaceFrontmatter, stringifyFrontmatter } from "./frontmatter.js";
import { chapterProse, extractSection, kebabCase, titleCaseSlug, wordCount } from "./markdown.js";

const REQUIRED_PATHS = [
  "story.md",
  "characters/_index.md",
  "worldbuilding/_index.md",
  "worldbuilding/locations",
  "worldbuilding/systems",
  "plot/_index.md",
  "plot/arcs",
  "plot/timeline.md",
  "chapters/_index.md"
];

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
  fs.mkdirSync(path.join(root, "characters"), { recursive: true });
  fs.mkdirSync(path.join(root, "worldbuilding", "locations"), { recursive: true });
  fs.mkdirSync(path.join(root, "worldbuilding", "systems"), { recursive: true });
  fs.mkdirSync(path.join(root, "plot", "arcs"), { recursive: true });
  fs.mkdirSync(path.join(root, "chapters"), { recursive: true });

  writeFile(path.join(root, "story.md"), storyBible({
    title,
    storyId,
    genre: options.genre ?? "fiction",
    subGenre: options.subGenre ?? "general",
    settingEra: options.settingEra ?? "unspecified",
    themes,
    pov: options.pov ?? "third-person-limited",
    tense: options.tense ?? "past",
    synopsis: options.synopsis ?? "Add a 2-3 sentence synopsis here."
  }));
  writeFile(path.join(root, "characters", "_index.md"), characterIndex(storyId, [], "", ""));
  writeFile(path.join(root, "worldbuilding", "_index.md"), worldIndex(storyId, [], [], ""));
  writeFile(path.join(root, "plot", "_index.md"), plotIndex(storyId, "three-act", [], "", ""));
  writeFile(path.join(root, "plot", "timeline.md"), timeline(storyId));
  writeFile(path.join(root, "chapters", "_index.md"), chapterIndex(storyId, []));

  return { root, storyId, files: REQUIRED_PATHS.filter((entry) => entry.endsWith(".md")) };
}

export function scanProject(root) {
  const projectRoot = path.resolve(root);
  const story = readMarkdown(path.join(projectRoot, "story.md"));
  const storyId = kebabCase(story.data.title ?? path.basename(projectRoot));

  return {
    root: projectRoot,
    story,
    storyId,
    characters: readEntityFiles(projectRoot, "characters", (id, file, data) => ({
      id,
      file,
      name: data.name ?? titleCaseSlug(id),
      role: data.role ?? "",
      status: data.status ?? "",
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
      locations: asArray(data.locations),
      arcsAdvanced: asArray(data["arcs-advanced"]),
      declaredWordCount: Number(data["word-count"] ?? 0),
      wordCount: wordCount(chapterProse(markdown.body))
    })).sort((left, right) => left.number - right.number || left.file.localeCompare(right.file))
  };
}

export function validateProject(root) {
  const projectRoot = path.resolve(root);
  const errors = [];
  const warnings = [];

  for (const requiredPath of REQUIRED_PATHS) {
    if (!fs.existsSync(path.join(projectRoot, requiredPath))) {
      errors.push(`Missing required path: ${requiredPath}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const project = scanProject(projectRoot);
  requireFields(project.story.data, ["title", "genre", "status", "pov", "tense"], "story.md", errors);

  validateEntityFields(project.characters, ["name", "role", "status"], "characters", errors);
  validateEntityFields(project.locations, ["name", "type"], "locations", errors);
  validateEntityFields(project.systems, ["name", "type"], "systems", errors);
  validateEntityFields(project.arcs, ["name", "type", "status"], "arcs", errors);
  validateEntityFields(project.chapters, ["title", "number", "status"], "chapters", errors);

  const indexChecks = [
    [path.join("characters", "_index.md"), project.characters.map((item) => `](${item.id}.md)`)],
    [path.join("worldbuilding", "_index.md"), project.locations.map((item) => `](locations/${item.id}.md)`).concat(project.systems.map((item) => `](systems/${item.id}.md)`))],
    [path.join("plot", "_index.md"), project.arcs.map((item) => `](arcs/${item.id}.md)`)],
    [path.join("chapters", "_index.md"), project.chapters.map((item) => `](${path.basename(item.file)})`)]
  ];

  for (const [indexPath, links] of indexChecks) {
    const markdown = fs.readFileSync(path.join(projectRoot, indexPath), "utf8");
    for (const link of links) {
      if (!markdown.includes(link)) {
        warnings.push(`${indexPath} is missing registry link ${link}`);
      }
    }
  }

  for (const chapter of project.chapters) {
    if (chapter.declaredWordCount !== chapter.wordCount) {
      warnings.push(`${path.relative(projectRoot, chapter.file)} declares ${chapter.declaredWordCount} words but contains ${chapter.wordCount}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateLinks(root) {
  const project = scanProject(root);
  const errors = [];
  const warnings = [];
  const characters = new Map(project.characters.map((item) => [item.id, item]));
  const locations = new Map(project.locations.map((item) => [item.id, item]));
  const arcs = new Map(project.arcs.map((item) => [item.id, item]));

  for (const character of project.characters) {
    for (const relationship of character.relationships) {
      const target = relationship.character;
      if (!characters.has(target)) {
        errors.push(`${relative(project, character.file)} references missing character ${target}`);
      } else if (!characters.get(target).relationships.some((entry) => entry.character === character.id)) {
        errors.push(`${relative(project, character.file)} relationship to ${target} is missing backlink`);
      }
    }

    for (const locationId of character.locations) {
      if (!locations.has(locationId)) {
        errors.push(`${relative(project, character.file)} references missing location ${locationId}`);
      } else if (!locations.get(locationId).notableCharacters.includes(character.id)) {
        errors.push(`${relative(project, character.file)} location ${locationId} is missing notable-character backlink`);
      }
    }
  }

  for (const location of project.locations) {
    for (const characterId of location.notableCharacters) {
      if (!characters.has(characterId)) {
        errors.push(`${relative(project, location.file)} references missing character ${characterId}`);
      } else if (!characters.get(characterId).locations.includes(location.id)) {
        errors.push(`${relative(project, location.file)} notable character ${characterId} is missing location backlink`);
      }
    }
  }

  for (const arc of project.arcs) {
    for (const characterId of arc.characters) {
      if (!characters.has(characterId)) {
        errors.push(`${relative(project, arc.file)} references missing character ${characterId}`);
      }
    }
  }

  for (const chapter of project.chapters) {
    for (const characterId of chapter.characters) {
      if (!characters.has(characterId)) {
        errors.push(`${relative(project, chapter.file)} references missing character ${characterId}`);
      }
    }
    for (const locationId of chapter.locations) {
      if (!locations.has(locationId)) {
        errors.push(`${relative(project, chapter.file)} references missing location ${locationId}`);
      }
    }
    for (const arcId of chapter.arcsAdvanced) {
      if (!arcs.has(arcId)) {
        errors.push(`${relative(project, chapter.file)} references missing arc ${arcId}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function reindexProject(root) {
  const project = scanProject(root);
  const changed = [];
  const charactersIndexPath = path.join(project.root, "characters", "_index.md");
  const worldIndexPath = path.join(project.root, "worldbuilding", "_index.md");
  const plotIndexPath = path.join(project.root, "plot", "_index.md");
  const chaptersIndexPath = path.join(project.root, "chapters", "_index.md");
  const existingCharacters = safeRead(charactersIndexPath);
  const existingWorld = safeRead(worldIndexPath);
  const existingPlot = safeRead(plotIndexPath);
  const plotFrontmatter = parseFrontmatter(existingPlot, "plot/_index.md").data;

  writeChanged(charactersIndexPath, characterIndex(
    project.storyId,
    project.characters,
    extractSection(existingCharacters, "Relationship Map"),
    extractSection(existingCharacters, "Family Trees")
  ), changed);
  writeChanged(worldIndexPath, worldIndex(
    project.storyId,
    project.locations,
    project.systems,
    extractSection(existingWorld, "World Overview")
  ), changed);
  writeChanged(plotIndexPath, plotIndex(
    project.storyId,
    plotFrontmatter.structure ?? "three-act",
    project.arcs,
    extractSection(existingPlot, "Story Structure"),
    extractSection(existingPlot, "Theme Tracking")
  ), changed);
  writeChanged(chaptersIndexPath, chapterIndex(project.storyId, project.chapters), changed);

  return { changed };
}

export function computeWordCounts(root, options = {}) {
  const project = scanProject(root);
  const chapters = [];

  for (const chapter of project.chapters) {
    chapters.push({
      number: chapter.number,
      title: chapter.title,
      file: path.relative(project.root, chapter.file),
      wordCount: chapter.wordCount
    });

    if (options.write) {
      const markdown = readMarkdown(chapter.file);
      writeFile(chapter.file, replaceFrontmatter(markdown.rawMarkdown, {
        ...markdown.data,
        "word-count": chapter.wordCount
      }));
    }
  }

  if (options.write) {
    reindexProject(project.root);
  }

  return {
    chapters,
    total: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0)
  };
}

export function exportManuscript(root, options = {}) {
  const project = scanProject(root);
  if (project.chapters.length === 0) {
    throw new Error("No chapters found to export");
  }

  const outFile = path.resolve(project.root, options.out ?? "manuscript.md");
  const generatedBy = options.generatedBy ?? "story export";
  const lines = [`# ${project.story.data.title}`, "", `<!-- Generated by ${generatedBy}. -->`, ""];

  for (const chapter of project.chapters) {
    const markdown = readMarkdown(chapter.file);
    lines.push(`# Chapter ${chapter.number}: ${chapter.title}`, "", chapterProse(markdown.body).trim(), "");
  }

  writeFile(outFile, `${lines.join("\n").trimEnd()}\n`);
  return { outFile, chapters: project.chapters.length };
}

export function buildBook(root, options = {}) {
  const format = normalizeBuildFormat(options.format ?? "markdown");
  const project = scanProject(root);
  const outFile = path.resolve(project.root, options.out ?? path.join("dist", `${project.storyId}.md`));
  const result = exportManuscript(project.root, {
    out: outFile,
    generatedBy: "story build"
  });

  return { ...result, format };
}

function storyBible(options) {
  return `${stringifyFrontmatter({
    title: options.title,
    genre: options.genre,
    "sub-genre": options.subGenre,
    "setting-era": options.settingEra,
    status: "planning",
    themes: options.themes,
    pov: options.pov,
    tense: options.tense
  })}# ${options.title}

## Synopsis

${options.synopsis}

## Tone & Style

Add notes on the story's voice, texture, and emotional register.

## Notes

`;
}

function characterIndex(storyId, characters, relationshipMap, familyTrees) {
  const rows = characters.length === 0
    ? ["| *No characters yet* | | | |"]
    : characters.map((character) => `| ${character.name} | ${character.role} | ${character.status} | [${character.id}](${character.id}.md) |`);

  return `${stringifyFrontmatter({ type: "character-registry", story: storyId })}# Characters

## Registry

| Name | Role | Status | File |
|------|------|--------|------|
${rows.join("\n")}

## Relationship Map

${relationshipMap || "*No relationships defined yet.*"}

## Family Trees

${familyTrees || "*No family trees defined yet.*"}
`;
}

function worldIndex(storyId, locations, systems, overview) {
  const locationRows = locations.length === 0
    ? ["| *No locations yet* | | | |"]
    : locations.map((location) => `| ${location.name} | ${titleCaseSlug(location.type)} | ${location.region} | [${location.id}](locations/${location.id}.md) |`);
  const systemRows = systems.length === 0
    ? ["| *No systems yet* | | |"]
    : systems.map((system) => `| ${system.name} | ${titleCaseSlug(system.type)} | [${system.id}](systems/${system.id}.md) |`);

  return `${stringifyFrontmatter({ type: "world-registry", story: storyId })}# Worldbuilding

## World Overview

${overview || "*Describe the world at a high level here.*"}

## Locations

| Name | Type | Region | File |
|------|------|--------|------|
${locationRows.join("\n")}

## Systems

| Name | Type | File |
|------|------|------|
${systemRows.join("\n")}
`;
}

function plotIndex(storyId, structure, arcs, storyStructure, themeTracking) {
  const arcRows = arcs.length === 0
    ? ["| *No arcs yet* | | | |"]
    : arcs.map((arc) => `| ${arc.name} | ${arc.type} | ${arc.status} | [${arc.id}](arcs/${arc.id}.md) |`);

  return `${stringifyFrontmatter({ type: "plot-registry", story: storyId, structure })}# Plot Structure

## Story Structure

${storyStructure || "**Model:** Three-Act Structure (adjust as needed)"}

## Arcs

| Name | Type | Status | File |
|------|------|--------|------|
${arcRows.join("\n")}

## Theme Tracking

${themeTracking || `| Theme | Arcs | Chapters |
|-------|------|----------|
| *No themes tracked yet* | | |`}
`;
}

function chapterIndex(storyId, chapters) {
  const rows = chapters.length === 0
    ? ["| *No chapters yet* | | | | | |"]
    : chapters.map((chapter) => `| ${chapter.number} | ${chapter.title} | ${chapter.pov} | ${chapter.status} | ${chapter.wordCount} | [${chapter.id}](${path.basename(chapter.file)}) |`);
  const total = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

  return `${stringifyFrontmatter({ type: "chapter-registry", story: storyId })}# Chapters

## Registry

| # | Title | POV | Status | Word Count | File |
|---|-------|-----|--------|------------|------|
${rows.join("\n")}

## Total Word Count: ${total}
`;
}

function timeline(storyId) {
  return `${stringifyFrontmatter({ type: "timeline", story: storyId })}# Story Timeline

| When | Event | Arc | Chapter |
|------|-------|-----|---------|
| *No events yet* | | | |
`;
}

function readEntityFiles(root, relativeDir, mapEntity) {
  const directory = path.join(root, relativeDir);
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory)
    .filter((file) => file.endsWith(".md") && file !== "_index.md")
    .sort()
    .map((file) => {
      const fullPath = path.join(directory, file);
      const markdown = readMarkdown(fullPath);
      return mapEntity(path.basename(file, ".md"), fullPath, markdown.data, markdown);
    });
}

function readMarkdown(filePath) {
  const rawMarkdown = fs.readFileSync(filePath, "utf8");
  const parsed = parseFrontmatter(rawMarkdown, filePath);
  return { ...parsed, rawMarkdown };
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

function writeChanged(filePath, contents, changed) {
  if (safeRead(filePath) !== contents) {
    writeFile(filePath, contents);
    changed.push(filePath);
  }
}

function safeRead(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeList(value, fallback) {
  const list = asArray(value).flatMap((item) => String(item).split(",")).map((item) => item.trim()).filter(Boolean);
  return list.length > 0 ? list : fallback;
}

function normalizeBuildFormat(value) {
  const format = String(value).trim().toLowerCase();
  if (format === "markdown" || format === "md") {
    return "markdown";
  }

  throw new Error(`Unsupported build format: ${value}. Supported formats: markdown`);
}

function requireFields(data, fields, label, errors) {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === "") {
      errors.push(`${label} is missing frontmatter field ${field}`);
    }
  }
}

function validateEntityFields(entities, fields, label, errors) {
  for (const entity of entities) {
    const data = parseFrontmatter(fs.readFileSync(entity.file, "utf8"), entity.file).data;
    requireFields(data, fields, path.join(label, path.basename(entity.file)), errors);
  }
}

function chapterNumberFromFile(file) {
  const match = /chapter-(\d+)/.exec(path.basename(file));
  return match ? Number.parseInt(match[1], 10) : 0;
}

function relative(project, file) {
  return path.relative(project.root, file);
}
