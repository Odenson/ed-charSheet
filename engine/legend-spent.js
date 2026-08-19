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
//     Homebrew override (rules/homebrew.json `legend.additionalTierShift`, plans/
//     PLAN-HOMEBREW-LEGEND-TIER.md): with the rule on, an additional-Discipline talent
//     is instead every rank at its own tier bumped one step up (Novice→Journeyman→
//     Warden→Master, Master stays Master), both surcharge tables ignored — pass
//     `opts.tierShift` into auditLegendSpent/additionalDisciplineTalentCost/
//     talentRankStepCost.
//   • skills: cumulative sum by tier over the Skill Training Table's Novice/Journeyman
//     columns — skills DO cost Legend (Player's Guide 'Improving Skill Ranks'); the
//     silver training fee is a separate cost we don't track.
//   • knacks: a one-time flat cost equal to a Novice talent at the knack's required
//     Rank (Companions Guide p.76). Knacks aren't ranked up. The required rank is read
//     off the resolved knacks passed in as opts.knacks (store.resolveKnack already bound
//     it from the catalog — the audit does not re-resolve); without a rank, unpriced.
//   • thread items: each Thread Rank woven costs the cumulative talent-rank progression
//     for the item's tier (GMG p.202 — thread ranks "correlate to the cost for increasing
//     talent ranks"). The tier is read off the thread-item catalog passed in as
//     opts.threadItemCatalog (rules/thread-items.json items); an owned item matching a
//     catalog name is a thread item, and an unknown tier stays unpriced (—).
//   • Karma on Legend (homebrew rule, plans/PLAN-HOMEBREW-KARMA.md): with the rule on
//     (opts.karmaRitualCost = the race's Legend-per-Karma cost) the Karma ledger's
//     lifetime `converted` is all bought with Legend, so the sink is `converted × cost`
//     — a single figure broken into a virtual historic line plus one line per dated
//     ritual event. Rule off (absent/zero cost) ⇒ no sink.
//   • spells (PLAN-LEARN-SPELLS §5.1, resolves PLAN-SPELLS A5): learning a spell
//     spends Legend. Every entry in character.spells.known is a sink — a single Novice
//     talent step at Rank = the spell's Circle (spellCost). The Circle is read off the
//     spell catalog passed in as opts.spellCatalog (rules/spells.json spells), resolved
//     apostrophe-insensitively; an unknown name contributes 0, never a fabricated cost.
// It then reconciles the modeled total against the character's recorded
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

// Normalise a spell name for catalog lookup: the catalog uses the rulebook's
// typographic apostrophe (’ U+2019) while a character may record a straight one
// (') — "Death’s Head" must find "Death's Head". Mirrors spells.js's normName so
// the audit resolves the same spell the join does.
function normSpellName(s) {
  return String(s ?? '').replace(/[‘’]/g, "'").trim();
}

/** Look a known-spell name up in the spell catalog (apostrophe-insensitive)
 *  and return its Circle; null when the name isn't in the catalog. */
function spellCircleByName(catalog, name) {
  const key = Object.keys(catalog ?? {}).find((k) => normSpellName(k) === normSpellName(name));
  return key ? Number(catalog[key]?.circle) || null : null;
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

/**
 * A tier label bumped one step up the `costs.tiers` ladder (Novice → Journeyman →
 * Warden → Master). `shift` is the number of steps; `Master` is the ceiling — a
 * Master-tier talent keeps Master prices (no higher column exists). Unknown tier
 * labels pass through unchanged (the caller flags via the talentRank table miss).
 * Homebrew rule (rules/homebrew.json `legend.additionalTierShift`).
 */
export function shiftedTier(tier, costs, shift = 1) {
  if (!shift || shift <= 0) return tier;
  const labels = (costs?.tiers ?? []).map((t) => t.label);
  const i = labels.indexOf(tier);
  if (i === -1) return tier;
  return labels[Math.min(i + shift, labels.length - 1)];
}

/** Rank-1 cost of a talent in an additional Discipline (New Discipline Talent Cost Table). */
export function newDisciplineRank1Cost(lowestCircle, ordinal, costs) {
  if (ordinal <= 1 || lowestCircle == null) return null;
  const table = costs?.newDisciplineRank1?.[String(Math.min(ordinal, 4))];
  const row = String(Math.min(Math.max(lowestCircle, 1), 5));
  return table?.[row] ?? null;
}

/**
 * Total Legend for one additional-Discipline talent.
 *
 * Standard model: Rank 1 from the New Discipline table, ranks 2..N at the
 * equivalent tier. Returns { cost, tier, rank1 }; cost is null when any step is
 * unpriceable (flagged, never fabricated).
 *
 * Homebrew model (opts.tierShift > 0, rules/homebrew.json
 * `legend.additionalTierShift`): every rank is priced at the talent's own tier
 * bumped one step up (Novice → Journeyman → Warden → Master, Master stays
 * Master) — the New-Discipline Rank-1 table and the Equivalent-Tier table are
 * both ignored, so the whole talent costs exactly `talentRanksCost(rank, shifted)`
 * with no separate rank-1 surcharge. A missing `tier` input defaults to Novice,
 * then shifts (mirroring the audit's skill default). `rank1` is null under the
 * rule (no table price); `tier` is the shifted column actually used.
 */
export function additionalDisciplineTalentCost(rank, realCircle, ordinal, lowestCircle, costs, opts = {}) {
  if (!rank || rank <= 0) return { cost: 0, tier: null, rank1: null };
  const tierShift = Number(opts?.tierShift) || 0;
  if (tierShift > 0) {
    const tier = shiftedTier(opts?.tier ?? 'Novice', costs, tierShift);
    return { cost: talentRanksCost(rank, tier, costs?.talentRank), tier, rank1: null };
  }
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

/**
 * The Legend cost of the single rank step that brings a talent TO `toRank`
 * (the step from `toRank-1` to `toRank`). For an increase, call it with
 * `toRank = rank + 1`; for the refund of a decrease (rank → rank-1), call it
 * with `toRank = rank` — the step that bought the current rank.
 *
 * Built from the same cumulative functions the audit uses (talentRanksCost for
 * the first Discipline, additionalDisciplineTalentCost otherwise), so a step
 * cost always equals `audit(after) − audit(before)` for that one rank change.
 * Returns null when the step is unpriceable (missing tier, a rank beyond the
 * cost table, an unresolvable additional-Discipline tier) — flagged, never
 * fabricated. `toRank <= 0` (e.g. refunding down to Rank 0) costs nothing.
 *
 * @param {{tier: string, circle?: number}} t  the raw character talent input
 * @param {number} ordinal  1-based position of the Discipline in the character
 * @param {number|null} lowestCircle  lowestDisciplineCircle(character.disciplines)
 * @param {object} costs  rules/legend.json `costs` block
 * @param {number} toRank  the rank the step brings the talent to
 * @param {{tierShift?: number, tier?: string}} opts  homebrew additional-tier
 *   shift (rules/homebrew.json): when `tierShift > 0`, an ordinal-2+ talent is
 *   priced from its own `tier` bumped up instead of the New-Discipline/Equivalent
 *   tables — the step cost then matches the shifted audit exactly.
 */
export function talentRankStepCost(t, ordinal, lowestCircle, costs, toRank, opts = {}) {
  if (!toRank || toRank <= 0) return 0;
  if (ordinal <= 1) {
    const hi = talentRanksCost(toRank, t?.tier, costs?.talentRank);
    const lo = talentRanksCost(toRank - 1, t?.tier, costs?.talentRank);
    return hi == null || lo == null ? null : hi - lo;
  }
  const shiftOpts = { ...opts, tier: opts?.tier ?? t?.tier ?? 'Novice' };
  const hi = additionalDisciplineTalentCost(toRank, t?.circle ?? 1, ordinal, lowestCircle, costs, shiftOpts).cost;
  const lo = additionalDisciplineTalentCost(toRank - 1, t?.circle ?? 1, ordinal, lowestCircle, costs, shiftOpts).cost;
  return hi == null || lo == null ? null : hi - lo;
}

/**
 * The Legend cost of the single skill rank step that brings the skill TO
 * `toRank` (the step from `toRank-1` to `toRank`). Increase = `toRank = rank+1`;
 * the refund of a decrease = the same call at `toRank = rank`. A missing tier
 * defaults to Novice, exactly as the audit prices it (engine/legend-spent.js —
 * skills section). Returns null when the step is unpriceable (rank beyond the
 * Skill Training Table's Rank 10).
 *
 * @param {{tier?: string}} s  the raw character skill input
 * @param {object} costs  rules/legend.json `costs` block
 * @param {number} toRank  the rank the step brings the skill to
 */
export function skillRankStepCost(s, costs, toRank) {
  if (!toRank || toRank <= 0) return 0;
  const tier = s?.tier ?? 'Novice';
  const hi = skillRanksCost(toRank, tier, costs?.skillRank);
  const lo = skillRanksCost(toRank - 1, tier, costs?.skillRank);
  return hi == null || lo == null ? null : hi - lo;
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
  const sections = [];
  const { knacks: knacksOpt, threadItemCatalog = {}, spellCatalog = {} } = opts;

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
  //     equivalent tier for ranks 2+ (the surcharge is visible per section). With the
  //     homebrew tier-shift rule on (opts.tierShift > 0), an additional-Discipline
  //     talent is instead priced at its own tier bumped one step up (Novice →
  //     Journeyman → Warden → Master, Master stays Master), the New-Discipline and
  //     Equivalent-Tier tables ignored. ---
  const disciplines = character?.disciplines ?? [];
  const lowestCircle = lowestDisciplineCircle(disciplines);
  const tierShift = Number(opts?.tierShift) || 0;
  disciplines.forEach((disc, idx) => {
    const ordinal = idx + 1;
    const additional = ordinal > 1;
    const lines = (disc?.talents ?? []).map((t) => {
      if (!additional) {
        return { name: t.name, detail: `${t.tier} · Rank ${t.rank}`, cost: talentRanksCost(t.rank, t.tier, costs?.talentRank) };
      }
      const { cost, tier } = additionalDisciplineTalentCost(t.rank, t.circle ?? 1, ordinal, lowestCircle, costs, {
        tierShift,
        tier: t.tier ?? 'Novice',
      });
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
  //     rank comes straight off the resolved knacks (store.resolveKnack already bound
  //     it from the catalog) — the audit doesn't re-resolve. `opts.knacks` are those
  //     resolved knacks; it falls back to a raw `character.knacks` with inline `rank`.
  //     Knacks with no rank are left unpriced (—) and stay in the delta. ---
  const knacks = knacksOpt ?? character?.knacks ?? [];
  if (knacks.length) {
    const knackLines = knacks.map((k) => {
      const rank = k?.requiredRank ?? k?.rank ?? null;
      return {
        name: k?.name ?? 'Knack',
        detail: rank != null ? `Rank ${rank}` : 'rank unrecorded',
        cost: knackCost(rank, costs?.talentRank),
      };
    });
    sections.push({ key: 'knacks', kind: 'knacks', label: 'Knacks', total: sumLines(knackLines), lines: knackLines });
  }

  // --- Thread items: an owned item whose name is in the thread-item catalog is a
  //     thread item. Each woven Thread Rank costs the cumulative talent-rank
  //     progression for the item's tier (GMG p.202). No thread (rank 0) costs nothing;
  //     an unknown tier is flagged rather than priced at a fabricated number. ---
  const threadItems = (character?.items ?? []).filter((it) => threadItemCatalog[it?.name]);
  if (threadItems.length) {
    const threadLines = threadItems.map((it) => {
      const ref = threadItemCatalog[it.name];
      const rank = it.threadRank ?? 0;
      return {
        name: it.name,
        detail: rank > 0 ? `${ref.tier ?? 'unknown tier'} · Thread Rank ${rank}` : 'no thread woven',
        cost: rank > 0 ? talentRanksCost(rank, ref.tier, costs?.talentRank) : 0,
      };
    });
    sections.push({ key: 'threads', kind: 'threads', label: 'Thread Items', total: sumLines(threadLines), lines: threadLines });
  }

  // --- Spells (PLAN-LEARN-SPELLS §5.1, resolves PLAN-SPELLS A5): learning a
  //     spell spends Legend. Every entry in `character.spells.known` is a sink —
  //     a single Novice talent step at Rank = the spell's Circle (spellCost), so
  //     Available Legend drops as spells are learned and the audit reconciles.
  //     `known[]` stores only name + learntSuccess (never the Circle — that
  //     lives in the catalog). `opts.spellCatalog` is rules/spells.json's
  //     `spells` map, resolved apostrophe-insensitively (the same normalisation
  //     joinSpell uses); an unknown name contributes 0, never a fabricated cost.
  //     `opts.spellCostMultiplier` (nullish-coalesced ?? 1, never `|| 1`) scales
  //     each spell's cost — the homebrew "learning costs no Legend" rule ships
  //     value 0, a falsy number, so `|| 1` would silently switch the rule off. ---
  const spellsKnown = character?.spells?.known ?? [];
  if (spellsKnown.length) {
    const spellMultiplier = opts.spellCostMultiplier ?? 1;
    const spellLines = spellsKnown.map((k) => {
      const circle = spellCircleByName(spellCatalog, k?.name);
      return {
        name: k?.name ?? 'Spell',
        detail: circle != null ? `Circle ${circle}` : 'not in the catalog',
        cost: circle != null ? spellCost(circle, costs?.talentRank) * spellMultiplier : 0,
      };
    });
    sections.push({ key: 'spells', kind: 'spells', label: 'Spells', total: sumLines(spellLines), lines: spellLines });
  }

  // --- Karma on Legend (homebrew Karma economy, plans/PLAN-HOMEBREW-KARMA.md): with the
  //     rule on, `opts.karmaRitualCost` is the race's Legend-per-Karma cost and the
  //     Karma a character holds is a ledger — `resources.karma.converted` (lifetime
  //     Karma gained, incl. starting) — every point bought with Legend, so the sink is
  //     `converted × cost`, a single figure independent of the dated ritual events
  //     (`resources.karma.rituals`, which stay for display/undo). The section breaks
  //     that figure into a virtual historic line (points from before the ritual log)
  //     plus one line per dated event, all priced at the *current* cost, so its total
  //     always equals `converted × cost`. Rule off (absent/zero cost) ⇒ no sink. ---
  const karmaRitualCost = Number(opts?.karmaRitualCost);
  const karmaLedger = character?.resources?.karma ?? {};
  const converted = Number(karmaLedger.converted) || 0;
  const rituals = karmaLedger.rituals ?? [];
  if (Number.isFinite(karmaRitualCost) && karmaRitualCost > 0 && converted > 0) {
    const eventsPoints = rituals.reduce((s, r) => s + (Number(r?.points) || 0), 0);
    const historic = converted - eventsPoints;
    const ritualLines = [];
    if (historic > 0) {
      ritualLines.push({
        name: 'Karma conversions (historic)',
        detail: `+${historic} Karma @ ${karmaRitualCost}/pt`,
        cost: historic * karmaRitualCost,
      });
    }
    for (const r of rituals) {
      ritualLines.push({
        name: r?.date ? String(r.date).slice(0, 10) : 'Karma Ritual',
        detail: `+${Number(r?.points) || 0} Karma @ ${karmaRitualCost}/pt`,
        cost: (Number(r?.points) || 0) * karmaRitualCost,
      });
    }
    sections.push({
      key: 'karma-rituals',
      kind: 'karma-rituals',
      label: 'Karma Rituals',
      total: converted * karmaRitualCost,
      lines: ritualLines,
    });
  }

  const total = sections.reduce((s, sec) => s + (sec.total ?? 0), 0);
  const recorded = character?.resources?.legend?.totalSpent ?? null;
  const delta = recorded == null ? null : recorded - total;

  return { total, sections, recorded, delta };
}
