# Bug Report: Desperate Spell Blood Charm (and Similar Blood Charms)

## Summary

The **Desperate Spell** blood charm (and potentially other blood charms targeting `Spellcasting` or `Effect` tests) has two related bugs:

1. **Discipline Tab Display Bug**: Shows a misleading +6 badge on the Spellcasting talent when the charm is equipped, but the charm's bonus is situational (combat-activated) and should not appear as an always-on modifier.
2. **Combat Tab Activation Bug**: When the charm is toggled on in the Combat tab's Blood Charms section, the +6 bonus is not applied to Spellcasting or Effect tests.

---

## Root Cause Analysis

### Bug 1: Discipline Tab Shows Incorrect Badge

**Location**: `store.js` — `abilityTestMods` function (lines ~1343-1362)

**Problem**: The `abilityTestMods` function collects ALL test-modifier effects targeting a talent name, including `condition: "situational"` effects. It does not filter by `condition`.

The Desperate Spell blood charm has these effects:
```json
{
  "type": "test-modifier",
  "target": { "domain": "test", "name": "Spellcasting" },
  "operation": "add",
  "value": 6,
  "measure": "result",
  "condition": "situational",
  "scope": "on activation; chosen by the character",
  "source": "item",
  "summary": "+6 to a Spellcasting test on activation."
},
{
  "type": "test-modifier",
  "target": { "domain": "test", "name": "Effect" },
  "operation": "add",
  "value": 6,
  "measure": "result",
  "condition": "situational",
  "scope": "on activation; chosen by the character",
  "source": "item",
  "summary": "+6 to a spell Effect test on activation."
}
```

These are incorrectly picked up by `applyTestMods` and displayed as `rollMods` on the Spellcasting talent in the Discipline tab, making it appear the charm is always active.

**Expected**: Only `condition: "always"` effects (thread item bonuses, sustained spells, racial abilities) should appear on talents in the Discipline tab. Situational/combat-activated effects should only appear when toggled in the Combat tab.

---

### Bug 2: Combat Tab Activation Doesn't Apply Bonus

**Location**: `engine/combat.js` — `appliesToTest` function (lines ~97-111)

**Problem**: The `appliesToTest` function only recognizes these test targets:
- `Attack` → attack pool
- `Damage` → damage pool
- `Action` → both pools (with scope exceptions)

It does **NOT** handle:
- Named abilities like `"Spellcasting"` (a talent in the `test` domain)
- `"Effect"` (a valid test category per the effect taxonomy)

When the blood charm is toggled on in combat, `collectCombatEffects` passes its effects to `attackPool`/`damagePool`, but `appliesToTest` returns `false` for `Spellcasting`/`Effect` targets, so the +6 bonus is dropped.

**Expected**: 
- `Spellcasting` target should apply when Spellcasting talent is the active attack talent
- `Effect` target should apply to the damage pool (spell effect tests use the damage pool)

---

## Affected Blood Charms

All blood charms with `test-modifier` effects targeting named abilities or `Effect`:

| Blood Charm | Target Test | Effect |
|-------------|-------------|--------|
| Desperate Spell | Spellcasting, Effect | +6 to Spellcasting/Effect test on activation |
| Desperate Blow | Attack, Damage | +6 to Attack/Damage test on activation |
| (Others with similar patterns) | | |

---

## Effect Taxonomy Reference

Per `docs/EFFECT-TAXONOMY.md` §3, valid `test` domain names include:
- `Action`, `Attack`, `Damage`, `Effect`, `Initiative`
- **Named abilities** (talent/skill names like `Spellcasting`)

The taxonomy explicitly supports targeting named abilities via `test` domain.

---

## Proposed Fixes

### Fix 1: `store.js` — Filter situational effects from discipline tab

In `abilityTestMods` function, add `autoApplies(e)` filter:

```javascript
const hits = activeEffects.filter(
  (e) =>
    e.type === 'test-modifier' &&
    e.target?.name === name &&
    (e.target?.domain === 'test' || e.target?.domain === 'ability') &&
    (e.operation === 'add' || e.operation === 'subtract') &&
    autoApplies(e),  // Only always-on, non-GM-discretion effects
);
```

`autoApplies` is **not** currently imported in `store.js` (current imports at `store.js:13-34` pull `makeCharacteristics`, `defense`, etc. but not `autoApplies`). Add it:
```js
import { autoApplies } from './engine/characteristics.js';
```
It checks:
- `condition === 'always'`
- `gmDiscretion !== true`

---

### Fix 2: `engine/combat.js` — Extend `appliesToTest` and pool signatures

#### A. Update `appliesToTest` to recognize named abilities and Effect:

```javascript
function appliesToTest(e, ctx) {
  const t = e.target;
  if (e.type !== 'test-modifier' || !t || t.domain !== 'test') return false;
  const kind = ctx.testKind;
  
  if (t.name === 'Attack') return kind === 'attack';
  if (t.name === 'Damage') return kind === 'damage';
  if (t.name === 'Effect') return kind === 'damage';  // Spell effect tests → damage pool (combat-tab damage)
  if (t.name === 'Action') {
    if (kind === 'attack') {
      if (e.scope === 'sight' && ctx.sightBased === false) return false;
      return true;
    }
    if (kind === 'damage') return e.scope === 'except-knockdown';
  }
  // Named ability (e.g., "Spellcasting") — apply only to the attack pool when that talent is the active test.
  // Restricting to `kind === 'attack'` prevents a Spellcasting bonus leaking into a damage/effect pool.
  if (ctx.activeTalent === t.name && kind === 'attack') return true;
  
  return false;
}
```

> **Note on scope:** The mapping `Effect → damage` only fixes the Combat tab's damage/Effect path. Spell Effect steps rolled from the **Spells tab** (`ui/ed-spells.js:_doEffect` → `_dispatchRoll`, `engine/spells.js:effectReadout`) do **not** go through `engine/combat.js` at all — they use `plan.castingStep` / `plan.effect.step` + `effectStepBonus`. A combat-tab blood-charm activation (`_charmsOn` in `ed-combat` SCRATCH) will not reach a Spells-tab roll unless the Spells tab is also wired to read that scratch (or a shared `activeBloodCharms` session set). If the intent is for Desperate Spell's Effect +6 to work from the Spells tab too, that needs a second, Spells-tab plumbing step. For the reported bug (Combat-tab activation not applying), the `Effect → damage` fix is sufficient.

#### B. Add `activeTalent` to pool function signatures:

```javascript
// attackPool
export function attackPool({ talentStep, effects, opts = {}, activeTalent }) {
  const { step, resultMods, strain } = foldPool(talentStep, effects, { testKind: 'attack', sightBased: opts.sightBased !== false, activeTalent });
  return { step, resultMods, strain };
}

// damagePool
export function damagePool({ weaponDamageStep, strengthStep, effects, bonusSteps = 0, activeTalent }) {
  const base = isFiniteNum(weaponDamageStep) && isFiniteNum(strengthStep) ? weaponDamageStep + strengthStep : null;
  const { step, resultMods } = foldPool(base, effects, { testKind: 'damage', activeTalent });
  // ... rest unchanged
}

// foldPool — pass ctx through to appliesToTest
function foldPool(baseStep, effects, ctx) { ... }

// auditPool — same ctx shape (it currently takes `ctx = {}` and forwards to foldPool), so the
// detail modal / step audit also needs to receive activeTalent when called from ed-combat:
export function auditPool(baseParts, effects, ctx = {}, bonusSteps = 0, extraMods = []) {
  const { step, resultMods, stepMods } = foldPool(hasBase ? baseSum : null, effects, ctx); // ctx now includes activeTalent
  // ...
}
```

---

### Fix 3: `ui/ed-combat.js` — Pass active talent to pools

```javascript
_attackPool() {
  const t = this._selTalent();
  const { attackEffects } = this._poolEffects();
  const ap = attackPool({ talentStep: t?.step ?? null, effects: attackEffects, activeTalent: t?.name });
  // ...
}

_damagePool() {
  const w = this._selWeapon();
  const { damageEffects } = this._poolEffects();
  const t = this._selTalent();
  return damagePool({
    weaponDamageStep: w.damageStep ?? null,
    strengthStep: this.model?.combat?.strengthStep ?? null,
    effects: damageEffects,
    bonusSteps: this._damageBonus(),
    activeTalent: t?.name,
  });
}
```

---

## Files to Modify

| File | Functions | Lines (actual) |
|------|-----------|----------------|
| `store.js` | `abilityTestMods` | `store.js:1358-1365` + import block `store.js:13-34` |
| `engine/combat.js` | `appliesToTest`, `attackPool`, `damagePool`, `foldPool`, `auditPool` | `engine/combat.js:97-111`, `159-162`, `173-180`, `123-148`, `200-230` |
| `ui/ed-combat.js` | `_attackPool`, `_damagePool`, (`_auditPool` if used) | `ui/ed-combat.js:640-649`, `676-684` |

> **File note:** This doc lives at `docs/BUG-DESPERATE-SPELL-BLOOD-CHARM.md`. The name `BUG-DESPERATE-BLOOD-CHARM` without `-SPELL-` does not exist; use the `-SPELL-` name when opening.

---

## Test Cases to Add

### Engine Tests (`engine/combat.test.js`)

```javascript
test('collectCombatEffects: blood charm targeting Spellcasting applies when Spellcasting is active talent', () => {
  const charm = {
    name: 'Desperate Spell',
    effects: [
      { type: 'test-modifier', target: { domain: 'test', name: 'Spellcasting' }, operation: 'add', value: 6, measure: 'result', condition: 'situational', source: 'item', summary: '+6 to Spellcasting.' },
    ],
  };
  const r = collectCombatEffects({ 
    selectedOptions: [], 
    selectedSituations: [], 
    selectedCharms: [charm], 
    rules: RULES, 
    conditions: {} 
  });
  // When Spellcasting is the active talent, the effect should apply to attack pool
  const ap = attackPool({ talentStep: TALENT, effects: r.attackEffects, activeTalent: 'Spellcasting' });
  assert.deepEqual(ap.resultMods, [{ label: '+6 to Spellcasting.', value: 6 }]);
});

test('collectCombatEffects: blood charm targeting Effect applies to damage pool', () => {
  const charm = {
    name: 'Desperate Spell',
    effects: [
      { type: 'test-modifier', target: { domain: 'test', name: 'Effect' }, operation: 'add', value: 6, measure: 'result', condition: 'situational', source: 'item', summary: '+6 to Effect.' },
    ],
  };
  const r = collectCombatEffects({ 
    selectedOptions: [], 
    selectedSituations: [], 
    selectedCharms: [charm], 
    rules: RULES, 
    conditions: {} 
  });
  const dp = damagePool({ weaponDamageStep: 5, strengthStep: 6, effects: r.damageEffects, activeTalent: 'Spellcasting' });
  assert.deepEqual(dp.resultMods, [{ label: '+6 to Effect.', value: 6 }]);
});
```

### Store Tests (`store-combat.test.js`)

```javascript
test('abilityTestMods: situational blood charm effects do not appear on talent rollMods', () => {
  // Setup character with Desperate Spell equipped
  // Verify Spellcasting talent rollMods does NOT include the +6 situational effect
});
```

---

## What Is Already Correct (no fix needed)

The two `characteristic-modifier` implant effects on Desperate Spell are correct and already work:
```json
{ "type":"characteristic-modifier", "target":{"domain":"characteristic","name":"UnconsciousnessRating"}, "operation":"subtract", "value":3, "measure":"rating", "condition":"always" }
{ "type":"characteristic-modifier", "target":{"domain":"characteristic","name":"DeathRating"}, "operation":"subtract", "value":3, "measure":"rating", "condition":"always" }
```
These are collected via `store.js:871-883` (`items.filter(it=>it.equipped)`) and folded by `engine/characteristics.js:unconsciousnessRating`/`deathRating` through `autoApplies`. Equipping the charm correctly lowers Death/Unconsciousness. The bug is only about the two `test-modifier` situational effects.

## Tier Classification

Per `CLAUDE.md`:
- **Tier 3** — Bug fixes restoring documented behavior
- No schema/taxonomy changes required
- Effect taxonomy already supports these target names (`docs/EFFECT-TAXONOMY.md:147` — `test` domain includes `Effect` + named abilities)

---

## Review Findings (2026-08-23)

**Verdict: Root-cause analysis is correct; fixes as written in the first draft would address the reported symptoms but needed 4 refinements (applied above).**

| # | Doc claim | Verification | Status |
|---|-----------|--------------|--------|
| 1 | Bug 1: `store.js:abilityTestMods` lacks `condition` filter → discipline badge shows situational +6 | Verified at `store.js:1358-1365` — no `autoApplies`/`condition` check; Desperate Spell effects in `rules/items.json:2836-2864` are `measure:result, condition:situational`; `applyTestMods` creates `rollMods` with that badge but `stepBonus` unchanged → visual matches report | **Correct** |
| 2 | Fix 1: add `autoApplies(e)` | Correct, but doc said "already imported" — actually **not** imported at `store.js:13-34`; needs new import | **Fixed** |
| 3 | Bug 2: `engine/combat.js:appliesToTest` misses `Spellcasting`/`Effect` | Verified at `engine/combat.js:97-111` — only `Attack`/`Damage`/`Action` | **Correct** |
| 4 | Fix 2: add `Spellcasting` via `ctx.activeTalent` + `Effect → damage` | Correct direction, but first draft made named-ability match both pools. Refined to `kind === 'attack'` only, otherwise Spellcasting +6 would leak into damage. Also `auditPool` needs same `ctx`. Applied | **Refined** |
| 5 | Spells-tab `Effect` | Doc's `Effect → damage` only fixes Combat tab. Spells tab Effect (`ui/ed-spells.js:953-962`, `engine/spells.js:157-174`) bypasses `engine/combat.js` entirely, so a combat-activated charm won't reach a Spells-tab roll without extra plumbing. Called out inline | **Gap documented** |
| 6 | Tier 3 | No taxonomy/schema shape change, fits existing `test` domain vocab | **Correct** |

**Overall:** After the 4 refinements above, the doc's fixes will resolve the two reported behaviors:
- Equipping will no longer show a misleading +6 pill on the Discipline tab.
- Toggling the charm on in Combat with Spellcasting selected will apply the +6 as a `resultMod` (the Combat-tab attack; `Effect → damage` covers combat damage/Effect rolls). For `Effect` tests initiated from the Spells tab, a follow-up is needed to share combat `SCRATCH` state with the Spells tab or duplicate the `appliesToTest` logic there.

## Risk Assessment

**Low risk** — Changes are backward-compatible:
- `autoApplies` filter only *removes* effects from display (safer)
- `activeTalent` context is optional (undefined = no named-ability match)
- `Effect` target only adds new behavior, doesn't change existing
- No changes to data files or schemas

---

## Verification Steps

1. Equip Desperate Spell blood charm
2. Check Discipline tab — Spellcasting talent should NOT show +6 badge
3. Go to Combat tab, select Spellcasting as attack talent
4. Toggle Desperate Spell on in Blood Charms section
5. Roll attack — should show +6 result modifier
6. For spell casting, verify Effect test also gets +6 when charm is activated

---

## Implementation (2026-08-24) — Unified engine, no tab boundary

Per owner decision: **an effect is an effect regardless of dimension** (item/spell/
condition) and **regardless of tab**. The engine records it; the view never does.
Blood-charms are the one gated class: `equipped` gives its `condition: "always"`
implant (`characteristic-modifier` Death/Unconsciousness −3) via the normal always
fold; its `condition: "situational"` `test-modifier` (`+6 Spellcasting` / `+6
Effect`) folds **only while the charm is in `session.activeCharms`** (global,
session-only, like `activeSpells`). `store.js:abilityTestMods` now gates
situational test-mods behind `autoApplies(e) || activeCharmSet.has(origin.name)`,
so the Disciplines `+6` badge appears only while armed; `engine/combat.js`
`appliesToTest` maps `Effect → damage` and named-ability via
`ctx.activeTalent` (`Spellcasting` → attack pool only); `ed-app` holds
`_activeCharms`, toggled via `ed-toggle-charm` (Combat chips dispatch there),
spent (cleared + `equipped:false` persisted) on any `Initiative` roll
(`_advanceRound`) and on New-Day finalize; `ed-combat` reads
`model.activeCharms` (union with legacy `_charmsOn` + deduped merge) and
`ed-spells` reads the same global for `Cast` (talent `resultMods`) and `Effect`
(`activeEffects` filtered to `activeCharms`). No taxonomy/schema change — Tier 3.

## Related Documentation

- `docs/EFFECT-TAXONOMY.md` — Effect vocabulary (v4)
- `docs/UI-GUIDELINES.md` — Derived values render as placeholder pills
- `ARCHITECTURE.md` §5.5 — Engine reads rule data as structured taxonomy
- `PLAN-COMBAT-TAB.md` — Combat tab blood charm mechanics