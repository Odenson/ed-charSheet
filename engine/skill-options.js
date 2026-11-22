// engine/skill-options.js — pure, DOM-free helpers for learning new Skills
// (PLAN-LEARN-SKILLS §7). Reads structured rule data (rules/skills.json catalog
// + rules/legend.json costs); never touches the DOM or the store overlay.
// The store persists only inputs; this derives the learnable facts the UI needs.

import { payFromPurse } from './wealth.js';
import { skillRankStepCost } from './legend-spent.js';

export const MAX_TEXT = 40;
export const isLanguage = (category) => category === 'language-speak' || category === 'language-readwrite';

/**
 * Resolve a catalog entry (+ free text for a generic Knowledge / Artisan entry) to the stored
 * skill name. Shared by creation and the edit-mode learn flow. Language templates take no text.
 * @returns {{ok:true,storedName:string}|{ok:false,reason:string}}
 */
export function resolveSkillName(entry, text, existingNames = []) {
  if (!entry) return { ok: false, reason: 'unknown-skill' };
  let storedName = entry.name;
  if (entry.generic) {
    if (isLanguage(entry.category)) return { ok: false, reason: 'generic-not-allowed' };
    const t = typeof text === 'string' ? text.trim() : '';
    if (!t || t.length > MAX_TEXT || /[()]/.test(t)) return { ok: false, reason: 'bad-text' };
    storedName = `${entry.name} (${t})`;
  }
  const lower = storedName.toLowerCase();
  for (const n of existingNames ?? []) if (String(n).toLowerCase() === lower) return { ok: false, reason: 'duplicate' };
  return { ok: true, storedName };
}

/**
 * Pure plan for learning a skill at Rank 1 (no state change, no Legend affordability check —
 * that stays with the app's audit-aware guard).
 */
export function learnSkillPlan({ name, text, silver, character, catalog, costs, coins } = {}) {
  const entry = (Array.isArray(catalog) ? catalog : []).find((s) => s.name === name);
  const names = (character?.skills ?? []).map((s) => s.name);
  const r = resolveSkillName(entry, text, names);
  if (!r.ok) return r;
  const tier = entry.tier === 2 ? 'Journeyman' : 'Novice';
  const fee = Number(silver);
  const trainingFee = Number.isFinite(fee) && fee >= 0 ? Math.round(fee) : 0;
  let outCoins = coins;
  if (trainingFee > 0) {
    const spent = payFromPurse(coins ?? {}, trainingFee);
    if (!spent.ok) return { ok: false, reason: 'insufficient-silver' };
    outCoins = spent.coins;
  }
  const legendCost = skillRankStepCost({ tier }, costs, 1);
  return { ok: true, skill: { name: r.storedName, rank: 1, tier }, tier, legendCost, trainingFee, coins: outCoins };
}

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
  const known = new Set([...(knownNames ?? [])].map((n) => String(n).toLowerCase()));
  const items = [];
  const seen = new Set();
  for (const s of catalog) {
    if (!s?.name || seen.has(s.name)) continue;
    seen.add(s.name);
    if (s.generic && isLanguage(s.category)) continue; // templates: per-language entries cover languages
    if (!s.generic && known.has(s.name.toLowerCase())) continue;
    const tierNumeric = s.tier ?? 1;
    const tier = TIER_NUM_TO_LABEL[tierNumeric] ?? 'Novice';
    const rank1Cost = costs?.skillRank?.['1']?.[tier] ?? null;
    const trainingSilver = costs?.skillTraining?.['1'] != null ? Number(costs.skillTraining['1']) : null;
    items.push({
      name: s.name,
      category: s.category ?? null,
      generic: s.generic === true,
      freeText: s.generic === true && (s.category === 'knowledge' || s.category === 'artisan') ? s.category : null,
      tier,
      tierNumeric,
      attribute: s.attribute ?? null,
      action: s.action ?? null,
      brief: s.presentation?.shortEffect ?? s.summary ?? null,
      rank1Cost,
      trainingSilver,
      ...(s.custom === true ? { custom: true } : {}),
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
