// engine/roll-mods.js — pure, DOM-free roll-time modifier assembly
// (plans/situational-chips-global). The app layer (ui/ed-app.js) feeds the live
// conditions in and gets back the modifiers to apply to a roll; the roll modal
// re-resolves the Step through `resolveOptionalMods` when a per-roll toggle flips.
//
// A mod is `{ label, value, measure }` with measure 'step' (a Step modifier,
// applied before the dice lookup, min Step 1) or 'result' (a flat total modifier).

import { situationRollMods, UNSCOPED_EXEMPT_KINDS } from './combat.js';
import { KNOCKED_DOWN_EFFECT } from './health.js';

/**
 * The roll-time modifiers a roll takes from live conditions.
 * - Knocked Down (session flag): result -3 on every roll except the exempt kinds.
 * - Unscoped situation mods (Harried chip or encumbrance Harried): every roll
 *   except the exempt kinds (the Karma die).
 * - Scoped situation mods (sight / ranged / movement): offered as optional,
 *   pre-ticked per-roll toggles. Not offered on a Combat pool attack/damage roll
 *   (`pool`; the pool already applies them) or an exempt kind; a `damage`-kind
 *   roll elsewhere is offered only the `ranged` scope.
 * @param {{kind?:string, pool?:boolean, knockedDown?:boolean, harried?:boolean,
 *   situations?:string[], rules:{combat:{situations:object[]}}}} args
 * @returns {{applied:Array<{label:string,value:number,measure:string}>,
 *   optional:Array<{label:string,value:number,measure:string,scope:string,optional:true,on:true}>}}
 */
export function rollTimeMods({ kind, pool = false, knockedDown = false, harried = false, situations = [], rules } = {}) {
  if (UNSCOPED_EXEMPT_KINDS.includes(kind)) return { applied: [], optional: [] };
  const applied = [];
  if (knockedDown) applied.push({ label: 'Knocked Down', value: KNOCKED_DOWN_EFFECT.value, measure: KNOCKED_DOWN_EFFECT.measure ?? 'result' });
  const names = [...new Set([...(situations ?? []), ...(harried ? ['Harried'] : [])])];
  const { unscoped, scoped } = situationRollMods(names, rules);
  applied.push(...unscoped);
  const optional = pool
    ? []
    : scoped
        .filter((m) => kind !== 'damage' || m.scope === 'ranged')
        .map((m) => ({ ...m, optional: true, on: true }));
  return { applied, optional };
}

/**
 * Resolve a roll's Step and flat total from its applied mods.
 * @param {{baseStep:number, mods:Array<{value:number,measure?:string}>,
 *   stepByNumber:Object<string|number,object>}} args
 * @returns {{step:number, stepRow:object|null, stepMods:object[], resultMods:object[], resultTotal:number}}
 */
export function resolveOptionalMods({ baseStep, mods = [], stepByNumber = {} } = {}) {
  const stepMods = mods.filter((m) => m.measure === 'step');
  const resultMods = mods.filter((m) => m.measure !== 'step');
  const sum = (list) => list.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const step = Math.max(1, baseStep + sum(stepMods));
  return { step, stepRow: stepByNumber?.[step] ?? null, stepMods, resultMods, resultTotal: sum(resultMods) };
}
