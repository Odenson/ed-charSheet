// ui/creation-text.js — the player-facing wording of creation mode (create-new-adept, B3/B4).
//
// Pure and DOM-free: it only turns the engine's reason codes and Finish plan numbers
// (engine/creation.js) into sentences. It decides nothing — every number it prints arrives in
// the plan, and an unknown code falls back to a generic line. Kept out of ed-app.js so the
// wording is testable and the refusal table stays next to the codes it covers.

// One line per refusal code engine/creation.js can return (spec "Reason codes"). A refused
// edit changes nothing; ed-app shows this text as a transient notice.
const REFUSALS = {
  'creation-closed': 'Creation is finished, so these points can no longer be changed.',
  'no-change': 'Nothing to change.',
  'bad-rank': 'That rank is not allowed.',
  'over-budget': 'Not enough points left for that.',
  'unknown-discipline': 'That Discipline is not part of creation.',
  'not-a-creation-talent': 'Only the Circle 1 Discipline Talents and one Talent Option take talent points.',
  'option-slot-full': 'You already have your one Talent Option. Remove it to pick another.',
  'unknown-attribute': 'Unknown attribute.',
  'out-of-range': 'That attribute value is outside the allowed range.',
  'unknown-skill': 'That skill is not in the skill catalog.',
  duplicate: 'You already have that.',
  'not-allowed-category': 'That skill cannot be taken at creation.',
  'tier-not-novice': 'Only Novice-tier skills can be taken at creation.',
  'bad-text': 'Enter 1 to 40 characters, without parentheses.',
  'generic-not-allowed': 'Pick a specific language instead.',
  'rank-cap': 'That skill is already at its maximum rank for creation.',
  'not-found': 'That entry is no longer on the sheet.',
  'not-a-magician': 'Only spellcasting Disciplines pick starting spells.',
  'unknown-spell': 'That spell is not in the spell list.',
  'not-available': 'That spell is not available at creation.',
  'matrix-circle': 'A spell above your Circle cannot go in a matrix yet.',
  'invalid-budget': 'Finish is blocked while a budget is over-spent.',
  'already-finished': 'Creation is already finished.',
};

/** The notice for a refused creation edit (`reason` is an engine/creation.js code). */
export function creationRefusalText(reason) {
  return REFUSALS[reason] ?? 'That change is not allowed.';
}

/** The reason codes this module words (the engine's documented set), for tests. */
export const CREATION_REASON_CODES = Object.keys(REFUSALS);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * The "Finish creation?" confirm message from `finishPlan`. States what the unspent attribute
 * points become (Max Karma, shown old -> new when the race has a Karma Modifier, with a note
 * when the race cap held it back) and that ranks cost Legend from then on.
 */
export function finishMessage(plan) {
  const bonus = Number(plan?.karmaBonus) || 0;
  const oldMax = plan?.oldMaxKarma;
  const newMax = plan?.newMaxKarma;
  const known = Number.isFinite(oldMax) && Number.isFinite(newMax);
  const verb = bonus === 1 ? 'becomes' : 'become';
  let karma;
  if (bonus <= 0) karma = 'No attribute points are left over, so Max Karma stays as it is.';
  else if (!known) karma = `Your ${plural(bonus, 'unused attribute point', 'unused attribute points')} ${verb} Max Karma.`;
  else {
    const capped = newMax - oldMax < bonus;
    karma = `Your ${plural(bonus, 'unused attribute point', 'unused attribute points')} ${verb} Max Karma (${oldMax} to ${newMax}${capped ? ', held back by the race maximum' : ''}).`;
  }
  return `${karma} After this, the creation points are locked and raising a talent or skill rank costs Legend.`;
}

/**
 * The caution line for Finish: the unspent talent points, skill ranks and spell points that
 * will be forfeited. Empty string when nothing is forfeited (so the confirm shows no warning).
 */
export function finishWarn(plan) {
  const f = plan?.forfeits ?? {};
  const parts = [
    [Number(f.talents) || 0, 'talent point', 'talent points'],
    [Number(f.skills) || 0, 'skill rank', 'skill ranks'],
    [Number(f.spells) || 0, 'spell point', 'spell points'],
  ]
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => plural(n, one, many));
  if (!parts.length) return '';
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `${list} will be forfeited.`;
}

/** The opening line of the "Creating your character" pop-up. */
export function guideIntro(name) {
  const who = String(name ?? '').trim();
  return `${who ? `${who} is` : 'Your character is'} saved on this device as a draft. Work through these steps in any order, then press Finish creation in the top bar.`;
}

/**
 * The steps of the creation pop-up, in the order a player works through them. `magician` adds the
 * spell-picking step. Wording only — every number mirrors the creation budgets (engine/creation.js
 * CREATION_RULES: 25 attribute points, 8 talent points, 8 extra skill ranks).
 * @returns {Array<{where: string, text: string}>}
 */
export function guideSteps({ magician = false } = {}) {
  return [
    { where: 'Overview', text: 'Spend your 25 attribute points with the − and + beside each attribute. Any you leave unspent become extra Max Karma when you finish.' },
    { where: 'Disciplines', text: 'Spend your 8 talent points on your Discipline’s Circle 1 talents and, if you want, one Talent Option (up to Rank 3 each). On the Skills sub-tab, add your starting skills.' },
    ...(magician ? [{ where: 'Spells', text: 'Pick your starting spells from the Grimoire view. You have as many spell points as your Perception Step.' }] : []),
    { where: 'Equipment', text: 'You start with an adventuring kit, a dagger, traveler’s garb, trail rations and 100 silver. Buy anything else here.' },
    { where: 'Finish', text: 'When you are done, press Finish creation in the top bar. Unspent talent points, skill ranks and spell points are lost, and from then on raising a rank costs Legend.' },
  ];
}
