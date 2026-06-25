# Follow-Up: Universe Scaffold Gaps

> Source: `openspec/changes/epic-worldbuilding/verify.md` §4 (W1–W5)
> Status: Non-blocking — implementation is complete and functional (118 tests, 100% coverage)
> Use as input for a new OpenSpec change (`/opsx-new-change`)

---

## W1 — `validateUniverse` cross-level gate inconsistency

**Severity**: 🟡 painful (correctness)

**Problem**: `validateUniverse` gates cross-level/shadowing checks on `isStoryRoot` (`src/story.js:638`) — directory proximity to `universe.md` — rather than on `storyData.universe` (the frontmatter opt-in field). A story under an ancestor `universe.md` but without the `universe` field gets false-positive cross-level/shadowing errors.

**Diverges from**: D1 ("Universe is opt-in and additive") and D6 ("`story.md` frontmatter gains a `universe` field" — the field is the opt-in mechanism, not directory proximity). `scanProject` correctly gates on `story.data.universe` (line 322); only `validateUniverse` is inconsistent.

**Fix**: Change gate at line 681 from `if (isStoryRoot)` to `if (isStoryRoot && storyData.universe)`.

---

## W2 — D3 design scope drift + missing narrative cross-level validation

**Severity**: 🟡 painful (design + correctness)

**Problem**: D3 states "both levels can hold any entity type" but only 5 worldbuilding types are scaffolded (characters, locations, systems, factions, artifacts). Narrative types (arcs, chapters, scenes, questions, promises, terms) are not universe-level. Two sub-actions needed:

### W2a — Narrow D3 in design and spec

Reword D3 from "any entity type" to "any shared-worldbuilding entity type." Update spec requirements "Universe entity scanning" and "Snapshot isolation" to explicitly list the 5 supported types and note narrative/metadata types are story-level only.

### W2b — Extend `validateUniverse` cross-level checks for narrative → worldbuilding refs

Cross-level references from narrative entities to universe-level entities are NOT validated:

| Story entity | Fields NOT checked cross-level |
|---|---|
| Arc | `characters` |
| Chapter | `pov`, `characters`, `mentions`, `locations` |
| Scene | `pov`, `location`, `characters`, `mentions` |
| Question | `characters` |
| Promise | `characters` |

**Impact**: A chapter with `pov: ancient-one` (a universe-level character) passes `story universe validate` even if `ancient-one` doesn't exist.

**Fix**: Extend `validateUniverse` (`src/story.js:755`) to add iteration loops for arcs, chapters, scenes, questions, and promises — checking their character/location/faction/artifact ref fields against existing combined maps. Mirror what `validateLinks` (`src/story.js:511-614`) already does for same-level references.

---

## W3 — No-op path-safety test (task 9.8)

**Severity**: 📌 nit (test coverage)

**Problem**: Task 9.8's "entity files outside `universeRoot` are refused" test (`test/story.test.js:1489-1498`) scans an empty universe and asserts `entities.characters=[]` and `entities.locations=[]`. It never creates an out-of-root file or asserts a refusal. Implementation IS safe (symlink test at lines 1500-1514 exercises the containment guard), but the specific scenario is untested.

**Fix**: Replace the test body with one that creates an entity file at a path lexically outside `universeRoot` and verifies `scanUniverse` refuses to read it.

---

## W4 — Stale AGENTS.md test inventory

**Severity**: 📌 nit (documentation)

**Problem**: AGENTS.md Test Files table (`AGENTS.md:238-247`) lists `story.test.js` as 23 tests (actual: ~79 across 9+ describe blocks including 7 universe groups) and `cli.test.js` as 8 tests (actual: ~22). No universe test groups mentioned.

**Fix**: Update the table with current counts and add universe test group descriptions.

---

## W5 — Missing `schema-version` frontmatter removal test

**Severity**: 📌 nit (test coverage)

**Problem**: Spec defines two frontmatter completeness scenarios:
- "Universe missing required frontmatter" (name missing → error) — **tested** (`test/story.test.js:1158-1168`)
- "Universe missing schema-version" (schema-version missing → error) — **NOT tested**

Implementation handles both via the loop at `src/story.js:665-670` iterating `UNIVERSE_REQUIRED_FRONTMATTER = ["name", "schema-version"]`.

**Fix**: Add a test that removes `schema-version` from `universe.md` and asserts `validation.ok === false` and `validation.errors` contains a string including `"schema-version"`.

---

## Recommended Implementation Order

1. **W2a** — Narrow D3 in design.md and spec (resolves the design contradiction, clears the way for W2b)
2. **W2b** — Extend cross-level validation for narrative → worldbuilding refs (highest user impact)
3. **W1** — Fix `validateUniverse` gating (prevents false positives for non-opted-in stories)
4. **W5** — Add `schema-version` test (quick, closes spec scenario gap)
5. **W3** — Fix no-op path-safety test
6. **W4** — Update AGENTS.md counts (documentation only)
