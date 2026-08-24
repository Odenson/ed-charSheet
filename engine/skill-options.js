// engine/skill-options.js — pure, DOM-free helpers for learning new Skills
// (PLAN-LEARN-SKILLS §7). Reads structured rule data (rules/skills.json catalog
// + rules/legend.json costs); never touches the DOM or the store overlay.
// The store persists only inputs; this derives the learnable facts the UI needs.

const TIER_NUM_TO_LABEL = { 1: 'Novice', 2: 'Journeyman' };
const TIER_LABEL_TO_NUM = { Novice: 1, Journeyman: 2 };

/**
 * The skills a character may learn at Rank 1. Any catalog skill not already
 * known is learnable — no slots, no gating (PLAN-LEARN-SKILLS Q1). Each
 * entry carries the display fields and the Rank-1 pricing preview.
 * @param {object[]} skillCatalog - rules/skills.json `skills` array
 * @param {Set<string>} knownNames - already-known skill names
 * @param {object} costs - rules/legend.json `costs` (for rank1Cost + trainingSilver)
 * @returns {{name:string,tier:string,tierNumeric:number,attribute:string|null,action:string|null,brief:string|null,rank1Cost:number|null,trainingSilver:number|null}[]}
 */
export function learnableSkills(skillCatalog, knownNames = new Set(), costs = null) {
  const catalog = Array.isArray(skillCatalog) ? skillCatalog : [];
  const known = knownNames instanceof Set ? knownNames : new Set(knownNames ?? []);
  const items = [];
  for (const s of catalog) {
    if (!s?.name || known.has(s.name)) continue;
    const tierNumeric = s.tier ?? 1;
    const tier = TIER_NUM_TO_LABEL[tierNumeric] ?? 'Novice';
    const rank1Cost = costs?.skillRank?.['1']?.[tier] ?? null;
    const trainingSilver = costs?.skillTraining?.['1'] != null ? Number(costs.skillTraining['1']) : null;
    items.push({
      name: s.name,
      tier,
      tierNumeric,
      attribute: s.attribute ?? null,
      action: s.action ?? null,
      brief: s.presentation?.shortEffect ?? s.summary ?? null,
      rank1Cost,
      trainingSilver,
    });
  }
  // Novice first, then Journeyman, alphabetical within each tier group
  items.sort((a, b) => {
    const ta = TIER_LABEL_TO_NUM[a.tier] ?? 1;
    const tb = TIER_LABEL_TO_NUM[b.tier] ?? 1;
    if (ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name);
  });
  return items;
}
