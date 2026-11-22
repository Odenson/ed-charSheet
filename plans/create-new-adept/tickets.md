# Feature: Create new adept (create-new-adept)

## Summary
From the character loader, the player picks one of the existing disciplines
(Archer, Nethermancer, Thief, Warrior) to start a brand-new Circle-1 character.
A small modal takes a name and race; the app builds a draft character (race
starting attributes, the discipline at Circle 1, its free talents, starting kit
+ 100 silver, Legend 0/0) that lives in the browser until Saved — the first Save
creates `data/characters/<id>.json` and its index row on the `character-data`
branch. While a draft is in "creation mode" the existing tabs swap Legend
steppers for free-point steppers (8 talent points, 25 attribute points, starting
skills, Nethermancer starting spells) until the player finishes creation.

## Goals / Non-goals
- Goal: "Start a new character" section in the loader, one "+" button per discipline.
- Goal: name + race modal; id derived from the name; NO auto-suffix — a name whose id already exists (index or draft) shows a warning and must be changed, both at the modal and again (fresh index re-check) at first Save, where a rename prompt blocks the save until resolved.
- Goal: draft persists in localStorage, shows as "unsaved draft" in the loader, can be discarded (ed-confirm).
- Goal: first Save creates the file + index row via the existing worker (no worker change expected).
- Goal: creation mode covering talent points, attribute points, starting skills, starting spells, then Finish creation (warn + forfeit leftovers; attribute leftovers -> Max Karma).
- Goal: seed starting kit (Adventuring Kit, Dagger, Traveler's Garb, Trail Rations 1 week, Grimoire for magicians) + 100 silver; add the missing three items to `rules/items.json`.
- Non-goal: Human Versatility / other-discipline talents at creation; Dwarf language swap.
- Non-goal: Talent Option during creation (bought later with Legend).
- Non-goal: per-discipline icon art, portrait selection, deleting saved characters.
- Non-goal: any worker/save-protocol change; other disciplines beyond the four in `rules/disciplines.json`.

## Guardrail alignment
Docs touched: UI-GUIDELINES (loader modal, creation chip), ARCHITECTURE §4.1
(`creation` block), RULES-FAQ Q039, THREAD-ITEMS untouched, MODALS (kit-based
modals). Tiers below. One Tier-1 item (T4) has owner sign-off:
qa-log "2026-11-21 — TIER-1 SIGN-OFF". No Tier-2 (taxonomy) items.
All Tier-1 UI rules must hold: Overview fits viewport, placeholder pills, light/dark,
Escape/Enter on modals, two font weights, UI dispatches / engine pure.

## Tickets
### T1 — Pure new-character builder (engine)
- **What:** Pure DOM-free `engine/new-character.js`: from `{name, race, discipline}` + rules build the draft `ed-character/2` object (meta with `id`, race starting attributes as `base`, `points`/`increases` 0, discipline `{name, circle:1, talents:[]}`, empty skills/spells, resources karma/legend 0/0, starting kit items, wealth 100 silver, `creation` block); id slug + pure `idTaken` helper.
- **Why:** Keeps creation logic out of the UI (data-down/dispatch-up).
- **Tier:** 3 (new engine module; stores inputs only)
- **Acceptance criteria:** unit tests for each race x discipline; id slug and idTaken check (no suffixing); no derived values stored; magician gets Grimoire, others not.
- **Open questions:** none.

### T2 — Loader "Start a new character" section + name/race modal
- **What:** `ed-character-picker` gets a section below the list with one "+" icon button + discipline name per discipline (also on empty store); click opens a kit-based modal (name, race select) that dispatches `create-character` up; picker rows for drafts show an "unsaved draft" badge and a Discard action via `ed-confirm`.
- **Why:** The entry point the owner asked for.
- **Tier:** 3 (new view content; must honor Tier-1 modal/theme/font rules)
- **Acceptance criteria:** Escape closes, Enter confirms; light + dark; two font weights; keyboard reachable; empty name blocked; taken id shows an inline warning and blocks submit; discard confirms and removes only the local draft.
- **Open questions:** none.

### T3 — Draft persistence and first-Save creation
- **What:** `store.js`/`ed-app.js`: draft stored in localStorage (own keyed envelope), listed in the loader merged with the index, loadable and editable like any character via the existing overlay path; first Save posts it through the existing save worker (creates file + index row); after a successful save the draft is cleared and the character loads normally. Dirty-switch guard applies.
- **Why:** "Initially created in the UI, if saved created on the character-data branch."
- **Tier:** 3 (no schema change; reuses worker create path)
- **Acceptance criteria:** reload keeps the draft; Save creates the file and index row (verified via store-server test); 409/overwrite behavior unchanged; discard leaves branch untouched.
- **Open questions:** confirm the worker create path needs no change (planner to verify).

### T4 — `creation` block in the character file
- **What:** Additive optional top-level `creation` block on `ed-character/2` (inputs only: open/finished flag and the free-allotment ranks recorded per talent/skill/spell/attribute so the Legend audit can treat them as free). Document in ARCHITECTURE §4.1; readers ignore it when absent; Legend audit (`engine/legend-spent.js`) and `forSave`/`applyEdits` carry it.
- **Why:** The audit must know which ranks were free; a draft saved mid-creation must resume after reload.
- **Tier:** 1 (schema shape — owner sign-off: qa-log "2026-11-21 — TIER-1 SIGN-OFF")
- **Acceptance criteria:** schema tag stays `ed-character/2`; existing characters unchanged and audit totals identical; creation ranks cost 0 Legend; conformance tests green.
- **Open questions:** none.

### T5 — Creation mode: talents and attributes
- **What:** While `creation` is open: Disciplines tab talent steppers spend 8 free points (First-Circle Discipline Talents only, max 3 each, Talent Option excluded); Overview attribute steppers spend 25 attribute points over race base using the cost table (range -2..+8, lowering refunds); "points left" chips; leftover attribute points convert to extra Max Karma at Finish.
- **Why:** Book creation allotments.
- **Tier:** 3 (UI within guidelines; engine helpers pure) — but see T4 dependency.
- **Acceptance criteria:** budgets enforced by engine; derived values still placeholder pills where unresolvable; Overview still fits viewport; light/dark.
- **Open questions:** none.

### T6 — Creation mode: starting skills and starting spells
- **What:** Skills: fixed free ranks (Knowledge 2, Artisan 1, Speak Language 2, Read/Write 1) plus 8 extra ranks (General picks Novice-tier only), total <= 3 per skill. Spells (magician/Nethermancer): points = Perception Step, each spell costs its Circle, Circle 1–2 from own discipline; two free Standard Matrices already from free talents.
- **Why:** Book creation allotments.
- **Tier:** 3
- **Acceptance criteria:** engine enforces allotments; Perception Step derived from the model; non-magicians see no spell step.
- **Open questions:** none.

### T7 — Finish creation
- **What:** "Finish creation" action (ed-confirm listing unspent talent/skill/spell points; confirm forfeits them), closes the `creation` block, converts unused attribute points to Max Karma, after which normal Legend rules apply.
- **Why:** Defines the end of free-rank mode.
- **Tier:** 3 (depends on T4)
- **Acceptance criteria:** after finish, steppers use Legend pricing; Legend audit available = 0; Karma max includes leftover points; Escape/Enter honored.
- **Open questions:** none.

### T8 — Starting kit catalog items
- **What:** Add Traveler's Garb, Trail Rations (1 week) and Grimoire to `rules/items.json` (cost/weight/description from the Player's Guide, via rule-agent); seed kit (Adventuring Kit, Dagger, + those) in T1.
- **Why:** Items missing from the catalog.
- **Tier:** 3 (data fitting existing schema/taxonomy)
- **Acceptance criteria:** `rules-conformance` and item tests pass; values match rules.md.
- **Open questions:** none.

### T9 — Docs, tests, changelog
- **What:** Update UI-GUIDELINES, ARCHITECTURE §4.1/§7, README as needed; `data/changelog.json` unreleased entry; tests for builder, draft store, creation allotments, finish.
- **Why:** Keep docs truthful.
- **Tier:** 3
- **Acceptance criteria:** `npm test` green; docs match code.
- **Open questions:** none.
