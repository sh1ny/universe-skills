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
story universe validate my-first-story
```

> **Important**: Run `story universe validate` from the **story root** (or pass the story path) to trigger cross-level reference checks. Running it from the `stories/` parent directory only validates the universe scaffold itself — it does not check story→universe references.

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
