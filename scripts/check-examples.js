#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeWordCounts, validateLinks, validateProject } from "../src/story.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examplesRoot = path.join(repoRoot, "examples");
const failures = [];
const summaries = [];

for (const name of fs.readdirSync(examplesRoot).sort()) {
  const root = path.join(examplesRoot, name);
  if (!fs.statSync(root).isDirectory() || !fs.existsSync(path.join(root, "story.md"))) {
    continue;
  }

  const validation = validateProject(root);
  const links = validateLinks(root);
  const counts = computeWordCounts(root);
  summaries.push(`${name}: ${counts.chapters.length} chapters, ${counts.total} words`);

  collectResult(name, "validate", validation);
  collectResult(name, "links", links);
}

if (failures.length > 0) {
  console.error(`Example validation failed:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Examples are valid:\n${summaries.join("\n")}`);

function collectResult(exampleName, command, result) {
  for (const error of result.errors) {
    failures.push(`${exampleName} ${command} error: ${error}`);
  }

  for (const warning of result.warnings) {
    failures.push(`${exampleName} ${command} warning: ${warning}`);
  }
}
