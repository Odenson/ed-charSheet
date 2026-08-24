// engine/combat.js — pure, DOM-free assembly of a non-spell combat roll pool.
// Phase B of PLAN-COMBAT-TAB.md.
//
// Given the selected combat-option / situational-effect bundles
// (rules/combat.json), compose the Step a roll is made on, the flat roll-time
// result modifiers, and the declared Strain cost — then resolve hit/miss and
// net damage against an optional target. The engine computes; the view renders;
// nothing computed here is ever persisted (the tab applies only health inputs).
//
// Policy (from the plan, PG p.382-390):
//   - Option/situational modifiers are STEP modifiers (they change the dice
//     Step). Only the Knocked Down penalty is a flat RESULT modifier
//     (engine/health.js KNOCKED_DOWN_EFFECT). The two measures are never
//     conflated (plan B10): measure "step" folds into `step`, measure "result"
//     becomes a flat `resultMod` — the `{ label, value }` shape ed-app's roll
//     modal consumes as `mods`.
//   - test-modifier targets:
//       { test, Attack } → the attack roll (attackPool).
//       { test, Damage } → the damage test (damagePool).
//       { test, Action } → any Action test. The Attack test is an Action test,
//         so Action mods fold into attackPool. The Damage test is an Effect
//         test, so plain Action mods do NOT fold into damagePool — EXCEPT scope
//         "except-knockdown" (Defensive Stance's "−3 to all tests except
//         Knockdown", plan A8/B8), which applies to the Damage test too.
//       scope "sight"  → sight-based Action tests only; attackPool opts out with
//         { sightBased: false } (e.g. a heat-sighted attacker).
//   - resource-modifier on { resource, Strain } sums into `strain` — the
//     attack's declared self-cost, applied to the character (never the target).
//     Only attackPool returns it; damagePool has no strain of its own.
//   - defense-modifiers are NEVER folded into a pool (plan B7) — the tab shows
//     them as informational "derived Defense + toggled mods", and they never
//     touch the always-on derived defense.
//   - note effects fold nothing (display-only riders — Full Cover "unhittable",
//     Surprised, Stun/Knockdown damage subtypes, movement maneuvers).
//   - A null base (missing talent / weapon Damage Step / Strength step) keeps
//     `step` null — the UI shows a placeholder pill, never a fabricated step.
//     Result mods and strain still fold (they are independent of the base).

const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);

import { collapseStacking } from './characteristics.js';

/**
 * Which attack talents/skills can wield a weapon of a given category. Melee →
 * Melee Weapon; missile → Missile Weapon; throwing → Throwing Weapon (owner
 * decision: throwing-only, a thrown weapon is not also offered Melee Weapon);
 * the synthetic Unarmed weapon → Unarmed Combat. A null/unknown category (e.g.
 * the "None" picker entry) returns null — the caller shows the *whole* rollable
 * talent/skill list instead of a filtered one.
 * @param {string|null|undefined} category
 * @returns {string[]|null} allowed talent/skill names, or null for "no filter"
 */
const WEAPON_TALENTS = {
  melee: ['Melee Weapon'],
  missile: ['Missile Weapon'],
  throwing: ['Throwing Weapon'],
  unarmed: ['Unarmed Combat'],
};
export function attackTalentNamesFor(category) {
  if (category == null) return null;
  return WEAPON_TALENTS[category] ?? [];
}

/**
 * Extra attack success levels above the target number — every whole 5 the attack
 * result beats the target is one level (PG success-level rule, owner-confirmed).
 * Clamped at 0 so a miss never subtracts. Each level adds +1 to the Damage step
 * (threaded into `damagePool` as `bonusSteps`).
 * @param {number|null|undefined} result the attack roll's final total (post-mods)
 * @param {number|null|undefined} target the target number to beat
 * @returns {number} success levels ≥ 0 (0 when no usable numbers, or a miss)
 */
export function attackSuccessLevels(result, target) {
  if (!isFiniteNum(result) || !isFiniteNum(target)) return 0;
  return Math.max(0, Math.floor((result - target) / 5));
}

/**
 * Earthdawn success count for a test total vs a Difficulty: meeting it is 1
 * success, and every additional 5 over it is one more (= 1 + attackSuccessLevels
 * on a hit). A miss (or unusable numbers) is 0. Used by Mystic Aim — each success
 * arms +2 steps to the Attack test.
 * @param {number|null|undefined} total the test's final total
 * @param {number|null|undefined} target the Difficulty to meet
 * @returns {number} successes ≥ 0 (0 on a miss)
 */
export function successCount(total, target) {
  if (!isFiniteNum(total) || !isFiniteNum(target)) return 0;
  return total >= target ? 1 + Math.floor((total - target) / 5) : 0;
}

/** The signed value an effect contributes (operation subtract negates). */
const opValue = (e) => (e.operation === 'subtract' ? -(e.value ?? 0) : e.value ?? 0);

/** Does a test-modifier apply to the test kind being assembled?
 *  ctx: { testKind: 'attack' | 'damage', sightBased?: boolean, activeTalent?: string } */
function appliesToTest(e, ctx) {
  const t = e.target;
  if (e.type !== 'test-modifier' || !t || t.domain !== 'test') return false;
  const kind = ctx.testKind;
  if (t.name === 'Attack') return kind === 'attack';
  if (t.name === 'Damage') return kind === 'damage';
  if (t.name === 'Effect') return kind === 'damage';
  if (t.name === 'Action') {
    if (kind === 'attack') {
      if (e.scope === 'sight' && ctx.sightBased === false) return false;
      return true;
    }
    if (kind === 'damage') return e.scope === 'except-knockdown';
  }
  // Named ability (e.g. "Spellcasting") — the engine already records an
  // effect as an effect regardless of tab; the charm's Spellcasting +6 applies
  // only to the attack pool when that talent is the active test. Restrict to
  // `kind === 'attack'` so it never leaks into a damage/effect pool.
  if (ctx.activeTalent && t.name === ctx.activeTalent) return kind === 'attack';
  return false;
}

/**
 * Fold an effect list into a pool. Pure — never mutates its inputs.
 * @param {number|null} baseStep the pre-modifier step (attack talent step, or
 *   Strength step + weapon Damage Step for damage).
 * @param {object[]} effects selected effect bundles (flat, already filtered by
 *   the caller to the bundles the player toggled).
 * @param {{testKind:'attack'|'damage', sightBased?:boolean, activeTalent?:string}} ctx test context.
 * @returns {{step:number|null, resultMods:Array<{label:string,value:number}>,
 *   strain:number}}
 */
function foldPool(baseStep, effects, ctx) {
  let step = isFiniteNum(baseStep) ? baseStep : null;
  const resultMods = [];
  const stepMods = [];
  let strain = 0;
  for (const e of effects ?? []) {
    if (!e || typeof e !== 'object') continue;
    if (e.type === 'note' || e.type === 'defense-modifier') continue;
    if (e.type === 'resource-modifier') {
      if (e.target?.domain === 'resource' && e.target?.name === 'Strain' && isFiniteNum(e.value)) {
        strain += opValue(e);
      }
      continue;
    }
    if (e.type !== 'test-modifier' || !appliesToTest(e, ctx)) continue;
    const v = opValue(e);
    const label = e.label ?? e.summary ?? `${e.target.name} ${e.target.domain}`;
    if (e.measure === 'result') {
      resultMods.push({ label, value: v });
    } else if (e.measure === 'step' && step != null) {
      step += v;
      stepMods.push({ label, value: v });
    }
  }
  return { step, resultMods, strain, stepMods };
}

/**
 * Assemble the attack roll: the talent's step plus the folded step-measure
 * modifiers, any flat result mods, and the declared Strain cost of the selected
 * options.
 * @param {object} args `{ talentStep, effects, opts?, activeTalent? }` — `effects` is the flat
 *   list of effects from the toggled option/situation bundles; `opts.sightBased`
 *   (default true) lets a special sense ignore scope:"sight" penalties.
 *   `activeTalent` names the talent being rolled (e.g. "Spellcasting") so a
 *   named-ability target like `{test, Spellcasting}` applies only there.
 * @returns {{step:number|null, resultMods:Array, strain:number}}
 */
export function attackPool({ talentStep, effects, opts = {}, activeTalent }) {
  const { step, resultMods, strain } = foldPool(talentStep, effects, { testKind: 'attack', sightBased: opts.sightBased !== false, activeTalent });
  return { step, resultMods, strain };
}

/**
 * Assemble the damage roll: Strength step + weapon Damage Step, plus the folded
 * step-measure damage modifiers (Aggressive Attack +3, Defensive Stance −3 via
 * its "except Knockdown" scope) and any flat result mods. No strain.
 * @param {object} args `{ weaponDamageStep, strengthStep, effects, bonusSteps?, activeTalent? }`
 *   `bonusSteps` (default 0) is the extra-success-level damage bonus from the
 *   attack roll (see `attackSuccessLevels`) — added on top of the folded step.
 *   `activeTalent` is forwarded so an `Effect` test-modifier still knows which
 *   talent armed the spell (future-proof; Effect itself is talent-agnostic).
 * @returns {{step:number|null, resultMods:Array}}
 */
export function damagePool({ weaponDamageStep, strengthStep, effects, bonusSteps = 0, activeTalent }) {
  const base = isFiniteNum(weaponDamageStep) && isFiniteNum(strengthStep) ? weaponDamageStep + strengthStep : null;
  const { step, resultMods } = foldPool(base, effects, { testKind: 'damage', activeTalent });
  // Success-level bonus rides on the base step, never fabricates one (null stays
  // null → placeholder pill).
  const withBonus = step != null && isFiniteNum(bonusSteps) && bonusSteps > 0 ? step + bonusSteps : step;
  return { step: withBonus, resultMods };
}

/**
 * An itemised breakdown of how a pool's Step is composed, for the Combat tab's
 * step-audit modal. Pure — the same fold `attackPool`/`damagePool` run, exposed
 * as parts instead of a single number, so the view never re-derives game values.
 *
 * `baseParts` are the structural bases (attack: the talent step; damage: the
 * Strength step + weapon Damage Step) as `{ label, value }`; their sum is the
 * fold's base. `effects` is the same flat list the pools fold. `bonusSteps`
 * (damage only) adds the attack success-level bonus as its own part.
 *
 * @param {Array<{label:string, value:number|null}>} baseParts
 * @param {object[]} effects
 * @param {{testKind:'attack'|'damage', sightBased?:boolean}} ctx
 * @param {number} [bonusSteps]
 * @returns {{step:number|null, parts:Array<{label:string, value:number, kind:'base'|'step'|'result'}>}}
 *   `parts` in fold order; `base`+`step` parts compose the Step, `result` parts
 *   are flat modifiers applied to the roll's total (not the Step).
 */
export function auditPool(baseParts = [], effects = [], ctx = {}, bonusSteps = 0, extraMods = []) {
  const baseSum = baseParts.reduce((s, p) => s + (isFiniteNum(p.value) ? p.value : 0), 0);
  const hasBase = baseParts.some((p) => isFiniteNum(p.value));
  const { step, resultMods, stepMods } = foldPool(hasBase ? baseSum : null, effects, ctx);
  // `extraMods` are pre-resolved test-modifiers already folded onto the ability
  // itself (a sustained spell's +N step, a thread bonus) — measure-tagged rollMods,
  // NOT part of the combat-option effect list. The base above is the pre-modifier
  // step (from `stepBase`), so we re-add the step-measure ones here and itemise
  // both step and result kinds so the audit sums back to the ability's real step.
  const extraStep = [];
  const extraResult = [];
  for (const m of extraMods ?? []) {
    const val = Number(m.value) || 0;
    if (!val) continue;
    const part = { label: m.source ?? m.label ?? 'Active effect', value: val };
    if ((m.measure ?? 'result') === 'step') extraStep.push(part);
    else extraResult.push(part);
  }
  const extraStepSum = extraStep.reduce((s, p) => s + p.value, 0);
  const composed = step != null ? step + extraStepSum : step;
  const withBonus = composed != null && isFiniteNum(bonusSteps) && bonusSteps > 0 ? composed + bonusSteps : composed;
  const parts = [
    ...baseParts.map((p) => ({ label: p.label, value: p.value, kind: 'base' })),
    ...stepMods.map((m) => ({ ...m, kind: 'step' })),
    ...extraStep.map((p) => ({ ...p, kind: 'step' })),
  ];
  if (isFiniteNum(bonusSteps) && bonusSteps > 0) parts.push({ label: 'Attack success levels', value: bonusSteps, kind: 'step' });
  for (const m of resultMods) parts.push({ ...m, kind: 'result' });
  for (const p of extraResult) parts.push({ ...p, kind: 'result' });
  return { step: withBonus, parts };
}

/**
 * The selected weapon's own always-on woven effects (thread-rank test
 * modifiers, e.g. Orc Stinger rank 4's "+2 to Attack tests"). The rank weave is
 * collapsed per-target exactly like the static fold (`stacking` from
 * engine/characteristics.js — `replace` means a later rank supersedes an
 * earlier one, never sums: rank 4's +2 replaces rank 2's +1). Only the effect
 * types a pool reads (test-modifier / resource-modifier) are folded in here:
 * the weapon's `attack-modifier` Damage step already rides `weaponDamageStep`,
 * and its defense/armor mods are already in the derived ratings — neither may
 * enter the pool a second time.
 */
function weaponPoolEffects(effects, name) {
  const byTarget = new Map();
  for (const e of effects ?? []) {
    if (!e || typeof e !== 'object') continue;
    if (e.type !== 'test-modifier' && e.type !== 'resource-modifier') continue;
    if ((e.condition ?? 'always') !== 'always' || e.gmDiscretion) continue;
    const t = e.target ?? {};
    const key = `${e.type}|${t.domain}|${t.name}|${e.measure ?? ''}|${e.scope ?? ''}`;
    if (!byTarget.has(key)) byTarget.set(key, []);
    byTarget.get(key).push(e);
  }
  const collapsed = [];
  for (const [key, group] of byTarget) {
    const tagged = group.map((e) => ({ ...e, origin: { kind: 'thread', name: `${name}#${key}` } }));
    for (const e of collapseStacking(tagged)) collapsed.push(e);
  }
  return collapsed;
}

/**
 * Build the effect lists the Combat tab feeds to `attackPool` / `damagePool`
 * from the player's selections, applying the **asymmetric locked-condition
 * strip** (PLAN-COMBAT-TAB B11). The view never computes these selections
 * itself; this keeps the policy pure and testable against the real rules.
 *
 * Strip rules (B11 — the two live conditions are already folded into the sheet,
 * so feeding them again would double-count, and the strip is different for each):
 *   - **Knocked Down** — stripped *entirely* (pool AND display): its Action
 *     result-mod already rides `ed-app`'s `_rollTimeMods` (every roll), and its
 *     defence mod is already in the derived defence.
 *   - **Harried** — stripped of only its **defence** mods (already folded into
 *     derived defence); its **Action −2** stays in the pool — the Combat tab is
 *     the first place it reaches a roll, so dropping it would under-count.
 *   Player-toggled situations/options are *not* folded anywhere else, so their
 *   defence mods ARE returned (informational display only — they never touch the
 *   derived defence, B7).
 *
 * The **selected weapon's own woven effects** (`selectedWeaponEffects`) fold as
 * an always-on source (thread-rank test modifiers, e.g. +Attack from the Orc
 * Stinger's ranks) — collapsed per target so the weave's `replace` stacking is
 * honored, and restricted to pool-read types (see `weaponPoolEffects`).
 *
 * @param {object} args
 * @param {string[]} args.selectedOptions  toggled combat-option bundle names
 * @param {string[]} args.selectedSituations  toggled situation bundle names
 *   (player-added only — locked Knocked Down/Harried come from `conditions`)
 * @param {Array<{name:string, effects:object[]}>} args.selectedCharms  toggled
 *   equipped blood-charm items (their activatable effects)
 * @param {object[]} [args.selectedWeaponEffects]  the selected weapon's woven
 *   effects (from its `equippedWeapons` entry)
 * @param {Object<string,number>|string[]} [args.armedOptions]  a map
 *   `{ optionName: successCount }` of options whose precursor roll succeeded
 *   (Mystic Aim hit); a `perSuccess` on-success effect scales by the count. A
 *   plain name array is accepted and treated as count 1.
 * @param {{options:object[], situations:object[]}} args.rules  rules/combat.json
 * @param {{knockedDown?:boolean, harried?:boolean}} args.conditions
 *   model.combat.conditions
 * @returns {{attackEffects:object[], damageEffects:object[], defenseMods:Array<{source:string, name:string, value:number}>, armorMods:Array<{source:string, name:string, value:number}>}}
 *   `attackEffects`/`damageEffects` feed `attackPool`/`damagePool` (a single
 *   effect list is fine for both — each pool's `appliesToTest` picks its own
 *   targets); `defenseMods`/`armorMods` are the toggled session modifiers the
 *   Defence & Armour block folds into the sheet's derived ratings for display
 *   (never dispatched into the derived defence — see `foldCombatRatings`).
 */
export function collectCombatEffects({ selectedOptions = [], selectedSituations = [], selectedCharms = [], selectedWeaponEffects = [], armedOptions = [], rules, conditions = {} }) {
  const optList = rules?.options ?? [];
  const sitList = rules?.situations ?? [];
  const attackEffects = [];
  const damageEffects = [];
  const defenseMods = [];
  const armorMods = [];

  for (const e of weaponPoolEffects(selectedWeaponEffects, 'weapon')) {
    attackEffects.push(e);
    damageEffects.push(e);
  }

    // How many successes armed this option: `armedOptions` is a map
    // `{ optionName: successCount }` (a legacy name-array counts as 1). 0/absent =
    // not armed.
  const armedCountFor = (name) => (Array.isArray(armedOptions) ? (armedOptions.includes(name) ? 1 : 0) : Number(armedOptions?.[name]) || 0);
  const addBundle = (bundle, source) => {
    for (let e of bundle?.effects ?? []) {
      if (!e || typeof e !== 'object') continue;
      // An `on-success` effect (e.g. Mystic Aim's +2 to the Attack test) folds
      // only when its option has been ARMED by a successful precursor roll. A
      // `perSuccess` effect scales by the success count (2 successes → +4 steps):
      // bake the scaled value into a copy and drop `perSuccess`, so the pool folds
      // it as a flat modifier. Toggling the option alone is not enough.
      if (e.condition === 'on-success') {
        const count = armedCountFor(source);
        if (count < 1) continue;
        if (e.perSuccess) e = { ...e, value: (e.value ?? 0) * count, perSuccess: false };
      }
      if (e.type === 'defense-modifier') {
        defenseMods.push({ source, name: e.target?.name ?? 'Defence', value: opValue(e) });
        continue;
      }
      if (e.type === 'armor-modifier') {
        armorMods.push({ source, name: e.target?.name ?? 'Armour', value: opValue(e) });
        continue;
      }
      attackEffects.push(e);
      damageEffects.push(e);
    }
  };

  for (const name of selectedOptions) addBundle(optList.find((o) => o.name === name), name);
  for (const name of selectedSituations) addBundle(sitList.find((o) => o.name === name), name);
  for (const charm of selectedCharms ?? []) addBundle(charm, charm?.name ?? 'Blood charm');

  if (conditions.harried) {
    const harriedBundle = sitList.find((o) => o.name === 'Harried');
    if (harriedBundle) {
      for (const e of harriedBundle.effects ?? []) {
        if (e?.type === 'defense-modifier') continue; // already folded into derived defence
        attackEffects.push(e);
        damageEffects.push(e);
      }
    }
  }
  // Knocked Down is deliberately absent: its −3 result-mod rides `_rollTimeMods`
  // and its defence mod is already folded — never fed here.

  return { attackEffects, damageEffects, defenseMods, armorMods };
}

/**
 * Fold the toggled session modifiers (defenseMods + armorMods) into the sheet's
 * derived ratings to produce a **live** combat figure for display — mirroring how
 * the Overview folds condition mods into a rating. Pure and derived-only: the
 * sheet's stored `characteristics.*.value` (which already include locked
 * conditions and equipped armour) is taken as the base; the mods ride on top.
 * The result is rendered by the view; it is never dispatched back into the
 * derived defence (B7 — toggled modifiers stay informational).
 *
 * Every rating object is `{ base, mods, delta, value }`:
 *   - `value === null` when the sheet has no derived rating → the view's
 *     placeholder-pill rule applies.
 *   - `mods` is the list of the toggled mods that affect that rating.
 *   - `delta` is `sum(mods.value)`; `value` is `base + delta`.
 *
 * @param {object} derived `{ physicalDefense, mysticDefense, socialDefense, physicalArmor, mysticArmor }`
 *   plain numbers from the sheet (or null when the sheet has no such rating).
 * @param {Array<{source:string, name:string, value:number}>} defenseMods
 *   `collectCombatEffects().defenseMods` — toggled Defence modifiers.
 * @param {Array<{source:string, name:string, value:number}>} armorMods
 *   `collectCombatEffects().armorMods` — toggled Armour modifiers.
 * @returns {{defence:object, armour:object}} keyed by rating name
 *   (`defence.Physical`, `defence.Mystic`, `defence.Social`,
 *   `armour.Physical`, `armour.Mystic`).
 */
export function foldCombatRatings(derived = {}, defenseMods = [], armorMods = []) {
  const fold = (key, name, mods) => {
    const base = isFiniteNum(derived[key]) ? Number(derived[key]) : null;
    const list = (mods ?? []).filter((m) => m?.name === name);
    const delta = list.reduce((s, m) => s + (isFiniteNum(m?.value) ? Number(m.value) : 0), 0);
    return { base, mods: list, delta, value: base == null ? null : base + delta };
  };
  return {
    defence: {
      Physical: fold('physicalDefense', 'Physical', defenseMods),
      Mystic: fold('mysticDefense', 'Mystic', defenseMods),
      Social: fold('socialDefense', 'Social', defenseMods),
    },
    armour: {
      Physical: fold('physicalArmor', 'Physical', armorMods),
      Mystic: fold('mysticArmor', 'Mystic', armorMods),
    },
  };
}

/**
 * Resolve an attack roll against the optional target number.
 * @param {number|null|undefined} result the roll's total
 * @param {number|null|undefined} targetNumber the number to beat (empty → roll-only)
 * @returns {'hit'|'miss'|null} null when there is no target (or no usable roll)
 */
export function resolveAttack(result, targetNumber) {
  if (targetNumber == null) return null;
  if (!isFiniteNum(result) || !isFiniteNum(targetNumber)) return null;
  return result >= targetNumber ? 'hit' : 'miss';
}

/**
 * Net damage after armor: result − armor, floored at 0 (a hit that doesn't
 * clear the armor rating deals no damage). Missing armor → the raw result.
 * @param {number|null|undefined} result the damage roll's total
 * @param {number|null|undefined} armor the target's armor rating
 * @returns {number|null} null when there is no usable roll result
 */
export function netDamage(result, armor) {
  if (!isFiniteNum(result)) return null;
  const a = isFiniteNum(armor) ? armor : 0;
  return Math.max(0, result - a);
}
