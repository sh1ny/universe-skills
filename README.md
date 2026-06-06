<div align="center">

# ✨ Story Skills

**Agent Skills for planning, tracking, and drafting fiction in markdown.**

Story Skills gives agents a shared project format for fiction: a story bible, character files, worldbuilding notes, plot arcs, timelines, and chapter drafts. Everything is plain markdown with YAML frontmatter, packaged as standard Agent Skills with Codex and Claude Code plugin support.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/Agent_Skills-SKILL.md-blue)](https://agentskills.io)
[![Codex](https://img.shields.io/badge/Codex-plugin-10A37F)](https://developers.openai.com/codex)
[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-blueviolet)](https://docs.anthropic.com/en/docs/claude-code)

</div>

---

> Built on the open **Agent Skills** standard. Install it as a **Codex** or **Claude Code** plugin, or copy the `skills/` folders into any agent that supports `SKILL.md`.

## 🚀 Quick Start

```shell
# Codex plugin
codex plugin marketplace add danjdewhurst/story-skills
codex plugin add story-skills@story-skills

# Claude Code plugin
/plugin marketplace add danjdewhurst/story-skills
/plugin install story-skills@story-skills
```

Then ask **"Start a new story"** to scaffold the project.

## ✍️ Highly Recommended: Better Writing

For stronger chapter drafts and revision passes, install [forjd/better-writing](https://github.com/forjd/better-writing) alongside Story Skills. It adds voice calibration, anti-generic writing checks, and a final prose-quality pass.

```shell
npx skills add forjd/better-writing
```

Or with Bun:

```shell
bunx skills add forjd/better-writing
```

Story Skills works without it, but chapter drafting and revision are better when agents can use `better-writing`.

## 📦 Installation

<details>
<summary><strong>Codex</strong></summary>

```shell
# Add the marketplace
codex plugin marketplace add danjdewhurst/story-skills

# Install the plugin
codex plugin add story-skills@story-skills
```

For local skill authoring without a plugin install:

```shell
git clone https://github.com/danjdewhurst/story-skills.git
cp -r story-skills/skills/* ~/.agents/skills/

# Or install to a specific repo as repo-scoped skills
cp -r story-skills/skills/* .agents/skills/
```

Codex detects repo and user skills automatically. The plugin install is still the recommended path for this bundle.

</details>

<details>
<summary><strong>Claude Code</strong></summary>

```shell
# Add the marketplace
/plugin marketplace add danjdewhurst/story-skills

# Install the plugin
/plugin install story-skills@story-skills
```

</details>

<details>
<summary><strong>GitHub Copilot (VS Code)</strong></summary>

[VS Code with Copilot](https://code.visualstudio.com/docs/copilot/customization/agent-skills) discovers skills from multiple directories:

```shell
git clone https://github.com/danjdewhurst/story-skills.git

# Copy skills to your project (any of these work)
cp -r story-skills/skills/* .github/skills/
cp -r story-skills/skills/* .agents/skills/

# Or install globally
cp -r story-skills/skills/* ~/.copilot/skills/
```

Skills can activate when your request matches a skill description, or you can invoke them manually.

</details>

<details>
<summary><strong>Cursor</strong></summary>

[Cursor](https://www.cursor.com) supports the `SKILL.md` standard:

```shell
git clone https://github.com/danjdewhurst/story-skills.git

cp -r story-skills/skills/* .agents/skills/
```

</details>

<details>
<summary><strong>Windsurf</strong></summary>

[Windsurf](https://windsurf.com) discovers skills from workspace and global directories:

```shell
git clone https://github.com/danjdewhurst/story-skills.git

# Copy skills to your project
cp -r story-skills/skills/* .windsurf/skills/

# Or install globally
cp -r story-skills/skills/* ~/.codeium/windsurf/skills/
```

Cascade can invoke a matching skill automatically. You can also use `@skill-name` to invoke one directly.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

[Gemini CLI](https://github.com/google-gemini/gemini-cli) supports the same `SKILL.md` format via the [Agent Skills](https://agentskills.io) standard:

```shell
# Install all skills globally
gemini skills install https://github.com/danjdewhurst/story-skills.git

# Or install a specific skill
gemini skills install https://github.com/danjdewhurst/story-skills.git --path skills/story-init
gemini skills install https://github.com/danjdewhurst/story-skills.git --path skills/character-management
gemini skills install https://github.com/danjdewhurst/story-skills.git --path skills/worldbuilding
gemini skills install https://github.com/danjdewhurst/story-skills.git --path skills/plot-structure
gemini skills install https://github.com/danjdewhurst/story-skills.git --path skills/chapter-writing

# Or link locally after cloning
git clone https://github.com/danjdewhurst/story-skills.git
gemini skills link story-skills/skills
```

Gemini discovers the skills and can activate them when your request matches a skill description.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

The skills use the same `SKILL.md` format that [OpenCode](https://opencode.ai) supports natively:

```shell
git clone https://github.com/danjdewhurst/story-skills.git

# Copy skills to your project
cp -r story-skills/skills/* .opencode/skills/

# Or install globally
cp -r story-skills/skills/* ~/.config/opencode/skills/
```

OpenCode also searches common skill paths such as `.claude/skills/`, so compatible project-level skills can be discovered automatically.

</details>

<details>
<summary><strong>Other platforms</strong></summary>

These skills follow the open [Agent Skills](https://agentskills.io) standard: `SKILL.md` files with YAML frontmatter. For any compatible agent, copy the skill folders into that agent's skills directory.

For non-agent use:

- **Claude.ai / ChatGPT Projects** — add the SKILL.md and reference files as project knowledge
- **Any LLM API** — include skill content in system prompts
- **Manual use** — the templates, workflows, and story structure are model-agnostic

</details>

## 🛠️ Skills

| Skill | What it does | Try saying |
|-------|-------------|------------|
| **story-init** | Scaffolds the story bible, folders, and registries | *"Start a new story"* |
| **character-management** | Creates character profiles with relationships, traits, arcs, and family trees | *"Create a character"* |
| **worldbuilding** | Builds locations and systems: magic, politics, technology, religion, and more | *"Design a magic system"* |
| **plot-structure** | Plans arcs with structures like three-act, hero's journey, Save the Cat, and kishotenketsu | *"Create a plot arc"* |
| **chapter-writing** | Drafts chapters through an outline-first workflow that pulls from story context | *"Write the next chapter"* |
| **story-maintenance** | Runs deterministic CLI checks for validation, indexing, links, word counts, and export | *"Validate my story project"* |

For stronger prose, pair **chapter-writing** with [**better-writing**](https://github.com/forjd/better-writing).

## 🧰 Companion CLI

The optional `story` CLI handles deterministic project maintenance while the skills handle the creative workflow.

```shell
bun install
bun run story --help
```

The package also exposes a Node-compatible bin, so published installs can run `story` through npm/npx without Bun-specific runtime APIs. For copied-skill installs, `story-maintenance` includes a bundled `scripts/story.js` fallback that agents can run with Node.

| Command | Purpose |
|---------|---------|
| `story init "The Last Ember"` | Scaffold a story project with the standard markdown layout |
| `story validate [path]` | Check required files, YAML frontmatter, registries, and word-count warnings |
| `story reindex [path]` | Rebuild registry tables from the current markdown files |
| `story wordcount [path] --write` | Count chapter prose and update chapter frontmatter plus the chapter registry |
| `story links [path]` | Check character, location, chapter, and arc cross-references/backlinks |
| `story export [path] --out manuscript.md` | Combine chapters into a single manuscript markdown file |

Development uses Bun for tests and coverage:

```shell
bun run test:coverage
```

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
│   └── systems/
├── plot/
│   ├── _index.md             # Arc overview
│   ├── arcs/
│   └── timeline.md
└── chapters/
    └── _index.md             # Chapter registry
```

## ⚙️ How It Works

Every story element is a markdown file with YAML frontmatter. The skills cross-reference those files so the project stays consistent:

- **`story.md`** is the top-level bible read by all skills
- Characters, locations, and arcs use **kebab-case identifiers** (e.g., `sera-voss`)
- **`_index.md`** files serve as registries for each domain
- Relationships and references are maintained **bidirectionally**

## 📖 Example

> Explore [`examples/the-last-ember/`](examples/the-last-ember/) for a complete fantasy example: three characters, two locations, a magic system, a plot arc with foreshadowing, and a drafted first chapter.

## 🚢 Releasing

Codex uses `.codex-plugin/plugin.json` as its plugin version source. Claude Code uses `.claude-plugin/plugin.json`. Bump both versions for every published change so installed users receive updates; keep marketplace entries unversioned to avoid duplicate version state.

Distribution metadata lives in `.claude-plugin/` for Claude Code and `.codex-plugin/` plus `.agents/plugins/marketplace.json` for Codex. The `plugins/story-skills` symlink is intentional: Codex marketplace entries must point at a child plugin directory, so the symlink exposes the repo-root plugin without duplicating `skills/`.

## 📄 License

[MIT](LICENSE)
