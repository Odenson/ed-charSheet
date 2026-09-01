// engine/spells.js — pure, DOM-free spell derivations for the Spells tab
// (PLAN-SPELLS.md §5). Data flows down: the store builds a `SpellsContext` from
// the derived model + rules/spells.json, and the UI calls these helpers to
// render the Grimoire and drive the cast flow. Nothing here rolls dice, spends
// Karma, or mutates state — the UI dispatches `roll` / `spend-karma` up, exactly
// as the recovery/attack flows do.
//
// The context (built by `buildSpellsContext`) is the only input, so every
// function stays trivially testable:
//   {
//     catalog:   { [name]: spellEntry },          // rules/spells.json `spells`
//     threadCap: [{ minCircle, maxCircle, extraThreads }],
//     known:     [{ name, learntSuccess }],        // character.spells.known
//     matrices:  [{ type, spell }],                // character.spells.matrices
//     disciplines: [{ name, circle }],             // the caster's spellcasting Disciplines
//     weavingStep: { [discipline]: number|null },  // derived Thread Weaving (X) step
//     castingStep: number|null,                    // derived Spellcasting step
//     attrStep:    { [Attribute]: number },        // derived attribute steps (for effect refs)
//     karma:       { weaving: { [discipline]: bool }, casting: bool },
//   }
//
// Learn-flow helpers (PLAN-LEARN-SPELLS.md §5) additionally take the rule
// tables — `learning` (difficulty/cost by Circle) and `talentRank` (the Legend
// cost table) — as data; the engine never hard-codes a formula.

import { spellCost } from './legend-spent.js';

// Standard matrices hold no threads; Enhanced/Armoured hold one (§3.1).
const MATRIX_THREADS = { Standard: 0, Enhanced: 1, Armoured: 1, Armored: 1 };

// Match spell names regardless of apostrophe style: the catalog uses the
// rulebook's typographic apostrophe (’ U+2019) while a character or a player
// typically types a straight one ('), so "Death's Head" must find "Death’s
// Head". Normalise curly quotes to straight and trim before comparing.
function normName(s) {
  return String(s ?? '').replace(/[‘’]/g, "'").trim();
}

// --- catalog joins -----------------------------------------------------------

/** Join a known-spell input to its catalog entry (null if the name is unknown).
 *  Falls back to an apostrophe-insensitive match and returns the CANONICAL
 *  catalog entry (so downstream always uses the catalog's spelling). */
export function joinSpell(ctx, name) {
  let entry = ctx.catalog?.[name];
  if (!entry && name != null) {
    const target = normName(name);
    const key = Object.keys(ctx.catalog ?? {}).find((k) => normName(k) === target);
    entry = key ? ctx.catalog[key] : null;
  }
  if (!entry) return null;
  const known = ctx.known?.find((k) => normName(k.name) === normName(name)) || null;
  return { ...entry, learntSuccess: known?.learntSuccess ?? null };
}

/** The caster's known spells, joined to the catalog, ordered by Circle then name. */
export function knownSpells(ctx) {
  return (ctx.known ?? [])
    .map((k) => joinSpell(ctx, k.name))
    .filter(Boolean)
    .sort((a, b) => a.circle - b.circle || a.name.localeCompare(b.name));
}

/** Known spells grouped by Discipline then Circle (for the Grimoire view). */
export function knownByDisciplineCircle(ctx) {
  const out = {};
  for (const s of knownSpells(ctx)) {
    (out[s.discipline] ??= {});
    (out[s.discipline][s.circle] ??= []).push(s);
  }
  return out;
}

/** Is a spell currently placed in a matrix (combat-ready)? Apostrophe-insensitive. */
export function matrixFor(ctx, name) {
  return (ctx.matrices ?? []).find((m) => normName(m.spell) === normName(name)) || null;
}

/**
 * The spell list for a cast type (S2-resolved definitions, PLAN §5):
 *   matrix   → spells currently placed in a matrix
 *   grimoire → the caster's learnt spells (`known`)
 *   raw      → any spell in the caster's Disciplines' lists (learnt or not)
 *   item     → deferred (§7) — always empty
 */
export function castTypeList(ctx, castType) {
  switch (castType) {
    case 'matrix':
      return (ctx.matrices ?? [])
        .filter((m) => m.spell)
        .map((m) => joinSpell(ctx, m.spell))
        .filter(Boolean)
        .sort((a, b) => a.circle - b.circle || a.name.localeCompare(b.name));
    case 'grimoire':
      return knownSpells(ctx);
    case 'raw': {
      const discs = new Set((ctx.disciplines ?? []).map((d) => d.name));
      return Object.values(ctx.catalog ?? {})
        .filter((s) => discs.has(s.discipline))
        .sort((a, b) => a.circle - b.circle || a.name.localeCompare(b.name));
    }
    case 'item':
    default:
      return [];
  }
}

// --- cast derivations --------------------------------------------------------

/** The caster's Circle in a given Discipline (drives the extra-thread cap). */
export function disciplineCircle(ctx, discipline) {
  return (ctx.disciplines ?? []).find((d) => d.name === discipline)?.circle ?? null;
}

/** Extra-thread cap from the threadCap table by the caster's Circle in the
 *  spell's Discipline (§3.1 — rules data, read here, never hard-coded). */
export function extraThreadCap(ctx, spell) {
  const circle = disciplineCircle(ctx, spell.discipline);
  if (circle == null) return 0;
  const band = (ctx.threadCap ?? []).find((b) => circle >= b.minCircle && circle <= b.maxCircle);
  return band?.extraThreads ?? 0;
}

/** Threads the matrix already holds for this cast (0 unless an Enhanced/Armoured
 *  matrix holds the spell), capped at the spell's requirement. */
export function matrixHeldThreads(ctx, spell, castType) {
  if (castType !== 'matrix') return 0;
  const m = matrixFor(ctx, spell.name);
  if (!m) return 0;
  return Math.min(MATRIX_THREADS[m.type] ?? 0, spell.threadsToWeave || 0);
}

/** Effective threads to forge = required − matrix-held, floored at 0 (§3.1). */
export function effectiveThreads(ctx, spell, castType) {
  return Math.max(0, (spell.threadsToWeave || 0) - matrixHeldThreads(ctx, spell, castType));
}

export function weavingStep(ctx, discipline) {
  return ctx.weavingStep?.[discipline] ?? null;
}
export function castingStep(ctx) {
  return ctx.castingStep ?? null;
}

// Parse a taxonomy ref like "attribute|Willpower|Step" → { domain, name, prop }.
function parseRef(ref) {
  const [domain, name, prop] = String(ref).split('|');
  return { domain, name, prop };
}

// A terse subject label for an effect's target: "Mystic armor" for an
// {armor, Mystic} target reads by its domain; an {attack, Damage} target reads
// by its MEASURE instead — "Damage step", never the word "attack" ("Damage
// attack" would be confusing for a fold onto a damage roll).
function effectSubject(e) {
  if (!e?.target) return null;
  return e.target.domain === 'attack'
    ? `${e.target.name} ${e.measure ?? 'step'}`
    : `${e.target.name} ${e.target.domain}`;
}

/**
 * The spell's Effect readout for the cast panel (§3.4 archetypes):
 *   { kind: 'step',   base, add, step, label }   — instantaneous roll (set+add)
 *   { kind: 'static', value, label }             — sustained readout (no roll)
 *   { kind: 'none' }                             — ritual/summon/utility (note only)
 */
export function effectReadout(ctx, spell) {
  const fx = spell.effects ?? [];
  const setEff = fx.find((e) => e.operation === 'set' && e.value?.ref);
  if (setEff) {
    const { name } = parseRef(setEff.value.ref);
    const base = ctx.attrStep?.[name] ?? null;
    const add = fx
      .filter((e) => e.operation === 'add' && e.measure === 'step' && e.duration === 'test')
      .reduce((s, e) => s + (Number(e.value) || 0), 0);
    return { kind: 'step', base, add, step: base == null ? null : base + add, label: 'Effect' };
  }
  const sustained = fx.find((e) => e.duration === 'sustained' && typeof e.value === 'number');
  if (sustained) {
    return { kind: 'static', value: sustained.value, label: effectSubject(sustained) ?? 'Effect' };
  }
  return { kind: 'none' };
}

/** Does this spell fold onto the CASTER when self-cast? (§3.4 — a sustained
 *  effect whose subject can be this character.) Used to flag the fold (phase 6b). */
export function isSustainedSelfEffect(spell) {
  return (spell.effects ?? []).some((e) => e.duration === 'sustained' && !e.gmDiscretion);
}

/** The sustained, foldable effects of a spell (the ones a self-cast applies to
 *  the caster). gmDiscretion effects (target debuffs) never fold onto the caster. */
export function sustainedEffectsOf(spell) {
  return (spell.effects ?? []).filter((e) => e.duration === 'sustained' && !e.gmDiscretion);
}

/**
 * Convert a spell duration string to a number of combat rounds (owner rule:
 * 1 round = 1 Initiative roll, 1 minute = 10 rounds, 1 hour = 600 rounds).
 * `rank` is the caster's Spellcasting rank (the "Rank" in "Rank minutes").
 * Returns null for durations not measured in rounds/minutes/hours (e.g. months) —
 * those are active but not round-counted in combat.
 */
export function durationRounds(duration, rank) {
  if (!duration) return null;
  const d = String(duration).toLowerCase();
  const unit = /minute/.test(d) ? 10 : /hour/.test(d) ? 600 : /round/.test(d) ? 1 : null;
  if (unit == null) return null;
  let count = 0;
  if (/rank/.test(d)) {
    count += rank ?? 0;
    const plus = d.match(/\+\s*(\d+)/);
    if (plus) count += Number(plus[1]);
  } else {
    const n = d.match(/(\d+)\s*(round|minute|hour)/);
    count = n ? Number(n[1]) : 0;
  }
  return count > 0 ? count * unit : null;
}

/**
 * Build a session active-spell record for a successful self-cast (phase 6b):
 * the sustained effects to fold, a terse readout label, and the round countdown.
 * `rank` is the caster's Spellcasting rank; `ctx` carries the cast's boosts —
 * `{ extraPicks: string[], successLevels: number }` — so the assigned extra
 * threads and the EXTRA successes (levels − 1) raise the folded effect value
 * (`stepAdd` for a step-measure effect, `ratingAdd` for a rating one) and extend
 * the duration (`durationRounds`), read from the options' structured `effects[]`
 * (taxonomy v4). No label parsing.
 *
 * Known limitation (single `boosted` flag): only the FIRST numeric sustained
 * effect receives a boost, and it receives exactly one of `stepAdd`/`ratingAdd` —
 * whichever matches its measure. Safe for every spell today (one numeric
 * sustained effect, one measure); a future spell with both a step and a rating
 * sustained effect could mis-target (the plan documents this as a chosen limit).
 */
export function buildActiveSpell(spell, rank, ctx = {}) {
  const { stepAdd, ratingAdd, durationRounds: durationBoost } = castBoosts(spell, ctx.extraPicks, ctx.successLevels);

  // Fold the effect boost into the first numeric sustained effect (the buff's
  // rating or step), measure-matched.
  let boosted = false;
  const effects = sustainedEffectsOf(spell).map((e) => {
    if (!boosted && typeof e.value === 'number') {
      const need = (e.measure ?? 'rating') === 'step' ? stepAdd : ratingAdd;
      if (need) {
        boosted = true;
        return { ...e, value: e.value + need };
      }
    }
    return e;
  });

  const base = durationRounds(spell.duration, rank);
  const rounds = base == null ? null : base + durationBoost;

  const stat = effects.find((e) => typeof e.value === 'number');
  const subject = effectSubject(stat);
  const effectLabel = stat
    ? `+${stat.value}${subject ? ` ${subject}` : ''}`
    : (spell.summary ?? '');
  return {
    name: spell.name,
    discipline: spell.discipline,
    effects,
    effectLabel,
    roundsLeft: rounds,
    roundsTotal: rounds,
  };
}

/** Advance the active-spell set by one round: decrement round-counted spells and
 *  drop the ones that hit 0. Non-counted (null roundsLeft) spells persist. */
export function tickActiveSpells(active) {
  return (active ?? [])
    .map((s) => (s.roundsLeft == null ? s : { ...s, roundsLeft: s.roundsLeft - 1 }))
    .filter((s) => s.roundsLeft == null || s.roundsLeft > 0);
}

// A duration measure (rounds/minutes/hours, taxonomy v4) normalised to rounds
// (1 minute = 10 rounds, 1 hour = 600). Used for duration-modifier effects.
function durationMeasureRounds(value, measure) {
  const n = Number(value) || 0;
  return measure === 'minutes' ? n * 10 : measure === 'hours' ? n * 600 : n;
}

// Sum the machine-applicable boosts an option's structured `effects[]` confer
// (taxonomy v4). No label parsing — the effects were structured at build time
// (tools/archive/enrich-spell-options.mjs).
function sumOptionBoosts(effects) {
  let stepAdd = 0;
  let ratingAdd = 0;
  let durationRounds = 0;
  for (const e of effects ?? []) {
    if (e.operation !== 'add') continue;
    if (e.type === 'duration-modifier') durationRounds += durationMeasureRounds(e.value, e.measure);
    else if (e.measure === 'step') stepAdd += Number(e.value) || 0;
    else if (e.measure === 'rating') ratingAdd += Number(e.value) || 0;
  }
  return { stepAdd, ratingAdd, durationRounds };
}

// The structured effects of an assigned option (by label) from a spell's list.
function optionEffects(list, label) {
  return (list ?? []).find((o) => o.label === label)?.effects ?? [];
}

// Fold the cast's option boosts (extra-thread picks + EXTRA successes) into one
// { stepAdd, ratingAdd, durationRounds }. Each extra thread applies once; each
// extra success (successLevels − 1) applies the spell's Success-Levels option.
function castBoosts(spell, extraPicks, successLevels) {
  const total = { stepAdd: 0, ratingAdd: 0, durationRounds: 0 };
  const add = (b, mult = 1) => {
    total.stepAdd += b.stepAdd * mult;
    total.ratingAdd += b.ratingAdd * mult;
    total.durationRounds += b.durationRounds * mult;
  };
  for (const label of extraPicks ?? []) add(sumOptionBoosts(optionEffects(spell?.extraThreads, label)));
  const extra = Math.max(0, (successLevels ?? 0) - 1);
  if (extra > 0) add(sumOptionBoosts(spell?.successes?.[0]?.effects), extra);
  return total;
}

/**
 * The Effect-step bonus for a cast — the accumulated effect-step boosts from the
 * assigned extra threads and the EXTRA cast successes (§3.2 #2/#3), read from the
 * options' structured `effects[]` (taxonomy v4). No label parsing.
 */
export function effectStepBonus(spell, extraPicks, successLevels) {
  return castBoosts(spell, extraPicks, successLevels).stepAdd;
}

/** Flatten the active spells' sustained effects for the derived-value fold,
 *  tagged with their origin (mirrors the knockdown condition tag). */
export function activeSpellEffects(active) {
  return (active ?? []).flatMap((s) =>
    (s.effects ?? []).map((e) => ({ ...e, origin: { kind: 'spell', name: s.name } })),
  );
}

/**
 * The pure cast decision-support object the cast UI renders (mirrors
 * endOfDayResetPlan — reports what a cast *could* need; the UI owns the loop).
 */
export function castPlan(ctx, spellName, castType) {
  const spell = joinSpell(ctx, spellName);
  if (!spell) return null;
  const discipline = spell.discipline;
  return {
    name: spell.name,
    circle: spell.circle,
    discipline,
    castType,
    threadsToWeave: effectiveThreads(ctx, spell, castType),
    threadsRequired: spell.threadsToWeave || 0,
    matrixHeld: matrixHeldThreads(ctx, spell, castType),
    weavingDifficulty: spell.weavingDifficulty?.value ?? null,
    weavingStep: weavingStep(ctx, discipline),
    castingStep: castingStep(ctx),
    castingTarget: spell.castingTarget ?? null,
    effect: effectReadout(ctx, spell),
    extraThreadCap: extraThreadCap(ctx, spell),
    successes: spell.successes ?? [],
    extraThreads: spell.extraThreads ?? [],
    canKarma: {
      weaving: !!ctx.karma?.weaving?.[discipline] && effectiveThreads(ctx, spell, castType) > 0,
      casting: !!ctx.karma?.casting,
    },
    range: spell.range ?? null,
    duration: spell.duration ?? null,
    area: spell.area ?? null,
    foldsOnSelf: isSustainedSelfEffect(spell),
  };
}

// --- learn-flow derivations (PLAN-LEARN-SPELLS.md §5) ------------------------

/** The Learning Difficulty for a Circle, from the explicit rules table.
 *  Returns null when the table has no entry (never computes circle + 5). */
export function learningDifficulty(learning, circle) {
  return learning?.difficultyByCircle?.[String(circle)] ?? null;
}

/** The suggested silver price to buy the spell copy: Circle × silverPerCircle
 *  (the GM's ×2/×3 tuition is an at-time, player-overridable modifier). */
export function spellSilverCost(learning, circle) {
  const per = Number(learning?.silverPerCircle);
  const c = Number(circle);
  return per > 0 && c > 0 ? c * per : null;
}

/** The spells this character *could* learn right now: catalog spells whose
 *  Discipline they have a Thread Weaving (X) talent for, minus what's already
 *  in `known[]` (apostrophe-insensitive). Tagged `castable` — the caster's
 *  Circle in the Discipline meets the spell's Circle (a higher-Circle spell is
 *  learnable but not yet castable through their matrices). Bounded by the
 *  catalog (rules/spells.json currently carries Nethermancer spells only). */
export function learnableSpells(ctx) {
  const known = new Set((ctx.known ?? []).map((k) => normName(k.name)));
  return Object.values(ctx.catalog ?? {})
    .filter((s) => {
      if (ctx.weavingStep?.[s.discipline] == null) return false; // no Thread Weaving talent
      if (known.has(normName(s.name))) return false;             // already learnt
      return true;
    })
    .map((s) => ({
      ...s,
      castable: (disciplineCircle(ctx, s.discipline) ?? 0) >= (s.circle || 0),
    }))
    .sort((a, b) => a.circle - b.circle || a.name.localeCompare(b.name));
}

/** The character's Patterncraft talent step (null if they don't own it — they
 *  cannot learn a spell without it). */
export function patterncraftStep(model) {
  for (const d of model?.disciplines ?? []) {
    const t = (d.talents ?? []).find((tal) => tal.name === 'Patterncraft');
    if (t && t.step != null) return t.step;
  }
  return null;
}

/**
 * The prerequisite gate for learning a given spell (PLAN-LEARN-SPELLS §3.2).
 * Pure: returns { ok, reasons[] }; the UI renders the blockers. `model` is the
 * derived model (resources.health, spells ctx, legend.available); `legendCost` is
 * the EFFECTIVE Legend cost (homebrew multiplier already applied — `learnPlan`
 * passes it) so a waiver makes the affordability check trivially pass.
 */
export function canLearn(model, spell, legendCost) {
  const reasons = [];
  const health = model?.resources?.health ?? {};
  if (Number(health.damage) > 0 || Number(health.wounds) > 0) {
    reasons.push('Rested & healthy — a magician with Damage or Wounds may not learn.');
  }
  if (patterncraftStep(model) == null) {
    reasons.push('No Patterncraft talent — required to interpret the spell.');
  }
  const twStep = model?.spells?.weavingStep?.[spell.discipline];
  if (twStep == null) {
    reasons.push(`No Thread Weaving (${spell.discipline}) talent — required to learn its spells.`);
  }
  const available = model?.legend?.available;
  if (legendCost != null && legendCost > 0 && (available == null || available < legendCost)) {
    reasons.push(available == null
      ? 'Available Legend unknown — cannot confirm the Legend cost is affordable.'
      : `Not enough Available Legend — need ${legendCost}, have ${available}.`);
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * The single decision-support object the Learn modal renders (parallel to
 * `castPlan`): everything pre-computed, homebrew multipliers folded in. The modal
 * reads these fields and calls NO pricing/difficulty helper itself.
 *   { name, discipline, circle, learningDifficulty, legendCost, suggestedSilver,
 *     patterncraftStep, castable, canLearn: { ok, reasons } }
 * `legendCost` / `suggestedSilver` are the *effective* costs (base × the
 * `ctx.learnLegendMultiplier` / `ctx.learnSilverMultiplier` levers, each `?? 1`).
 */
export function learnPlan(ctx, model, spellName) {
  const spell = learnableSpells(ctx).find((s) => normName(s.name) === normName(spellName));
  if (!spell) return null;
  const legendMult = ctx.learnLegendMultiplier ?? 1;
  const silverMult = ctx.learnSilverMultiplier ?? 1;
  const baseLegend = spellCost(spell.circle, ctx.talentRank); // the ONE pricing fn (legend-spent)
  const baseSilver = spellSilverCost(ctx.learning, spell.circle);
  const legendCost = baseLegend == null ? null : Math.round(baseLegend * legendMult);
  const suggestedSilver = baseSilver == null ? null : Math.round(baseSilver * silverMult);
  return {
    name: spell.name,
    discipline: spell.discipline,
    circle: spell.circle,
    learningDifficulty: learningDifficulty(ctx.learning, spell.circle),
    legendCost,
    suggestedSilver,
    patterncraftStep: patterncraftStep(model),
    castable: spell.castable,
    canLearn: canLearn(model, spell, legendCost),
  };
}

// --- context builder (called by the store's deriveModel) ---------------------

/**
 * Build the SpellsContext from the raw character `spells` block, the spell
 * catalog, and the already-derived model pieces (talent steps, attribute steps).
 * Returns null when the character has no spells block (non-casters), so the
 * store can omit the slice.
 *
 * @param {object} character         raw ed-character/1 (reads `spells`, `disciplines`)
 * @param {object} spellsFile        rules/spells.json ({ spells, threadCap })
 * @param {object} derived           { disciplines, attrStepByName }
 *   - disciplines: the model's derived disciplines[] (name, circle, talents[] with step/karma)
 *   - attrStepByName: { [Attribute]: step }
 */
export function buildSpellsContext(character, spellsFile, derived) {
  const block = character?.spells;
  if (!block || !(block.known?.length || block.matrices?.length)) return null;

  const catalog = spellsFile?.spells ?? {};
  const modelDiscs = derived?.disciplines ?? [];
  const attrStep = derived?.attrStepByName ?? {};

  // A Discipline is a spellcasting one iff it owns a Spellcasting talent.
  const casterDiscs = modelDiscs.filter((d) =>
    (d.talents ?? []).some((t) => t.name === 'Spellcasting'),
  );

  const weaving = {};
  const weavingKarma = {};
  for (const d of casterDiscs) {
    const tw = (d.talents ?? []).find((t) => t.name === `Thread Weaving (${d.name})`);
    weaving[d.name] = tw?.step ?? null;
    weavingKarma[d.name] = !!tw?.karma;
  }
  // Spellcasting talent is shared; take the first caster Discipline that has it.
  let castStep = null;
  let castKarma = false;
  for (const d of casterDiscs) {
    const sc = (d.talents ?? []).find((t) => t.name === 'Spellcasting');
    if (sc) {
      castStep = sc.step ?? null;
      castKarma = !!sc.karma;
      break;
    }
  }

  return {
    catalog,
    threadCap: spellsFile?.threadCap ?? [],
    known: block.known ?? [],
    matrices: block.matrices ?? [],
    disciplines: casterDiscs.map((d) => ({ name: d.name, circle: d.circle })),
    weavingStep: weaving,
    castingStep: castStep,
    attrStep,
    karma: { weaving: weavingKarma, casting: castKarma },
  };
}
