// engine/ability-ranks.js — pure, DOM-free folding of `grant-ability` effects
// (docs/EFFECT-TAXONOMY.md §2 / §5 `measure: "rank"`) into the derived
// talent/skill step. See plans/PLAN-RANK-GRANTS.md.
//
// Two operations, decided by `operation`:
//   • `set`   → *possession*: `set: 0` makes the ability available, unranked
//               access (races' Versatility / Astral Sight, the Astral Sight
//               gift); `set: N>0` grants it at rank N. Never an adder on a
//               learned rank.
//   • `add` / `subtract` → *rank bonus* on a **possessed** ability (learned or
//               `set`-granted): `effectiveRank = possessedRank + bonus`, which
//               the store folds into the ability's step.
//
// Only effects satisfying the taxonomy auto-apply contract fold — `condition:
// "always"`, not `gmDiscretion`. Situational / triggered / GM-discretionary
// grants surface elsewhere and are never silently baked into a static value.
//
// The collapse is per *fold target* (exact ability name), never across
// abilities, while each effect keeps its own `origin` so a `replace`/`highest`
// progression still collapses *within its own source* and two *different*
// sources can both apply (`replace` is per progression, not per ability —
// plans/PLAN-RANK-GRANTS.md D3). Raw `collapseStacking` over the mixed list
// would collapse a `replace` progression to its last effect and drop the rest
// (e.g. Espagra Boots' rank3 Avoid Blow lost to rank4 Stealthy Stride).
import { autoApplies, collapseStacking } from './characteristics.js';

// Group by exact fold target (type | target domain/name | measure | scope),
// then collapse each group with each effect's OWN `origin` intact — so a
// progression's `replace`/`highest` collapses per source and separate sources
// on the same ability all survive. Unlike `collapseByTarget` (which re-keys
// every member onto one fabricated progression for a single weave's
// currently-in-force survivors), this keeps cross-source stacking real.
function collapsePerTarget(effects) {
  const byTarget = new Map();
  for (const e of effects) {
    const t = e.target ?? {};
    const key = `${e.type}|${t.domain ?? ''}|${t.name ?? ''}|${e.measure ?? ''}|${e.scope ?? ''}`;
    if (!byTarget.has(key)) byTarget.set(key, []);
    byTarget.get(key).push(e);
  }
  const out = [];
  for (const [, group] of byTarget) out.push(...collapseStacking(group));
  return out;
}

/**
 * Fold auto-applying `grant-ability` rank effects into possession + bonus maps.
 *
 * @param {Array<object>} effects  active effects (race / discipline / equipped
 *   items / homebrew), each tagged with its `origin`
 * @returns {{possessed: Object<string, {setValue:number, sources:Array<object>}>,
 *            bonuses: Object<string, {bonus:number, sources:Array<object>}>}}
 *   `possessed` — one entry per `set`-granted ability (a later `set` in effect
 *   order overrides an earlier one, mirroring `applyModifiers` pass-1).
 *   `bonuses` — one entry per ability whose `add`/`subtract` grants net to a
 *   non-zero rank change, its collapsed numeric total and every surviving
 *   source (a zero total is no grant and is dropped).
 */
export function foldAbilityGrants(effects = []) {
  const isRankGrant = (e) =>
    e &&
    typeof e === 'object' &&
    e.type === 'grant-ability' &&
    e.measure === 'rank' &&
    autoApplies(e);
  const grants = (effects ?? []).filter(isRankGrant);
  // `set` and `add`/`subtract` are separate fold dimensions, collapsed
  // independently so a mixed set+add target never inherits the other's stacking.
  const setSurvivors = collapsePerTarget(grants.filter((e) => e.operation === 'set'));
  const bonusSurvivors = collapsePerTarget(grants.filter((e) => e.operation === 'add' || e.operation === 'subtract'));

  const toSource = (e) => ({
    value: e.value,
    operation: e.operation,
    source: e.source ?? null,
    origin: e.origin ?? null,
    summary: e.summary ?? null,
  });

  const possessed = {};
  for (const e of setSurvivors) {
    const name = e.target?.name;
    if (!name) continue;
    // Last `set` in effect order wins (applyModifiers pass-1) — possession is a
    // single { ability → disposition } map, so a row never double-appears.
    possessed[name] = { setValue: e.value, sources: [toSource(e)] };
  }

  const bonuses = {};
  for (const e of bonusSurvivors) {
    const name = e.target?.name;
    if (!name || typeof e.value !== 'number') continue;
    const entry = (bonuses[name] ??= { bonus: 0, sources: [] });
    entry.bonus += e.operation === 'subtract' ? -e.value : e.value;
    entry.sources.push(toSource(e));
  }
  // A grant that nets to zero ranks changes nothing, so it is dropped here (the
  // fold is the source of truth): no surface renders a "+0" pill, a "Rank N +0
  // by …" note, or a step-audit line for an effect with no effect.
  for (const name of Object.keys(bonuses)) {
    if (bonuses[name].bonus === 0) delete bonuses[name];
  }

  return { possessed, bonuses };
}