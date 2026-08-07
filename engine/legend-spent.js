// engine/legend-spent.js — pure, DOM-free Legend-spent audit.
//
// Reconstructs how much Legend a character has spent by pricing every advancement
// recorded on the sheet against the ED4 cost tables (rules/legend.json `costs`).
//
// Modelled sinks:
//   • attribute increases (base+points are the free creation buy — only `increases`
//     cost Legend),
//   • first-Discipline talent ranks (cumulative sum by the talent's tier), and
//   • additional-Discipline talent ranks (Phase 2): Rank 1 from the New Discipline
//     Talent Cost Table, ranks 2+ at the higher equivalent tier — talents from a 2nd/
//     3rd/4th+ Discipline cost more than the same talent would in the first Discipline.
//   • skills: cumulative sum by tier over the Skill Training Table's Novice/Journeyman
//     columns — skills DO cost Legend (Player's Guide 'Improving Skill Ranks'); the
//     silver training fee is a separate cost we don't track.
//   • knacks: a one-time flat cost equal to a Novice talent at the knack's required
//     Rank (Companions Guide p.76). Knacks aren't ranked up. The required rank comes
//     from the knack catalog (opts.knackCatalog, rules/knacks.json), falling back to an
//     inline `rank` on the instance; without either, the knack is left unpriced.
// It then reconciles the modeled total against the character's recorded
// `resources.legend.totalSpent`, surfacing the still-unmodeled delta. Spells and thread
// items arrive later; the section list is shaped so those slot in.
//
// Talents are grouped into one section per Discipline so the additional-Discipline
// surcharge is visible. The additional-Discipline Rank-1 cost depends on the "lowest
// Circle attained" when that Discipline was learned — historical state we don't store —
// so it is approximated by the character's current lowest Discipline Circle; the
// reconciliation delta keeps that approximation honest.
//
// Costs that fall outside the tables (e.g. an attribute raised beyond the +3 the table
// lists) resolve to null — flagged, never fabricated (UI-GUIDELINES §5).

/**
 * Total Legend to have raised one attribute by `increases` steps: the sum of each
 * +1 step's cost. `table` is per-increase, not cumulative — the 1st increase costs
 * table["1"], the 2nd table["2"], and so on (ED4 Player's Guide: the cost listed for
 * an increase is the cost of THAT increase, so raising an attribute twice costs the
 * sum of the 1st and 2nd steps). Returns null if any step is missing from the table.
 */
export function attributeIncreaseCost(increases, table) {
  if (!increases || increases <= 0) return 0;
  let sum = 0;
  for (let i = 1; i <= increases; i++) {
    const c = table?.[String(i)];
    if (c == null) return null; // unknown step — flag rather than fabricate
    sum += c;
  }
  return sum;
}

/**
 * Cumulative Legend to raise a talent from Rank 0 to `rank` at a given cost tier —
 * the sum of each rank step's cost. Returns null if any step is missing from the table.
 * (Also prices a spell: talentRanksCost(spellCircle, 'Novice', rankTable) but taking
 *  only that single step — see spellCost.)
 */
export function talentRanksCost(rank, tier, rankTable) {
  if (!rank || rank <= 0) return 0;
  let sum = 0;
  for (let i = 1; i <= rank; i++) {
    const c = rankTable?.[String(i)]?.[tier];
    if (c == null) return null; // unknown rank/tier — flag rather than fabricate
    sum += c;
  }
  return sum;
}

/**
 * Legend to learn a spell: the cost of a single Novice talent step at Rank = the
 * spell's Circle. (Phase 3 wires this once spell data exists; exported now so tests
 * and later phases share one definition.)
 */
export function spellCost(circle, rankTable) {
  if (!circle || circle <= 0) return 0;
  return rankTable?.[String(circle)]?.Novice ?? null;
}

/**
 * Cumulative Legend to raise a skill from Rank 0 to `rank` at a given tier — the sum
 * of each rank step's cost from the Skill Training Table (Novice/Journeyman). Returns
 * null if any step is missing (e.g. an out-of-range tier), flagged not fabricated.
 */
export function skillRanksCost(rank, tier, skillTable) {
  if (!rank || rank <= 0) return 0;
  let sum = 0;
  for (let i = 1; i <= rank; i++) {
    const c = skillTable?.[String(i)]?.[tier];
    if (c == null) return null;
    sum += c;
  }
  return sum;
}

/**
 * Legend to learn a knack: a one-time flat cost equal to a Novice talent at the
 * knack's required Rank (Companions Guide p.76 — knacks are not ranked up). Returns
 * null when the required rank is unknown, so the knack is flagged rather than priced
 * at a fabricated number.
 */
export function knackCost(requiredRank, rankTable) {
  if (!requiredRank || requiredRank <= 0) return null;
  return rankTable?.[String(requiredRank)]?.Novice ?? null;
}

/** The character's lowest Discipline Circle — the New-Discipline Rank-1 table row. */
export function lowestDisciplineCircle(disciplines) {
  const circles = (disciplines ?? []).map((d) => d?.circle).filter((c) => c != null);
  return circles.length ? Math.min(...circles) : null;
}

/**
 * The effective cost tier for a talent's rank steps beyond Rank 1. For the first
 * Discipline (ordinal 1) that's the talent's own tier band; for an additional
 * Discipline it's shifted up per the Equivalent Talent Circle Table.
 */
export function equivalentTier(realCircle, ordinal, costs) {
  if (ordinal <= 1) {
    const band = (costs?.tiers ?? []).find((b) => realCircle >= b.minCircle && realCircle <= b.maxCircle);
    return band?.label ?? null;
  }
  const rows = costs?.equivalentTier?.[String(Math.min(ordinal, 4))] ?? [];
  return rows.find((r) => realCircle <= r.maxCircle)?.tier ?? null;
}

/** Rank-1 cost of a talent in an additional Discipline (New Discipline Talent Cost Table). */
export function newDisciplineRank1Cost(lowestCircle, ordinal, costs) {
  if (ordinal <= 1 || lowestCircle == null) return null;
  const table = costs?.newDisciplineRank1?.[String(Math.min(ordinal, 4))];
  const row = String(Math.min(Math.max(lowestCircle, 1), 5));
  return table?.[row] ?? null;
}

/**
 * Total Legend for one additional-Discipline talent: Rank 1 from the New Discipline
 * table, ranks 2..N at the equivalent tier. Returns { cost, tier, rank1 }; cost is
 * null when any step is unpriceable (flagged, never fabricated).
 */
export function additionalDisciplineTalentCost(rank, realCircle, ordinal, lowestCircle, costs) {
  if (!rank || rank <= 0) return { cost: 0, tier: null, rank1: null };
  const rank1 = newDisciplineRank1Cost(lowestCircle, ordinal, costs);
  const tier = equivalentTier(realCircle, ordinal, costs);
  if (rank1 == null) return { cost: null, tier, rank1 };
  let cost = rank1;
  for (let i = 2; i <= rank; i++) {
    const c = costs?.talentRank?.[String(i)]?.[tier];
    if (c == null) return { cost: null, tier, rank1 };
    cost += c;
  }
  return { cost, tier, rank1 };
}

// Sum a section's line costs, ignoring any null (unpriced) lines.
function sumLines(lines) {
  return lines.reduce((s, l) => s + (typeof l.cost === 'number' ? l.cost : 0), 0);
}

// 1 → "1st", 2 → "2nd", 3 → "3rd", 4+ → "4th".
function ordinalLabel(n) {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

/**
 * Audit the Legend a character has spent, as a sectioned breakdown ready for display:
 *   { total, sections: [{ key, label, total, lines: [{ name, detail, cost }] }],
 *     recorded, delta }
 * `costs` is rules/legend.json's `costs` block. `delta = recorded − total` is the
 * portion not yet modeled (positive = unmodeled sinks such as spells/threads).
 */
export function auditLegendSpent(character, costs, opts = {}) {
  const knackCatalog = opts.knackCatalog ?? {};
  const sections = [];

  // --- Attributes: only Legend-bought `increases` cost Legend (points are free) ---
  const attrLines = [];
  for (const [name, a] of Object.entries(character?.attributes ?? {})) {
    const inc = a?.increases ?? 0;
    if (!inc) continue;
    attrLines.push({ name, detail: `+${inc}`, cost: attributeIncreaseCost(inc, costs?.attributeIncrease) });
  }
  sections.push({ key: 'attributes', label: 'Attributes', total: sumLines(attrLines), lines: attrLines });

  // --- Talents: one section per Discipline. The first Discipline pays normal rates;
  //     each additional Discipline pays the New-Discipline Rank-1 cost then the higher
  //     equivalent tier for ranks 2+ (the surcharge is visible per section). ---
  const disciplines = character?.disciplines ?? [];
  const lowestCircle = lowestDisciplineCircle(disciplines);
  disciplines.forEach((disc, idx) => {
    const ordinal = idx + 1;
    const additional = ordinal > 1;
    const lines = (disc?.talents ?? []).map((t) => {
      if (!additional) {
        return { name: t.name, detail: `${t.tier} · Rank ${t.rank}`, cost: talentRanksCost(t.rank, t.tier, costs?.talentRank) };
      }
      const { cost, tier } = additionalDisciplineTalentCost(t.rank, t.circle ?? 1, ordinal, lowestCircle, costs);
      const tierNote = tier && tier !== t.tier ? `${t.tier} → ${tier}` : tier ?? t.tier;
      return { name: t.name, detail: `${tierNote} · Rank ${t.rank}`, cost };
    });
    sections.push({
      key: `talents:${idx}`,
      kind: 'talents',
      label: disc.name,
      ordinal,
      ordinalLabel: ordinalLabel(ordinal),
      additional,
      total: sumLines(lines),
      lines,
    });
  });

  // --- Skills: cumulative cost by tier (Skill Training Table). Skills cost Legend
  //     (plus a separate silver training fee, not tracked here). ---
  const skills = character?.skills ?? [];
  if (skills.length) {
    const skillLines = skills.map((s) => ({
      name: s.name,
      detail: `${s.tier ?? 'Novice'} · Rank ${s.rank}`,
      cost: skillRanksCost(s.rank, s.tier ?? 'Novice', costs?.skillRank),
    }));
    sections.push({ key: 'skills', kind: 'skills', label: 'Skills', total: sumLines(skillLines), lines: skillLines });
  }

  // --- Knacks: one-time flat cost = Novice talent at the knack's required rank. The
  //     rank comes from the knack catalog (falling back to an inline `rank`); knacks
  //     with neither are left unpriced (—) and stay in the delta. ---
  const knacks = character?.knacks ?? [];
  if (knacks.length) {
    const knackLines = knacks.map((k) => {
      const rank = knackCatalog[k?.name]?.requiredRank ?? k?.rank ?? null;
      return {
        name: k?.name ?? 'Knack',
        detail: rank != null ? `Rank ${rank}` : 'rank unrecorded',
        cost: knackCost(rank, costs?.talentRank),
      };
    });
    sections.push({ key: 'knacks', kind: 'knacks', label: 'Knacks', total: sumLines(knackLines), lines: knackLines });
  }

  const total = sections.reduce((s, sec) => s + (sec.total ?? 0), 0);
  const recorded = character?.resources?.legend?.totalSpent ?? null;
  const delta = recorded == null ? null : recorded - total;

  return { total, sections, recorded, delta };
}
