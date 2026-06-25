<div align="center">

# ✨ Story Skills

**Agent Skills for planning, tracking, and drafting fiction in markdown.**

> ⚠️ **Early Development** — This project is under active development and not yet published to any package registry. APIs, file formats, and skill workflows may change between versions. Install from GitHub only (see below).

Story Skills gives agents a shared project format for fiction: a story bible, character files, worldbuilding notes, factions, artifacts, plot arcs, scene state, continuity questions, promises/payoffs, timelines, and chapter drafts. Everything is plain markdown with YAML frontmatter, packaged as standard Agent Skills.

The companion CLI treats the story bible as a checkable contract: a **continuity engine** catches dead characters walking, payoffs that land before their setup, unfired Chekhov guns, and stale story state — deterministically, before a reader ever could. Universe-level worldbuilding enables shared entities across multiple stories in the same setting.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/Agent_Skills-SKILL.md-blue)](https://agentskills.io)
[![Codex](https://img.shields.io/badge/Codex-plugin-10A37F)](https://developers.openai.com/codex)
[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-blueviolet)](https://docs.anthropic.com/en/docs/claude-code)

</div>

---

> Built on the open **Agent Skills** standard. Install it from GitHub by copying the `skills/` folders into any agent that supports `SKILL.md`.

## 🚀 Quick Start

This project is not on npm or any plugin marketplace yet. Install from GitHub:

```shell
git clone https://github.com/sh1ny/universe-skills.git
cd universe-skills
bun install
bun run story --help
```

To use the agent skills, copy the `skills/` directory into your agent's skill path:

```shell
# Global install (any agent)
cp -r skills/* ~/.agents/skills/

# Or project-scoped
cp -r skills/* .agents/skills/
```

Then ask **"Start a new story"** to scaffold the project.

## 🔎 The Continuity Engine

Long-range consistency is the thing language models are worst at and prompts cannot fix. Story Skills makes it deterministic: character deaths, promises/payoffs, open questions, scene casts, and durable knowledge/object state live in frontmatter, and `story continuity` treats contradictions like a compiler treats type errors.

[`examples/the-unraveled-thread/`](examples/the-unraveled-thread/) is a deliberately broken mystery. It passes `story validate` and `story links` cleanly — every file is well-formed — but the story itself doesn't hold together:

```text
$ story continuity examples/the-unraveled-thread
Continuity check failed: 4 errors, 3 warnings
error: chapters/chapter-04.md lists edran-vale, who died in chapter-02; move posthumous appearances to mentions
error: continuity/promises/the-broken-compass.md pays off in chapter-02 before it is planted in chapter-03
error: continuity/questions/who-burned-the-mill.md resolves in chapter-02 before it is introduced in chapter-03
error: continuity/state.md knowledge-state[0] references missing chapter chapter-05
warning: chapters/chapter-03.md POV character nessa-thorn is not listed in characters
warning: continuity/promises/the-sealed-letter.md was planted in chapter-01, 3 chapters ago, and has no payoff yet
warning: continuity/state.md object-state[0] status active conflicts with worldbuilding/artifacts/vales-compass.md status destroyed
```

These findings are exact, file-addressed, and reproducible — CI asserts them on every commit. Intentional flashbacks and posthumous appearances stay legal via the chapter `mentions` field. `story doctor` and `story next` fold the same checks into prioritized repair actions.

## ✍️ Highly Recommended: Better Writing

For stronger chapter drafts and revision passes, install [forjd/better-writing](https://github.com/forjd/better-writing) alongside Story Skills. It adds voice calibration, anti-generic writing checks, and a final prose-quality pass.

```shell
git clone https://github.com/forjd/better-writing.git
cp -r better-writing/skills/* ~/.agents/skills/
```

Or copy to a specific project:

```shell
cp -r better-writing/skills/* .agents/skills/
```

Story Skills works without it, but chapter drafting and revision are better when agents can use `better-writing`.

## 📦 Installation

Install from GitHub — the project is not published to npm or any plugin marketplace.

### Agent Skills

```shell
git clone https://github.com/sh1ny/universe-skills.git

# Copy skills to your agent's skill directory
cp -r universe-skills/skills/* ~/.agents/skills/

# Or project-scoped
cp -r universe-skills/skills/* .agents/skills/
```

Skills follow the open [Agent Skills](https://agentskills.io) standard: `SKILL.md` files with YAML frontmatter. Any agent that supports this format (Claude Code, Codex, Cursor, Windsurf, Gemini CLI, OpenCode, Copilot) can discover them from the copied directory.

### Companion CLI

```shell
# Clone and install dependencies
git clone https://github.com/sh1ny/universe-skills.git
cd universe-skills
bun install

# Run locally
bun run story --help

# Or use npx directly from GitHub
npx --yes --package github:sh1ny/universe-skills story --help
```

For copied-skill installs, `story-maintenance` includes a bundled `scripts/story.js` fallback that agents can run with Node — no Bun or npm required.

## 🛠️ Skills

| Skill | What it does | Try saying |
|-------|-------------|------------|
| **story-init** | Scaffolds the story bible, folders, and registries | *"Start a new story"* |
| **character-management** | Creates character profiles with relationships, traits, arcs, and family trees | *"Create a character"* |
| **worldbuilding** | Builds locations and systems: magic, politics, technology, religion, and more | *"Design a magic system"* |
| **plot-structure** | Plans arcs with structures like three-act, hero's journey, Save the Cat, and kishotenketsu | *"Create a plot arc"* |
| **chapter-writing** | Drafts chapters through an outline-first workflow that pulls from story context | *"Write the next chapter"* |
| **revision-continuity** | Revises drafts, audits continuity, and keeps character state, timeline, and arc changes consistent | *"Continuity-check chapter 3"* |
| **story-maintenance** | Runs deterministic CLI checks for validation, continuity, reports, indexing, links, word counts, import, and export | *"Validate my story project"* |
| **universe-management** | Manages a shared universe container above story projects with cross-level entity resolution | *"Create a universe"* |

For stronger prose, pair **chapter-writing** with [**better-writing**](https://github.com/forjd/better-writing).

## 🧰 Companion CLI

The optional `story` CLI handles deterministic project maintenance while the skills handle the creative workflow.

```shell
bun install
bun run story --help
```

The package also exposes a Node-compatible bin with no runtime dependencies. It is not on the npm registry yet, so run it straight from GitHub:

```shell
npx --yes --package github:sh1ny/universe-skills story --help
```

For copied-skill installs, `story-maintenance` includes a bundled `scripts/story.js` fallback that agents can run with Node.

The CLI is for deterministic maintenance only. Agents should write story content directly to markdown files, not create project-local build or generator scripts to emit the story.

| Command | Purpose |
|---------|---------|
| `story init "The Last Ember"` | Scaffold a story project with the standard markdown layout |
| `story add character "Sera Voss"` | Create entity files for characters, locations, systems, factions, artifacts, arcs, chapters, scenes, questions, promises, and glossary terms |
| `story rename character sera-voss "Sera Vale"` | Rename an entity and update kebab-case references |
| `story remove promise old-setup` | Remove an entity and scrub metadata references |
| `story migrate [path]` | Upgrade a project to the current schema |
| `story validate [path]` | Check required files, schema version, YAML frontmatter, registries, and word-count warnings |
| `story reindex [path]` | Rebuild registry tables from the current markdown files |
| `story wordcount [path] --write` | Count chapter prose and update chapter frontmatter plus the chapter registry |
| `story links [path]` | Check character, location, chapter, and arc cross-references/backlinks |
| `story continuity [path]` | Check deterministic continuity contracts: deaths, promises/payoffs, questions, casts, and durable state |
| `story import draft.md --title "The Lost Coast"` | Split an existing manuscript into a new story project and suggest entity candidates |
| `story report [path] --actionable` | Summarize inventory and optionally include next actions |
| `story next [path]` | Recommend the next deterministic writing or maintenance actions |
| `story doctor [path]` | Show health checks with actionable repair steps |
| `story export [path] --out manuscript.md` | Combine chapters into a single manuscript markdown file |
| `story build [path] --format epub` | Build disposable markdown, EPUB, or DOCX artifacts in `dist/` |
| `story universe init "Aetheria"` | Scaffold a universe container above story projects |
| `story universe scan [path]` | List all universe-level entities (id, name, type, file) |
| `story universe validate [path]` | Validate cross-level references, id uniqueness, no shadowing, frontmatter |
| `story universe report [path]` | Full universe inventory with entity counts and validation issues |

EPUB and DOCX builds target plain prose: scene-break lines (`***`, `---`) become a `* * *` separator paragraph, and other markdown structure such as lists or tables is flattened to text. The markdown export keeps chapter text as-is.

For a complete starter transcript, read [`docs/first-20-minutes.md`](docs/first-20-minutes.md). For the project contract, read [`docs/schema-v2.md`](docs/schema-v2.md) and [`schemas/story.schema.json`](schemas/story.schema.json).

Development uses Bun for tests and coverage:

```shell
bun run test
bun run test:coverage
bun run test:examples
bun run check:metadata
```

The copied-skill fallback CLI is generated from the package entrypoint. After changing CLI source, rebuild and check it before release:

```shell
bun run build:fallback
bun run check:fallback
node skills/story-maintenance/scripts/story.js --help
```

## 🤖 Write A Book Via Pull Requests

A story project with deterministic checks is a story project an agent can advance unattended. The [`templates/github/`](templates/github/) workflows turn a story repository into a self-drafting book:

- [`story-checks.yml`](templates/github/story-checks.yml) runs `story validate`, `story links`, and `story continuity` on every push and pull request, so a chapter PR cannot merge with a continuity contradiction.
- [`draft-next-chapter.yml`](templates/github/draft-next-chapter.yml) runs [Claude Code](https://github.com/anthropics/claude-code-action) on a schedule: it asks `story next` for the next deterministic action, drafts the next chapter with the chapter-writing skill, updates scene records and continuity state, runs the maintenance checks, and opens a pull request for review.

Copy both files into `.github/workflows/` in the repository that holds your story project, add an `ANTHROPIC_API_KEY` secret, and review one chapter PR per morning.

## 📥 Import An Existing Manuscript

Most writers don't start from a blank page. `story import` reverse-engineers a Story Skills project from work in progress:

```shell
story import draft.md --title "The Lost Coast" --genre mystery
```

It splits the manuscript on chapter headings (or imports a directory of chapter files), creates the full project layout with accurate word counts and registries, and prints recurring proper-name candidates so an agent can follow up with `story add character` and `story add location` to build out the bible.

## 📁 Project Structure

Running **story-init** creates this layout:

```
my-story/
├── story.md                  # Story bible — title, genre, themes, POV, tense
├── characters/
│   └── _index.md             # Character registry
├── worldbuilding/
│   ├── _index.md             # World overview
│   ├── locations/
│   ├── systems/
│   ├── factions/
│   └── artifacts/
├── plot/
│   ├── _index.md             # Arc overview
│   ├── arcs/
│   └── timeline.md
├── scenes/
│   └── _index.md             # Machine-readable scene registry
├── continuity/
│   ├── state.md              # Character, object, and knowledge state
│   ├── questions/
│   │   └── _index.md
│   └── promises/
│       └── _index.md
├── glossary/
│   ├── _index.md
│   └── terms/
└── chapters/
    └── _index.md             # Chapter registry
```

A universe container sits in a parent directory above story projects:

```
my-universe/
├── universe.md               # Universe bible — name, genre, tone, themes
├── characters/
│   └── _index.md             # Shared character registry
├── worldbuilding/
│   ├── _index.md             # World overview
│   ├── locations/
│   ├── systems/
│   ├── factions/
│   └── artifacts/
└── stories/
    └── my-story/             # A story project (structure as above)
```

## ⚙️ How It Works

Every story element is a markdown file with YAML frontmatter. The skills cross-reference those files so the project stays consistent:

- **`story.md`** is the top-level bible read by all skills
- `story.md` includes **`schema-version: 2`** so the CLI can detect incompatible project formats
- Characters, locations, and arcs use **kebab-case identifiers** (e.g., `sera-voss`)
- **`_index.md`** files serve as registries for each domain
- Relationships and references are maintained **bidirectionally**
- Scene records and continuity state make character knowledge, object ownership, and setup/payoff tracking durable
- Story content is created directly as markdown; generated build scripts are not part of the project format
- A `universe.md` file in a parent directory enables shared worldbuilding across story projects; `story init` auto-detects it

## 📖 Examples

- Explore [`examples/the-last-ember/`](examples/the-last-ember/) for a complete fantasy example: three characters, two locations, a magic system, a plot arc with foreshadowing, and a drafted first chapter.
- Explore [`examples/harbor-of-second-light/`](examples/harbor-of-second-light/) for a near-future coastal mystery example with memory technology, a posthumous witness arc, populated continuity state, and a drafted first chapter.
- Explore [`examples/the-unraveled-thread/`](examples/the-unraveled-thread/) for a deliberately broken project that demonstrates every class of finding the continuity engine reports.

## 🚢 Releasing

This fork is not published to any plugin marketplace. When it is ready for release, the process will involve:

1. Bump version in `package.json`, `.codex-plugin/plugin.json`, and `.claude-plugin/plugin.json`
2. Run `bun run check:metadata` to confirm alignment
3. Tag a release on GitHub

## 📄 License

[MIT](LICENSE)
