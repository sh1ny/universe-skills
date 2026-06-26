# Follow-Up: Universe Scaffold Gaps

> Source: `openspec/changes/epic-worldbuilding/verify.md` §4 (W1–W5)
> Status: W1 and W2b resolved in code commit `851e5a7`; W2a design/spec narrowing in the follow-up docs commit. W3–W5 resolved in commits `242d77e` (W5), `9e95c21` (W3), `9a41415` (W4). All gaps closed; 209 tests pass, 100% coverage.

---

## ~~W1~~ — `validateUniverse` cross-level gate inconsistency — **RESOLVED**

~~**Severity**: 🟡 painful (correctness)~~

**Problem**: `validateUniverse` gated cross-level/shadowing checks on `isStoryRoot` (`src/story.js:638`) — directory proximity to `universe.md` — rather than on `storyData.universe` (the frontmatter opt-in field). A story under an ancestor `universe.md` but without the `universe` field gets false-positive cross-level/shadowing errors.

~~**Diverges from**: D1 ("Universe is opt-in and additive") and D6 ("`story.md` frontmatter gains a `universe` field" — the field is the opt-in mechanism, not directory proximity). `scanProject` correctly gates on `story.data.universe` (line 322); only `validateUniverse` is inconsistent.~~

~~**Fix**: Change gate at line 681 from `if (isStoryRoot)` to `if (isStoryRoot && storyData.universe)`.~~ **Applied in code commit `851e5a7`.**

---

## ~~W2~~ — D3 design scope drift + missing narrative cross-level validation — **RESOLVED**

~~**Severity**: 🟡 painful (design + correctness)~~

**Problem**: D3 stated "both levels can hold any entity type" but only 5 worldbuilding types are scaffolded (characters, locations, systems, factions, artifacts). Narrative types (arcs, chapters, scenes, questions, promises, terms) are not universe-level.

### ~~W2a~~ — Narrow D3 in design and spec — **Applied in follow-up docs commit**

D3 reworded to "shared-worldbuilding entity types only" in `design.md`. Spec requirements "Universe entity scanning" and "Snapshot isolation" updated to explicitly list the 5 supported types and note narrative/metadata types are story-level only.

### ~~W2b~~ — Extend `validateUniverse` cross-level checks for narrative → worldbuilding refs — **Applied in code commit `851e5a7`**

Cross-level references from narrative entities to universe-level entities are now validated:

| Story entity | Fields now checked cross-level |
|---|---|
| Chapter | `pov`, `characters`, `mentions`, `locations` |
| Scene | `pov`, `location`, `characters`, `mentions` |
| Arc | `characters` |
| Question | `characters` |
| Promise | `characters` |

W2a applied in the follow-up docs commit; W2b applied in code commit `851e5a7`.

---

## ~~W3~~ — No-op path-safety test (task 9.8) — **RESOLVED**

~~**Severity**: 📌 nit (test coverage)~~

~~**Problem**: Task 9.8's "entity files outside `universeRoot` are refused" test (`test/story.test.js:1489-1498`) scans an empty universe and asserts `entities.characters=[]` and `entities.locations=[]`. It never creates an out-of-root file or asserts a refusal. Implementation IS safe (symlink test at lines 1500-1514 exercises the containment guard), but the specific scenario is untested.~~

~~**Fix**: Replace the test body with a sibling-outside-file-is-ignored test: create `characters/legend.md` inside `universeRoot` and `universe-outside-sibling/characters/rogue.md` outside it, then assert `scanUniverse` returns only `legend`.~~ **Applied in code commit `9e95c21`.**

---

## ~~W4~~ — Stale AGENTS.md test inventory — **RESOLVED**

~~**Severity**: 📌 nit (documentation)~~

~~**Problem**: AGENTS.md Test Files table (`AGENTS.md:238-247`) lists `story.test.js` as 23 tests (actual: ~79 across 9+ describe blocks including 7 universe groups) and `cli.test.js` as 8 tests (actual: ~22). No universe test groups mentioned.~~

~~**Fix**: Update the table with current counts and add universe test group descriptions.~~ **Applied in commit `9a41415`.**

---

## ~~W5~~ — Missing `schema-version` frontmatter removal test — **RESOLVED**

~~**Severity**: 📌 nit (test coverage)~~

~~**Problem**: Spec defines two frontmatter completeness scenarios:
- "Universe missing required frontmatter" (name missing → error) — **tested** (`test/story.test.js:1158-1168`)
- "Universe missing schema-version" (schema-version missing → error) — **NOT tested**~~

~~Implementation handles both via the loop at `src/story.js:665-670` iterating `UNIVERSE_REQUIRED_FRONTMATTER = ["name", "schema-version"]`.~~

~~**Fix**: Add a test that removes `schema-version` from `universe.md` and asserts `validation.ok === false` and `validation.errors` contains a string including `"schema-version"`.~~ **Applied in code commit `242d77e`.**

---

## Recommended Implementation Order

~~1. **W2a** — Narrow D3 in design.md and spec~~ ✅ Done
~~2. **W2b** — Extend cross-level validation for narrative → worldbuilding refs~~ ✅ Done
~~3. **W1** — Fix `validateUniverse` gating~~ ✅ Done
~~4. **W5** — Add `schema-version` test (quick, closes spec scenario gap)~~ ✅ Done
~~5. **W3** — Fix no-op path-safety test~~ ✅ Done
~~6. **W4** — Update AGENTS.md counts (documentation only)~~ ✅ Done
