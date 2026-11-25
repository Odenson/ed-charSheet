// engine/active-effects.js — the unified "Active effects" window (pure, DOM-free).
// Folds every session source (active spells, Aim, opponent effects such as Taunt
// and spells cast on others, toggled combat options, charms, situations, locked
// conditions) into one ordered list, groups it by lifetime, and holds the pure
// session reducers. Nothing here is stored; see plans/active-condition-window.
//
// @typedef {Object} Entry
//   { id, kind:'spell'|'talent'|'option'|'charm'|'situation'|'condition',
//     side:'you'|'tgt', name, effectLabel, successes, text, roundsLeft, roundsTotal,
//     pct, low, chips:[{label,count?}], targetName, endable, endAction }
// @typedef {Object} OpponentRecord
//   { id:'opp:<seq>', kind:'spell'|'talent', name, effectLabel, text, targetName,
//     roundsLeft, roundsTotal }

export const GROUPS = [
  { side: 'you', label: 'Lasting · on you' },
  { side: 'tgt', label: 'Lasting · on target' },
];

const LOW_ROUNDS = 3;

function timing(roundsLeft, roundsTotal) {
  if (roundsLeft == null) return { roundsLeft: null, roundsTotal: null, pct: 100, low: false };
  const total = roundsTotal > 0 ? roundsTotal : roundsLeft;
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((roundsLeft / total) * 100))) : 100;
  return { roundsLeft, roundsTotal: roundsTotal ?? roundsLeft, pct, low: roundsLeft <= LOW_ROUNDS };
}

function entry(o) {
  const t = timing(o.roundsLeft ?? null, o.roundsTotal ?? null);
  const endable = o.endable !== false;
  return {
    id: o.id,
    kind: o.kind,
    side: o.side,
    name: o.name,
    effectLabel: o.effectLabel ?? null,
    successes: o.successes > 0 ? o.successes : null,
    text: o.text ?? null,
    ...t,
    chips: o.chips ?? [],
    targetName: o.targetName ?? null,
    targetNamed: o.targetNamed === true,
    endable,
    endAction: endable ? (o.endAction ?? { kind: o.kind, id: o.id }) : null,
  };
}

const signed = (n) => (n < 0 ? `-${Math.abs(n)}` : `+${n}`);

/**
 * One-line effect of an armed talent, scaled by its successes (Anticipate Blow
 * "+6 Physical Defense", Mystic Aim "+6 Attack steps"). Reads the first numeric
 * on-success effect of the armed payload; null when there is none.
 */
export function armedEffectLabel(a) {
  const e = (a?.effects ?? []).find((x) => Number.isFinite(x?.value));
  if (!e) return null;
  const n = e.perSuccess === true ? e.value * (a.successes ?? 0) : e.value;
  const v = e.operation === 'subtract' ? -n : n;
  const name = e.target?.name;
  if (e.type === 'defense-modifier') return `${signed(v)} ${name ?? ''} Defense`.replace('  ', ' ');
  if (e.measure === 'step') return `${signed(v)} ${name ? `${name} ` : ''}steps`;
  return name ? `${signed(v)} to ${name}` : signed(v);
}

function spellChips(options) {
  const chips = [];
  for (const p of options?.picks ?? []) chips.push(p.count > 1 ? { label: p.label, count: p.count } : { label: p.label });
  const s = options?.success;
  if (s) chips.push(s.mult > 1 ? { label: s.label, count: s.mult } : { label: s.label });
  return chips;
}

/** Build the ordered Entry[] from the session sources. Pure and deterministic. */
export function buildActiveEffectsList({
  spells = [], opponent = [], armed = [], options = [], charms = [], situations = [],
  knockedDown = false, encumbranceHarried = false, targetNameFallback = 'target',
} = {}) {
  const you = [];
  const tgt = [];

  for (const s of spells ?? []) {
    you.push(entry({
      id: `spell:${s.name}`, kind: 'spell', side: 'you',
      name: s.chosen?.name ? `${s.name} · ${s.chosen.name}` : s.name,
      effectLabel: s.effectLabel, successes: s.successes, roundsLeft: s.roundsLeft, roundsTotal: s.roundsTotal,
      chips: spellChips(s.options),
    }));
  }
  for (const a of armed ?? []) {
    if (a?.opponent) continue; // defensive: opponent records never live in armedTalents
    you.push(entry({
      id: `talent:${a.name}`, kind: 'talent', side: 'you', name: a.name,
      effectLabel: a.effectLabel ?? armedEffectLabel(a), successes: a.successes,
      roundsLeft: a.roundsLeft, roundsTotal: a.roundsTotal,
    }));
  }
  // `charms` / `options` are single-attack toggles already shown where they are
  // switched on (Combat options / Blood charms); the window lists only lasting effects.
  for (const s of situations ?? []) {
    you.push(entry({ id: `situation:${s.name}`, kind: 'situation', side: 'you', name: s.name, effectLabel: s.summary || null }));
  }
  if (knockedDown) {
    you.push(entry({ id: 'condition:Knocked Down', kind: 'condition', side: 'you', name: 'Knocked Down', endable: false }));
  }
  if (encumbranceHarried) {
    you.push(entry({ id: 'condition:Encumbered Harried', kind: 'condition', side: 'you', name: 'Harried', effectLabel: 'encumbrance', endable: false }));
  }
  for (const r of opponent ?? []) {
    tgt.push(entry({
      id: r.id, kind: r.kind, side: 'tgt', name: r.name, effectLabel: r.effectLabel, successes: r.successes, text: r.text,
      roundsLeft: r.roundsLeft, roundsTotal: r.roundsTotal,
      targetName: (typeof r.targetName === 'string' && r.targetName.trim()) || targetNameFallback,
      targetNamed: typeof r.targetName === 'string' && r.targetName.trim() !== '',
      endAction: { kind: r.kind, id: r.id },
    }));
  }
  return [...you, ...tgt];
}

/** Bucket entries by side; both groups are always returned. */
export function groupEffects(list) {
  return GROUPS.map((g) => ({ side: g.side, label: g.label, items: (list ?? []).filter((e) => e.side === g.side) }));
}

// ---- reducers ---------------------------------------------------------------

export function addOpponentEffect(list, rec) {
  return [...(list ?? []), rec];
}

export function tickOpponentEffects(list) {
  return (list ?? [])
    .map((r) => (r.roundsLeft == null ? r : { ...r, roundsLeft: r.roundsLeft - 1 }))
    .filter((r) => r.roundsLeft == null || r.roundsLeft > 0);
}

const nameOf = (id, kind) => (typeof id === 'string' && id.startsWith(`${kind}:`) ? id.slice(kind.length + 1) : id);

/**
 * End one window entry. `state = {activeSpells, opponentEffects, armedTalents,
 * toggledOptions, activeCharms}` -> `{ state, action }`; `action` is
 * `{type:'toggle-situation', name}` for a situation, else null.
 */
export function endEffect(state, { kind, id } = {}) {
  const st = state ?? {};
  const same = { ...st };
  if (typeof id === 'string' && id.startsWith('opp:')) {
    return { state: { ...st, opponentEffects: (st.opponentEffects ?? []).filter((r) => r.id !== id) }, action: null };
  }
  const name = nameOf(id, kind);
  switch (kind) {
    case 'spell':
      return { state: { ...st, activeSpells: (st.activeSpells ?? []).filter((s) => s.name !== name) }, action: null };
    case 'talent':
      return { state: { ...st, armedTalents: (st.armedTalents ?? []).filter((a) => a.name !== name) }, action: null };
    case 'option':
      return { state: { ...st, toggledOptions: (st.toggledOptions ?? []).filter((n) => n !== name) }, action: null };
    case 'charm':
      return { state: { ...st, activeCharms: (st.activeCharms ?? []).filter((n) => n !== name) }, action: null };
    case 'situation':
      return { state: same, action: { type: 'toggle-situation', name } };
    default:
      return { state: same, action: null };
  }
}

export function clearAll() {
  return { opponentEffects: [], toggledOptions: [] };
}

/** A hit on an opponent-arming talent (Taunt) -> one record, else null. */
export function armOpponent({ arms, successes, targetName, seq } = {}) {
  if (!arms?.opponent || !(successes > 0)) return null;
  const name = arms.name ?? 'Taunt';
  let text = arms.text ?? null;
  const ps = arms.perSuccess;
  if (ps && Number.isFinite(ps.delta)) {
    const head = `${ps.delta} x ${successes} = ${ps.delta * successes}${ps.allTests ? ' to all tests' : ''}.`;
    text = [head, arms.text, Number.isFinite(arms.step) ? `${name} Step ${arms.step}.` : null]
      .filter(Boolean)
      .join(' ');
  }
  return {
    id: `opp:${seq}`,
    kind: 'talent',
    name,
    effectLabel: ps && Number.isFinite(ps.delta) ? `${signed(ps.delta * successes)}${ps.allTests ? ' to all tests' : ''}` : null,
    successes,
    text,
    targetName: targetName ?? '',
    roundsLeft: arms.rounds,
    roundsTotal: arms.rounds,
  };
}

/** A cast on another target -> record when it hit and has a parsed duration. */
export function otherCastToRecord({ outcome, spell, seq, targetName } = {}) {
  const rounds = outcome?.duration?.rounds;
  if (!outcome?.hit || !(typeof rounds === 'number' && rounds > 0)) return null;
  return {
    id: `opp:${seq}`,
    kind: 'spell',
    name: outcome.spell ?? spell?.name,
    effectLabel: outcome.effect?.text ?? null,
    text: outcome.text,
    targetName: targetName ?? '',
    roundsLeft: rounds,
    roundsTotal: rounds,
  };
}

export function setOtherCastEffect(list, id, effectText) {
  return (list ?? []).map((r) => (r.id === id ? { ...r, effectLabel: effectText } : r));
}
