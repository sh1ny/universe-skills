---
name: story-maintenance
description: This skill should be used when the user asks to validate, reindex, repair registries, check links, count words, summarize a story project, export a manuscript, run the story CLI, or perform deterministic maintenance on a Story Skills markdown project.
---

# Story Maintenance

## Overview

Run deterministic maintenance for Story Skills projects. Use the CLI for structure validation, registry rebuilds, word counts, link checks, project reports, and manuscript export. The creative skills still own story decisions; this skill handles mechanical consistency.

## CLI Access

Prefer the first available command:

1. `story <command>` - when the package bin is installed
2. `bun run story -- <command>` - when working from this repository
3. `node scripts/story.js <command>` - bundled fallback, resolving `scripts/story.js` relative to this skill folder

If none of these are available, perform the requested maintenance manually using the conventions in `story-init`.

Run the installed or bundled CLI in place. Do not copy `scripts/story.js` into the user's story project, and do not create project-local build scripts, generator scripts, or bulk writer scripts to generate story content. Story projects should remain markdown-first, plus explicitly requested exports such as `manuscript.md`.

## Commands

Run commands from the story project root, or pass the story path explicitly.

```shell
story validate .
story reindex .
story wordcount . --write
story links .
story report .
story export . --out manuscript.md
story build .
```

Use:

- `validate` after initialization and at the end of any multi-file edit
- `reindex` after adding/removing/renaming characters, locations, systems, arcs, or chapters
- `wordcount --write` after writing or revising chapters
- `links` after changing character relationships, notable locations, arc participants, or chapter references
- `report` when the user asks for project status, inventory, progress, or a quick health summary
- `export` only when the user asks for a combined manuscript at a specific path
- `build` when the user asks to build the book artifact; defaults to `dist/<story-id>.md`

## Failure Handling

- Treat CLI errors as actionable maintenance findings.
- Fix broken references, missing required files, stale registries, or incorrect word counts when the requested task implies doing so.
- Do not overwrite creative prose or story content merely to satisfy a mechanical check.
- If a validation warning reflects intentional user data, report it rather than silently changing it.
