// engine/knack-options.js — pure, DOM-free helper for learning new Knacks
// (PLAN-ADD-KNACKS §7.2). Reads structured rule data (rules/knacks.json catalog +
// rules/legend.json costs); never touches the DOM or the store overlay. The store
// persists only inputs; this derives the learnable facts the picker needs.
//
// Gate (Companion "Learning Talent Knacks"): a knack is learnable when a governing
// parent is known at actual rank >= requiredRank, the character is under the per-parent
// cap (knacks-per-parent <= that parent's rank), and the knack is not already owned.
// Parents are the character's Discipline-taught talents (always). When the
// `knackParents` homebrew lever is enabled (rules/homebrew.json `knackParents: true`,
// docs/HOMEBREW-RULES.md §5.6), the character's owned SKILLS also govern: any knack
// whose catalog parents include a name the character owns as a skill qualifies through
// it. Talent-first: a name owned as both a talent and a skill governs as a talent, and
// a single candidate is never listed under duplicate parents.

import { knackCost } from './legend-spent.js';

const parentName = (p) => (typeof p === 'string' ? p : p?.name ?? null);

/**
 * The knacks a character may learn.
 * @param {object} knackCatalog - rules/knacks.json `knacks` (object keyed by name)
 * @param {object} ctx
 * @param {{name:string,via?:string}[]} ctx.ownedKnacks - the character's owned knacks
 * @param {Object<string,{rank:number}>} ctx.parentTalents - Discipline-taught talent
 *   name -> { rank } (raw actual rank; never Versatility/other)
 * @param {Object<string,{rank:number}>} [ctx.parentSkills] - owned skill name -> { rank }
 *   (raw actual rank). When present/non-empty, names owned as skills also govern
 *   knacks (knackParents homebrew lever). Omit/empty to stay talent-only.
 * @param {{name:string,circle?:number}[]|Set<string>|Map<string,number>} [ctx.characterDisciplines]
 *   - the character's own disciplines. A knack whose `restrictions.discipline`
 *   (RESTRICTION-TAXONOMY §2) doesn't intersect it is excluded. Omit for no gate.
 * @param {object} costs - rules/legend.json `costs` (talentRank for Legend, knackTraining for fee)
 * @returns {{name,brief,summary,action,strain,restriction,requiredRank,qualifies:{name:string,rank:number,kind:'talent'|'skill'}[],viaDefault:string,cost:number|null,trainingFee:number|null}[]}
 */
export function learnableKnacks(knackCatalog, { ownedKnacks = [], parentTalents = {}, parentSkills = {}, characterDisciplines } = {}, costs = null) {
  const catalog = knackCatalog && typeof knackCatalog === 'object' ? knackCatalog : {};
  const owned = Array.isArray(ownedKnacks) ? ownedKnacks : [];
  const talents = parentTalents && typeof parentTalents === 'object' ? parentTalents : {};
  const skills = parentSkills && typeof parentSkills === 'object' ? parentSkills : {};

  // Discipline gate (PLAN-KNACK-RESTRICTIONS §2): normalize the character's own
  // disciplines to a name -> circle map. A `discipline` restriction is an OR-list of
  // {name, circle?} (bare strings -> {name}); the knack is learnable iff some entry's
  // name is owned AND (when the entry carries a circle) at that circle or higher.
  // When `characterDisciplines` is omitted/empty the gate is inactive (no filtering).
  const discByCircle = {};
  let gateActive = false;
  if (characterDisciplines instanceof Set) {
    for (const name of characterDisciplines) if (name) { discByCircle[name] = discByCircle[name] ?? null; gateActive = true; }
  } else if (characterDisciplines instanceof Map) {
    for (const [name, circle] of characterDisciplines) if (name) { discByCircle[name] = discByCircle[name] ?? circle ?? null; gateActive = true; }
  } else if (Array.isArray(characterDisciplines)) {
    for (const d of characterDisciplines) {
      if (!d?.name) continue;
      const circle = d.circle ?? null;
      discByCircle[d.name] = discByCircle[d.name] ?? circle;
      gateActive = true;
    }
  }

  const passesDisciplineGate = (restriction) => {
    if (!gateActive) return true;
    if (!restriction) return true;
    const disc = restriction.discipline;
    if (disc == null) return true; // no discipline type -> not gated by it
    const entries = Array.isArray(disc) ? disc : [disc];
    for (const entry of entries) {
      const name = typeof entry === 'string' ? entry : entry?.name;
      if (!name || !(name in discByCircle)) continue;
      const ownedCircle = discByCircle[name];
      const requiredCircle = typeof entry === 'string' ? null : entry?.circle ?? null;
      if (ownedCircle == null || requiredCircle == null || ownedCircle >= requiredCircle) return true;
    }
    return false;
  };

  const ownedNames = new Set(owned.map((k) => k?.name).filter(Boolean));
  // Per-parent owned count for the cap. Attribute each owned knack to its governing
  // parent: the stored `via` if present, else the catalog's first parent.
  const ownedCountByParent = {};
  for (const k of owned) {
    const cat = catalog[k?.name];
    const parent = k?.via ?? parentName(cat?.parents?.[0]);
    if (parent) ownedCountByParent[parent] = (ownedCountByParent[parent] ?? 0) + 1;
  }

  const out = [];
  for (const [name, entry] of Object.entries(catalog)) {
    if (ownedNames.has(name)) continue; // already learned
    const requiredRank = entry?.requiredRank ?? null;
    const minRank = requiredRank ?? 1;
    const qualifies = [];
    const seen = new Set();
    for (const p of entry?.parents ?? []) {
      const pn = parentName(p);
      if (!pn || seen.has(pn)) continue;
      seen.add(pn);
      // Talent path first (owned as a Discipline-taught talent).
      const t = talents[pn];
      if (t && t.rank != null && t.rank >= minRank && (ownedCountByParent[pn] ?? 0) < t.rank) {
        qualifies.push({ name: pn, rank: t.rank, kind: 'talent' });
      }
      // Skill path only for parents not already governed as a talent of THIS knack,
      // and only when the knackParents lever is active (non-empty parentSkills).
      const s = skills[pn];
      if (t) continue; // a name owned as both governs as talent for this knack
      if (s && s.rank != null && s.rank >= minRank && (ownedCountByParent[pn] ?? 0) < s.rank) {
        qualifies.push({ name: pn, rank: s.rank, kind: 'skill' });
      }
    }
    if (!qualifies.length) continue;
    if (!passesDisciplineGate(entry?.restrictions)) continue;

    out.push({
      name,
      brief: entry?.presentation?.shortEffect ?? entry?.summary ?? null,
      summary: entry?.summary ?? null,
      action: entry?.action ?? null,
      strain: entry?.strain ?? null,
      restriction: entry?.restrictions ?? null,
      requiredRank,
      qualifies,
      viaDefault: qualifies[0].name,
      cost: knackCost(requiredRank, costs?.talentRank),
      trainingFee: costs?.knackTraining?.[String(requiredRank)] != null ? Number(costs.knackTraining[String(requiredRank)]) : null,
    });
  }

  // Sort by first qualifying parent (alphabetical), then knack name. Display order only.
  out.sort((a, b) => a.viaDefault.localeCompare(b.viaDefault) || a.name.localeCompare(b.name));
  return out;
}

/**
 * Reduce a set of learnable knacks to those governed by a given set of parent
 * names (PLAN-ADD-KNACKS: per-discipline scoping). A candidate is included
 * when ANY of its qualifying parents is in `parentNames`. Pure/view helper:
 * the real gate still lives in `learnableKnacks`; this only narrows which of an
 * already-qualified set belong to a scope so the picker can filter to it.
 * @param {{qualifies:{name:string}[]}[]} options - output of `learnableKnacks`
 * @param {string[]|Set<string>} parentNames - parent names of the scope in view
 *   (talent names for a discipline, or skill names for the Skills tab)
 * @returns same shape filtered
 */
export function scopeKnackOptions(options, parentNames) {
  const set = parentNames instanceof Set ? parentNames : new Set(parentNames ?? []);
  return (options ?? []).filter((o) => (o.qualifies ?? []).some((q) => set.has(q.name)));
}
