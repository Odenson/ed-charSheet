# PLAN — Arrow of Night: uplift to a Shadow-Meld-style active effect

_Status: draft, for owner review._

## 1. Goal

Make **Arrow of Night** (Nethermancer, Circle 3) a real **active effect** on the same
shape as Shadow Meld: a successful self-cast lands the spell in the session active-effect
set, folds its mechanics into the character while active, and counts down per Initiative
round. What the change carries:

1. **A missile weapon effect** — +6 (Step) to the enchanted missile's **damage step**,
   folded into the Combat tab's missile Damage pool while the spell is up (rides the
   active record, folds, counts down).
2. **A spell-data note** — a target damaged by the missile suffers **−2 Mystic Armor until
   the end of the next round**. This is a *target-side* debuff, not a caster buff, so it is
   tagged **`gmDiscretion: true`** exactly like its extra-thread sibling and carried by the
   Spells-tab card — **not** in the session active-effect set (§3.4).

Rulebook source: Players Guide (text-spell-players.txt:2838–2861, p. 324–326) —
Threads 0, Weaving 7/12, Casting 6, Range Touch, Duration 2 rounds, Strain 1 paid by the
firer, missile must be fired within one round or the enchantment is lost.

## 2. Why this is not just "tweak the summary"

Today the entry's mechanics are **display-only**:

- `rules/spells.json:1770-1784` — the only `effects[]` entry is
  `attack-modifier` on `{ attack, Damage }`, `value: 6`,
  `measure: "rating"`, `duration: "test"`. It is **not `sustained`**, so
  `isSustainedSelfEffect` is false → `ed-spell-activate` never fires → no active
  record, no fold, no countdown. The +6 reaches nothing.
- The −2 Mystic Armor penalty has **no effect entry at all** — only `summary`/
  `description` and a throwaway extra-thread `note`.
- Stat block drifts from the book: `threadsToWeave: 1` (book: 0) and
  `weavingDifficulty: {6, 11}` (book: 7 / 12). `castingTarget: "Fixed 6"` and
  `duration: "2 rounds"` are correct.

The "session-level across tabs" mechanism the owner referenced **exists and is verified**:
`ed-app._activateSpell` → `session.activeSpells` (`buildActiveSpell`) → store folds
`activeSpellEffects` into `model.activeEffects` (store.js:971, tagged `origin.spell`) →
`abilityTestMods` (store.js:1562) binds **named-ability** `test-modifier`s onto ability
rows (Shadow Meld's `{ test, Stealthy Stride }` +4 truly reaches the Disciplines roll —
store-combat.test.js:452). That path only binds *named abilities*; a spell-origin weapon
**damage-step** buff (`attack-modifier` / `{ attack, Damage }`) binds no ability row and is
**not** currently fed into `collectCombatEffects` (only options / situations / charms /
armedTalents / weapon effects are). So Arrow of Night needs the session fold **plus one
missing leg** for attack damage-step mods — and that leg is the generalisation that makes
it "the same for other spells."

## 3. Answered design decisions (owner)

1. **Fold the roll** — yes: the +6 must reach a missile Damage roll while active, not just
   display. Implementation reuses the session→activeEffects mechanism (like Shadow Meld)
   and extends the Combat pool fold so spell-origin `attack-modifier` damage-step mods ride
   the pool.
2. **Stat fixes** — yes: `threadsToWeave 1→0`, `weavingDifficulty {6,11}→{7,12}`.
3. **Measure** — `step`. The rulebook's general rule (PG p.34) applies a bonus-to-a-test
   to the Step before rolling (Silar's crossbow "bonus damage" Step 10→14 precedent; the
   identical "+3 bonus to Damage tests" phrasing is read as steps). Confirmed by the
   rule-agent (FAQ **Q009**). The current `measure: "rating"` is a measure mismatch for a
   roll bonus
   (and the taxonomy's auto-apply rule guards a `rating` measure from touching a step,
   EFFECT-TAXONOMY.md:308-309).
4. **Target-side −2 MA note** — tagged **`note` + `gmDiscretion: true`**, byte-identical in
   shape to the extra-thread "−2 Mystic Armor penalty" note (spells.json:1750-1755): same
   debuff, one tagging. It does **not** ride the active record. The reason is two-fold and
   neither is `condition`:
   - **Why it never folds** — `sustainedEffectsOf` (spells.js:184-186) filters on
     `duration === "sustained" && !gmDiscretion` and **ignores `condition`**; and
     `type: "note"` has no folding consumer in any fold (`buildActiveSpell`'s numeric fold,
     `abilityTestMods`, `foldPool` all skip notes). A note never becomes a number regardless
     of its tags — so a `condition: "on-success"` tag would have been inert *and* misleading
     (the debuff door opens on the missile *hitting*, a GM call, not on the cast succeeding).
   - **Why it stays on the card, not the record** — `gmDiscretion: true` is the taxonomy §6
     marker for "GM-surface, never baked by the engine," and spells.js:183 documents the
     intent: *"gmDiscretion effects (target debuffs) never fold onto the caster."* The −2 MA
     applies to a **foreign entity** (the target) the app does not model; the player-facing
     ±-list of the caster's active effects is the wrong home for it. The correct home is the
     spell's own data (its card + card note), alongside the sibling extra-thread note.
5. **Scope carrier** — the +6 effect carries `scope: "missile"` (taxonomy `scope` is free
   text, EFFECT-TAXONOMY.md:300; this documents one usage as a weapon-category tag,
   mirroring `appliesTo`). The Combat fold only feeds it while the selected weapon's
   category is `missile`.
6. **Taxonomy tag — `attack-modifier` / `{ attack, Damage }`, NOT `test-modifier`.**
   The +6 is the enchanted missile's **attack damage step**. Taxonomy §3 splits the two
   `Damage` names on purpose (`attack/Damage` = "the attack's damage step", what
   `attack-modifier` touches; `test/Damage` = "the Damage test as a roll category" for
   karma-permission / generic test-modifiers, EFFECT-TAXONOMY.md:160-170), and the repo's
   weapon data is monolithic on that split — every thread weapon/armament models
   "Damage step +N" as `attack-modifier` + `measure: "step"` (thread-items.json:395-445,
   853-889, e.g. "Missile damage: Strength step + 5"). The pool fold *is* the combat
   resolution the taxonomy's open question §6 reserved `{ attack, Damage }` for
   (EFFECT-TAXONOMY.md:424-430). `test/{test, Damage}` would over-claim generality and read
   as a mis-tagged effect to a future reader. Choosing `attack-modifier` for engine-fold
   convenience would trade a tiny engine diff for a lasting taxonomy inconsistency — so the
   fold is widened *to the honest tag* instead.

## 4. Guardrail classification (ed-change-guardrail)

- **Tier 3** overall. No Tier-1 surface: no UI-GUIDELINES rule touched; data
  flows down / events up unchanged (new values are all derived, nothing new persisted —
  `activeSpells` stays session-only like knockdown); engine additions stay pure/DOM-free;
  "store only inputs" intact.
- **No Tier-2**: the `effects` reuse the **existing** vocabulary — `attack-modifier`
  (`{ attack, Damage }`), `note`, `measure: step`, `duration: sustained`, free-text
  `scope`. **No taxonomy version bump.**
- **One near-the-line item to confirm:** the Combat pool fold (Phase 3) adds an
  `activeSpellBundles` argument to `collectCombatEffects` and widens `appliesToTest`/
  `foldPool` to read `attack-modifier` `{ attack, Damage | Attack }`. That is new *engine
  plumbing* — it formalises, at last, the `{ attack, Damage }` corpus the taxonomy already
  defines (§3) and reserves for combat resolution (§6 open Q6) — not a vocabulary or schema
  change. Read as Tier 3 ("new lazy-loaded engine modules" / extended behavior within
  existing taxonomy). The engine stays pure; the view supplies the selected
  `activeSpellBundles`, the engine folds them via the existing `addBundle`.
- **No double-fold risk**: the selected weapon's *own* damage step rides the pre-derived
  base (`weaponDamageStep`) and never enters the pool as an effect list (`weaponPoolEffects`
  admits only `test-modifier`/`resource-modifier`, combat.js:268-273). After this change
  the only new `attack-modifier` consumers are active **spell** bundles — weapons are
  untouched, so nothing is folded twice.

## 5. Implementation phases

### Phase 1 — Data: uplift `rules/spells.json` Arrow of Night

Stat fixes + active-effect structure (lines 1697–1786):

```jsonc
"threadsToWeave": 0,
"weavingDifficulty": { "value": 7, "reattune": 12 },
// ...
"effects": [
  { "type": "attack-modifier",
    "target": { "domain": "attack", "name": "Damage" },
    "operation": "add", "value": 6, "measure": "step",
    "duration": "sustained", "condition": "always",
    "scope": "missile", "source": "spell",
    "summary": "+6 to the enchanted missile's Damage step while active." },
  { "type": "note",
    "gmDiscretion": true, "source": "spell",
    "summary": "Target damaged by the missile suffers −2 Mystic Armor until the end of the next round." }
]
```

The main effect keeps its *current* type/target (`attack-modifier` / `{ attack, Damage }` —
unchanged from the entry that exists today, just now `sustained`/`always`/`scope`/`step`);
only `measure: "rating" → "step"` and `duration: "test" → "sustained"` move it from
display-only into an active effect.

The base-spell note is `gmDiscretion: true` with **no** `condition`/`duration` — the exact
shape of the extra-thread "−2 Mystic Armor penalty" note at spells.json:1750-1755, so the
same debuff carries one tagging (§3.4). Of the top-level `effects`, only the +6
`attack-modifier` has `duration: "sustained"` (and rides `sustainedEffectsOf`); the note is
excluded (`gmDiscretion`) and stays on the card.

Extra-thread `+2 Damage` (lines 1728–1746): also already `attack-modifier` / `{ attack,
Damage }` — only `measure: "rating"` → `"step"`. **`duration` is left on its current
`"test"`** — changing it is a **no-op** either way: `extraThreads[].effects` never reach
`sustainedEffectsOf` (which reads top-level `spell.effects` only); they are consumed by
`sumOptionBoosts`/`castBoosts` (spells.js:269-297), which key on `measure` (`step` →
`stepAdd`, `rating` → `ratingAdd`) and never read `duration`. The woven thread's
`stepAdd` reaches the pool via **Phase 2** (`buildActiveSpell` folds it into the +6). The
`−2 Mystic Armor penalty` extra-thread `note` stays as-is (its `summary` gets the "until the
end of the next round" wording).

Effects of the static-`rating` neutral change: no other rule file uses these fields.

### Phase 2 — Engine: `buildActiveSpell` folds `stepAdd` (engine/spells.js:221)

Today only `ratingAdd` is folded into the first numeric sustained effect (lines
224–232). Generalise: fold `stepAdd` into a sustained **step**-measure numeric effect and
`ratingAdd` into a sustained **rating**-measure one (measure-matched). Keeps Soul Armor
(rating) behavior identical; makes Arrow of Night's `+2 Damage` extra thread and any
future step-measure buff extra threads actually raise the active value.

```js
const { stepAdd, ratingAdd, durationRounds: durationBoost } = castBoosts(spell, ctx.extraPicks, ctx.successLevels);
let boosted = false;
const effects = sustainedEffectsOf(spell).map((e) => {
  if (!boosted && typeof e.value === 'number') {
    const need = (e.measure ?? 'rating') === 'step' ? stepAdd : ratingAdd;
    if (need) { boosted = true; return { ...e, value: e.value + need }; }
  }
  return e;
});
```

**Known limitation (same as today, not worsened).** The single `boosted` flag means only the
*first* numeric sustained effect ever receives a boost and it receives exactly one of
`stepAdd`/`ratingAdd` — whichever matches its measure. That is safe for every spell that
exists today (Arrow of Night, Soul Armor: one numeric sustained effect, one measure), but a
future spell with **both** a step-measure *and* a rating-measure sustained effect could
mis-target: the second effect is never boosted, and a cast whose boosts mix measures
(stepAdd + ratingAdd) would leave a boost unapplied. Documented here so the single-flag
limit is a *chosen* one, not a surprise — flag for owner if a spell ever spans both
measures.

### Phase 3 — Combat pool: active-spell damage-step mods fold (engine/combat.js + ui/ed-combat.js)

Generalises the session pattern so any active spell's `attack-modifier` `{ attack, Damage }`
(and `{ attack, Attack }`) step mods reach the pools — "the same for other spells."

- **engine/combat.js `appliesToTest` + `foldPool`** — widen the fold reader from
  `test-modifier`-only to also accept `attack-modifier`, mapped per the taxonomy's own
  §3 / §6 open-Q6 axis:
  ```js
  // appliesToTest: attack-modifier branch — attack/Damage → the attack's damage step (loaded
  // into damagePool); attack/Attack → the to-hit test (attackPool).
  if (e.type === 'attack-modifier') {
    if (!t || t.domain !== 'attack') return false;
    if (t.name === 'Damage') return kind === 'damage';
    if (t.name === 'Attack') return kind === 'attack';
    return false;
  }
  // foldPool: admit the type next to test-modifier — `measure` handling unchanged, so a
  // "rating"-measure attack-modifier is still dropped by the measure guard (taxonomy §6).
  ```
  No change to `damagePool` / `attackPool` / `weaponDamageStep` / the store's
  `abilityTestMods` — the widening is additive, and weapon effects still never flow through
  `foldPool` (see §4 double-fold note).
- **ed-combat._poolEffects**: pass `activeSpellBundles` — group `model.activeEffects`
  (`origin.kind === 'spell'`) into `{ name, effects }` bundles where the effect is an
  auto-apply `attack-modifier` targeting `attack/Attack` or `attack/Damage` and, when it
  has a `scope`, that scope equals the selected weapon's `category` (missile → only folds
  for a missile weapon). Selection lives in the view (mirrors `_armedForPick`,
  ed-combat.js:638), exactly like armedTalents.
- **engine/combat.js `collectCombatEffects`**: add `activeSpellBundles = []` arg; fold each
  bundle through the existing `addBundle`, so the step-audit names the spell as its source
  and the widened `appliesToTest` picks the right pool (Damage → damage only).

### Phase 4 — Tests

- **engine/spells.test.js**:
  - Arrow of Night: `isSustainedSelfEffect` true; `sustainedEffectsOf` returns **only** the
    +6 `attack-modifier` — the `gmDiscretion` note is excluded (spells.js:184-186);
    `buildActiveSpell(..., rank, {})` → 1 numeric sustained effect `value 6`
    `measure step`, `roundsLeft: 2`, `effectLabel` "+6 Damage step".
  - `buildActiveSpell` with `extraPicks: ['Increase Effect (+2 Damage)']` → value 8.
  - Existing Soul Armor rating fold test unchanged (green).
- **engine/combat.test.js** (or store-combat.test.js):
  - `collectCombatEffects` with an `activeSpellBundles` bundle → an `attack-modifier`
    `{ attack, Damage }` `measure: "step"` lands in `damageEffects` → `damagePool` folds
    it; the attack pool ignores it. A `{ attack, Attack }` variant lands in the attack
    pool only.
  - **Measure guard**: same bundle with `measure: "rating"` is dropped by `foldPool`
    (locks the taxonomy §6 auto-apply rule) — proves a rating-modifier is not a step.
  - Scope gate: `scope:"missile"` folds for weapon `category:'missile'`, not `melee`.
  - **Corpus regression (belt-and-suspenders).** The `foldPool`/`appliesToTest` widening is a
    reader change for *any* pool input, not just spell bundles — benign today only because
    no existing bundle type (option/situation/charm/armedTalent/weapon) feeds
    `attack-modifier` into `foldPool`. Pin that: a representative existing fold — e.g.
    `selectedOptions: ['Aggressive Attack', ...]`, a situation, a charm, an armed talent,
    and a weapon's woven effects — asserts `attackPool`/`damagePool`/`strain` output that is
    *bit-identical* to today (step/resultMods per pool, strain), including that a
    `measure:"rating"` attack-modifier stays dropped. Catches any future bundle that starts
    feeding `attack-modifier` through existing paths and silently changes a fold.
- **Data test**: Arrow of Night stat block matches the book (threads 0, weaving 7/12).

## 6. Notes / caveats

- **Duration model**: the active record counts down the spell's full 2 rounds. The book's
  "must be fired within one round" and the target-side penalty "until the end of the next
  round" are tighter than the record — both are honored as the GM-facing note (and the +6
  only matters on the missile shot the player actually rolls), not auto-enforced.
- **FAQ**: the rule-agent appended **Q008** and **Q009** to `docs/RULES-FAQ.md` during
  research (source citations + step-vs-result and MA-penalty rulings). No further ledger
  work needed in this change.
- **Out of scope**: the existing spell "Aspect of the Fog Ghost" already uses the honest
  `attack-modifier` `{ attack, Damage }` shape for its +3 close-combat Attack/Damage
  (spells.json:1150–1188) — it becomes a *trivial* follow-up once this Phase 3 fold lands
  (retag `measure: "rating" → "step"` + `scope: "close combat"`), but it is **untouched
  here**.

## 7. Acceptance checklist (paste into the PR description)

- [ ] No Tier-1 invariant changed — UI-GUIDELINES rules, data-down/dispatch-up, pure
      DOM-free engine, "store only inputs", schema shapes (ed-spells/1) — or owner signed off
- [ ] Overview still fits the desktop viewport with no vertical scroll
- [ ] Derived values still render placeholder pills, never fabricated numbers
- [ ] Light + dark mode intact; modals still Escape-closes / Enter-confirms (none touched)
- [ ] No taxonomy change (Tier-2) — N/A; `attack-modifier` `{ attack, Damage }` and free-text
      `scope: "missile"` are existing taxonomy vocabulary
- [ ] Active spell folds verified: Shadow Meld (named-ability) and Arrow of Night
      (attack damage-step) both reach their rolls; extra-thread +2 folds; a `rating`-measure
      variant is still dropped by the §6 measure guard
- [ ] Asset/fetch paths remain relative (./…)