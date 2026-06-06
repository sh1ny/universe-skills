#!/usr/bin/env node

// src/cli.js
import path2 from "node:path";

// src/story.js
import fs from "node:fs";
import path from "node:path";

// src/frontmatter.js
var FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
function parseFrontmatter(markdown, filePath = "markdown") {
  const match = FRONTMATTER_PATTERN.exec(markdown);
  if (!match) {
    throw new Error(`${filePath} is missing YAML frontmatter`);
  }
  return {
    data: parseYaml(match[1]),
    body: markdown.slice(match[0].length),
    raw: match[1]
  };
}
function stringifyFrontmatter(data) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
        continue;
      }
      lines.push(`${key}:`);
      for (const item of value) {
        if (isPlainObject(item)) {
          const entries = Object.entries(item);
          const [firstKey, firstValue] = entries[0];
          lines.push(`  - ${firstKey}: ${formatScalar(firstValue)}`);
          for (const [childKey, childValue] of entries.slice(1)) {
            lines.push(`    ${childKey}: ${formatScalar(childValue)}`);
          }
        } else {
          lines.push(`  - ${formatScalar(item)}`);
        }
      }
    } else {
      lines.push(`${key}: ${formatScalar(value)}`);
    }
  }
  lines.push("---", "", "");
  return lines.join(`
`);
}
function replaceFrontmatter(markdown, data) {
  const match = FRONTMATTER_PATTERN.exec(markdown);
  if (!match) {
    throw new Error("Cannot replace missing YAML frontmatter");
  }
  return `${stringifyFrontmatter(data)}${markdown.slice(match[0].length)}`;
}
function parseYaml(source) {
  const lines = source.split(/\r?\n/);
  const data = {};
  for (let index = 0;index < lines.length; ) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }
    const pair = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);
    if (!pair) {
      throw new Error(`Unsupported frontmatter line: ${line}`);
    }
    const [, key, rest = ""] = pair;
    if (rest !== "") {
      data[key] = parseScalar(rest);
      index += 1;
      continue;
    }
    const parsed = parseArray(lines, index + 1);
    data[key] = parsed.items;
    index = parsed.nextIndex;
  }
  return data;
}
function parseArray(lines, startIndex) {
  const items = [];
  let index = startIndex;
  while (index < lines.length) {
    const itemMatch = /^  -(?:\s+(.*))?$/.exec(lines[index]);
    if (!itemMatch) {
      break;
    }
    const itemText = itemMatch[1] ?? "";
    const objectMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(itemText);
    if (!objectMatch) {
      items.push(parseScalar(itemText));
      index += 1;
      continue;
    }
    const item = {
      [objectMatch[1]]: parseScalar(objectMatch[2])
    };
    index += 1;
    while (index < lines.length) {
      const childMatch = /^    ([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[index]);
      if (!childMatch) {
        break;
      }
      item[childMatch[1]] = parseScalar(childMatch[2]);
      index += 1;
    }
    items.push(item);
  }
  return { items, nextIndex: index };
}
function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "[]") {
    return [];
  }
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
function formatScalar(value) {
  if (typeof value === "number") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (text === "" || text === "[]" || /^\s|\s$/.test(text) || /[:#\n"']/.test(text)) {
    return JSON.stringify(text);
  }
  return text;
}
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// src/markdown.js
function kebabCase(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/['']/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function titleCaseSlug(slug) {
  return String(slug).split("-").filter(Boolean).map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");
}
function wordCount(markdown) {
  const normalized = markdown.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ").replace(/\[[^\]]+\]\([^)]+\)/g, " ").replace(/[#>*_~|:-]/g, " ");
  const words = normalized.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g);
  return words ? words.length : 0;
}
function chapterProse(markdownBody) {
  const chapterTextMatch = /^## Chapter Text\s*$/im.exec(markdownBody);
  if (chapterTextMatch) {
    return markdownBody.slice(chapterTextMatch.index + chapterTextMatch[0].length);
  }
  const outlineMatch = /^## Outline\s*$/im.exec(markdownBody);
  if (!outlineMatch) {
    return markdownBody;
  }
  const afterOutline = markdownBody.slice(outlineMatch.index + outlineMatch[0].length);
  const dividerMatch = /^\s*---\s*$/m.exec(afterOutline);
  return dividerMatch ? afterOutline.slice(dividerMatch.index + dividerMatch[0].length) : afterOutline;
}
function extractSection(markdown, heading) {
  const escaped = escapeRegExp(heading);
  const pattern = new RegExp(`^## ${escaped}\\s*$`, "im");
  const match = pattern.exec(markdown);
  if (!match) {
    return "";
  }
  const start = match.index + match[0].length;
  const rest = markdown.slice(start);
  const next = /^##\s+/m.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// src/story.js
var REQUIRED_PATHS = [
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
function createStoryProject(options) {
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
function scanProject(root) {
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
function validateProject(root) {
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
function validateLinks(root) {
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
function reindexProject(root) {
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
  writeChanged(charactersIndexPath, characterIndex(project.storyId, project.characters, extractSection(existingCharacters, "Relationship Map"), extractSection(existingCharacters, "Family Trees")), changed);
  writeChanged(worldIndexPath, worldIndex(project.storyId, project.locations, project.systems, extractSection(existingWorld, "World Overview")), changed);
  writeChanged(plotIndexPath, plotIndex(project.storyId, plotFrontmatter.structure ?? "three-act", project.arcs, extractSection(existingPlot, "Story Structure"), extractSection(existingPlot, "Theme Tracking")), changed);
  writeChanged(chaptersIndexPath, chapterIndex(project.storyId, project.chapters), changed);
  return { changed };
}
function computeWordCounts(root, options = {}) {
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
function exportManuscript(root, options = {}) {
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
  writeFile(outFile, `${lines.join(`
`).trimEnd()}
`);
  return { outFile, chapters: project.chapters.length };
}
function buildBook(root, options = {}) {
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
  const rows = characters.length === 0 ? ["| *No characters yet* | | | |"] : characters.map((character) => `| ${character.name} | ${character.role} | ${character.status} | [${character.id}](${character.id}.md) |`);
  return `${stringifyFrontmatter({ type: "character-registry", story: storyId })}# Characters

## Registry

| Name | Role | Status | File |
|------|------|--------|------|
${rows.join(`
`)}

## Relationship Map

${relationshipMap || "*No relationships defined yet.*"}

## Family Trees

${familyTrees || "*No family trees defined yet.*"}
`;
}
function worldIndex(storyId, locations, systems, overview) {
  const locationRows = locations.length === 0 ? ["| *No locations yet* | | | |"] : locations.map((location) => `| ${location.name} | ${titleCaseSlug(location.type)} | ${location.region} | [${location.id}](locations/${location.id}.md) |`);
  const systemRows = systems.length === 0 ? ["| *No systems yet* | | |"] : systems.map((system) => `| ${system.name} | ${titleCaseSlug(system.type)} | [${system.id}](systems/${system.id}.md) |`);
  return `${stringifyFrontmatter({ type: "world-registry", story: storyId })}# Worldbuilding

## World Overview

${overview || "*Describe the world at a high level here.*"}

## Locations

| Name | Type | Region | File |
|------|------|--------|------|
${locationRows.join(`
`)}

## Systems

| Name | Type | File |
|------|------|------|
${systemRows.join(`
`)}
`;
}
function plotIndex(storyId, structure, arcs, storyStructure, themeTracking) {
  const arcRows = arcs.length === 0 ? ["| *No arcs yet* | | | |"] : arcs.map((arc) => `| ${arc.name} | ${arc.type} | ${arc.status} | [${arc.id}](arcs/${arc.id}.md) |`);
  return `${stringifyFrontmatter({ type: "plot-registry", story: storyId, structure })}# Plot Structure

## Story Structure

${storyStructure || "**Model:** Three-Act Structure (adjust as needed)"}

## Arcs

| Name | Type | Status | File |
|------|------|--------|------|
${arcRows.join(`
`)}

## Theme Tracking

${themeTracking || `| Theme | Arcs | Chapters |
|-------|------|----------|
| *No themes tracked yet* | | |`}
`;
}
function chapterIndex(storyId, chapters) {
  const rows = chapters.length === 0 ? ["| *No chapters yet* | | | | | |"] : chapters.map((chapter) => `| ${chapter.number} | ${chapter.title} | ${chapter.pov} | ${chapter.status} | ${chapter.wordCount} | [${chapter.id}](${path.basename(chapter.file)}) |`);
  const total = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
  return `${stringifyFrontmatter({ type: "chapter-registry", story: storyId })}# Chapters

## Registry

| # | Title | POV | Status | Word Count | File |
|---|-------|-----|--------|------------|------|
${rows.join(`
`)}

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
  return fs.readdirSync(directory).filter((file) => file.endsWith(".md") && file !== "_index.md").sort().map((file) => {
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

// src/cli.js
var HELP = `Usage: story <command> [options]

Commands:
  init <title>       Scaffold a story project
  validate [path]    Check project structure, frontmatter, and registries
  reindex [path]     Rebuild registry tables from markdown files
  wordcount [path]   Count chapter prose words
  links [path]       Check cross-reference targets and backlinks
  export [path]      Combine chapters into a manuscript markdown file
  build [path]       Build a disposable book artifact in dist/

Options:
  --dir <path>              Target directory for init
  --genre <name>            Story genre for init
  --sub-genre <name>        Story sub-genre for init
  --setting-era <name>      Setting era for init
  --theme <name>            Add a theme for init; repeatable
  --themes <a,b>            Add comma-separated themes for init
  --pov <style>             POV style for init
  --tense <tense>           Narrative tense for init
  --synopsis <text>         Starter synopsis for init
  --force                   Allow init to overwrite starter files
  --write                   Update chapter word-count frontmatter
  --out <file>              Output path for export/build
  --format <name>           Output format for build (markdown only)
  -h, --help                Show this help
`;
function runCli(argv, io) {
  const parsed = parseArgs(argv);
  const cwd = io.cwd ?? process.cwd();
  const command = parsed.positionals[0];
  try {
    if (!command || command === "help" || parsed.options.help) {
      io.stdout.write(HELP);
      return 0;
    }
    if (command === "init") {
      const title = parsed.positionals.slice(1).join(" ");
      const result = createStoryProject({
        title,
        cwd,
        dir: parsed.options.dir,
        genre: parsed.options.genre,
        subGenre: parsed.options["sub-genre"],
        settingEra: parsed.options["setting-era"],
        themes: collectThemes(parsed.options),
        pov: parsed.options.pov,
        tense: parsed.options.tense,
        synopsis: parsed.options.synopsis,
        force: Boolean(parsed.options.force)
      });
      io.stdout.write(`Created story project: ${result.root}
`);
      return 0;
    }
    const root = path2.resolve(cwd, parsed.positionals[1] ?? ".");
    if (command === "validate") {
      return reportResult(io, validateProject(root), "Project is valid");
    }
    if (command === "links") {
      return reportResult(io, validateLinks(root), "Links are valid");
    }
    if (command === "reindex") {
      const result = reindexProject(root);
      io.stdout.write(result.changed.length === 0 ? `Registries already up to date
` : `Updated ${result.changed.length} registries
`);
      return 0;
    }
    if (command === "wordcount") {
      const result = computeWordCounts(root, { write: Boolean(parsed.options.write) });
      for (const chapter of result.chapters) {
        io.stdout.write(`${chapter.file}: ${chapter.wordCount}
`);
      }
      io.stdout.write(`Total: ${result.total}
`);
      return 0;
    }
    if (command === "export") {
      const result = exportManuscript(root, { out: parsed.options.out });
      io.stdout.write(`Exported ${result.chapters} chapters to ${result.outFile}
`);
      return 0;
    }
    if (command === "build") {
      const result = buildBook(root, {
        out: parsed.options.out,
        format: parsed.options.format
      });
      io.stdout.write(`Built ${result.chapters} chapters to ${result.outFile}
`);
      return 0;
    }
    io.stderr.write(`Unknown command: ${command}

${HELP}`);
    return 1;
  } catch (error) {
    io.stderr.write(`${error.message}
`);
    return 1;
  }
}
function parseArgs(argv) {
  const positionals = [];
  const options = {};
  for (let index = 0;index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const equalIndex = arg.indexOf("=");
    const key = arg.slice(2, equalIndex === -1 ? undefined : equalIndex);
    const inlineValue = equalIndex === -1 ? undefined : arg.slice(equalIndex + 1);
    const nextValue = argv[index + 1];
    const hasSeparateValue = inlineValue === undefined && nextValue !== undefined && !nextValue.startsWith("-");
    const value = inlineValue ?? (hasSeparateValue ? nextValue : true);
    if (hasSeparateValue) {
      index += 1;
    }
    if (options[key] === undefined) {
      options[key] = value;
    } else {
      options[key] = Array.isArray(options[key]) ? options[key].concat(value) : [options[key], value];
    }
  }
  return { positionals, options };
}
function collectThemes(options) {
  return [].concat(options.theme ?? []).concat(options.themes ?? []).filter((value) => value !== undefined && value !== true);
}
function reportResult(io, result, successMessage) {
  const output = result.ok ? io.stdout : io.stderr;
  output.write(`${successMessage}: ${result.errors.length} errors, ${result.warnings.length} warnings
`);
  for (const error of result.errors) {
    io.stderr.write(`error: ${error}
`);
  }
  for (const warning of result.warnings) {
    output.write(`warning: ${warning}
`);
  }
  return result.ok ? 0 : 1;
}

// bin/story.js
process.exitCode = runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr
});
