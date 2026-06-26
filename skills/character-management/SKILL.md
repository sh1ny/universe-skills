---
name: character-management
description: This skill should be used when the user asks to "create a character", "update a character", "add a character", "build a family tree", "character relationships", "character timeline", "character arc", "character profile", or needs to manage characters in a story project.
---

# Character Management

## Overview

Create and manage rich character profiles for a story project. Each character is a markdown file with YAML frontmatter in the `characters/` directory. Characters are cross-referenced with other story elements through kebab-case identifiers.

## Prerequisites

A story project must already exist (created via the story-init skill). Verify by checking for `story.md` in the project root.

## Creating a Character

1. Read `story.md` for genre, themes, and tone context
2. Read `characters/_index.md` for existing characters
3. Ask for the character's name and role (protagonist, antagonist, supporting, minor)
4. Build the profile through conversation, exploring:
   - Appearance and distinguishing features
   - Personality, traits, and quirks
   - Backstory and formative events
   - Motivations (external wants vs internal needs)
   - Voice and speech patterns (ask for example dialogue)
   - Character arc (starting state, turning points, ending state)
   - Key life events for the timeline
5. Write the character file using the template in `references/character-template.md`
6. Save to `characters/{name-kebab}.md`, or use `story add character "{Name}" --role "{role}"` when the CLI is available
7. Update `characters/_index.md` registry table
8. If relationships reference existing characters, update those character files too
9. When CLI access is available, run the maintenance pass in the story root:

```shell
story reindex .
story links .
story validate .
```

## Updating a Character

1. Read the existing character file
2. Read `characters/_index.md` for context on other characters
3. Make the requested changes
4. If relationships changed, update the other character's file (bidirectional)
5. Update `characters/_index.md` if role or status changed
6. When CLI access is available, run `story reindex .`, `story links .`, and `story validate .`

## Managing Relationships

Reference `references/relationship-types.md` for the full list of relationship types and inverse pairs.

When adding a relationship:
- Add the relationship entry to the character's frontmatter
- Add the inverse relationship to the other character's frontmatter
- Update the Relationship Map section in `characters/_index.md`

## Family Trees

Family trees are maintained in the `characters/_index.md` under the "Family Trees" section. Format:

```markdown
## Family Trees

### {Family Name}
- **{Character Name}** ({status}) - [{name-kebab}.md]
  - **{Child Name}** - [{name-kebab}.md]
  - **{Child Name}** - [{name-kebab}.md]
```

Indent children under parents. Note marriages/partnerships inline.

## Cross-Referencing

- When a character is referenced in worldbuilding (e.g., a location's `notable-characters`), ensure the link exists both ways
- Character-location backlinks live in the character file's `locations` frontmatter list
- Faction memberships live in `worldbuilding/factions/{faction-kebab}.md` under `members`
- Artifact ownership can reference a character id in `worldbuilding/artifacts/{artifact-kebab}.md`
- When a character appears in a plot arc, ensure they're listed in the arc's `characters` frontmatter
- Character tags should be consistent across the project (e.g., if `magic-user` is used, always use that exact tag)

## CLI Maintenance

Use the Story CLI when it is available. If `story` is not installed but the `story-maintenance` skill is present, use `node ../story-maintenance/scripts/story.js` with the same arguments, resolving the path relative to this skill folder. If no CLI is available, perform the registry and backlink checks manually.

## Reference Files

- **`references/character-template.md`** - Full blank template for character profiles
- **`references/relationship-types.md`** - Complete relationship type reference with inverse pairs

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
