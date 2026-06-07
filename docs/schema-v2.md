# Story Skills Schema v2

Schema v2 keeps the markdown-first model and adds durable state for longer works. Every file remains plain markdown with YAML frontmatter. The CLI validates the mechanical contract; agents still own creative judgment.

## Required Layout

```text
story.md
characters/_index.md
worldbuilding/_index.md
worldbuilding/locations/
worldbuilding/systems/
worldbuilding/factions/
worldbuilding/artifacts/
plot/_index.md
plot/arcs/
plot/timeline.md
chapters/_index.md
scenes/_index.md
continuity/state.md
continuity/questions/_index.md
continuity/questions/
continuity/promises/_index.md
continuity/promises/
glossary/_index.md
glossary/terms/
```

## Core Rules

- `story.md` must include `schema-version: 2`.
- Entity filenames are kebab-case identifiers.
- Registries are deterministic and rebuilt with `story reindex .`.
- Chapter prose word counts are recalculated with `story wordcount . --write`.
- Cross-reference integrity is checked with `story links .`.

## Entity Frontmatter

### Story

Required: `title`, `schema-version`, `genre`, `status`, `themes`, `pov`, `tense`.

### Characters

Required: `name`, `role`, `status`.

Optional lists: `aliases`, `relationships`, `locations`, `tags`.

### Worldbuilding

Locations require `name` and `type`. Systems require `name` and `type`.

Factions require `name`, `type`, and `status`; they may list `members`, `locations`, and `tags`.

Artifacts require `name`, `type`, and `status`; they may reference an `owner` character or faction and a `location`.

### Plot

Arcs require `name`, `type`, and `status`; they may list `characters`, `themes`, and `acts`.

### Chapters And Scenes

Chapters require `title`, `number`, and `status`; optional reference lists are `locations`, `characters`, and `arcs-advanced`.

Scenes require `title`, `chapter`, `scene`, and `status`. Scenes carry machine-readable continuity fields: `pov`, `location`, `characters`, `arcs-advanced`, and `state-changes`.

### Continuity

`continuity/state.md` stores `current-chapter`, `character-state`, `object-state`, and `knowledge-state`.

Questions require `title` and `status`; optional chapter references are `introduced` and `resolved`.

Promises require `title` and `status`; optional chapter references are `planted` and `payoff`.

### Glossary

Glossary terms require `term` and `category`, plus optional `aliases`.

## Migration

Run:

```shell
story migrate .
story reindex .
story validate .
```

Migration creates the v2 directories and registry files, upgrades `story.md` to `schema-version: 2`, and reindexes the project. It does not invent creative content.
