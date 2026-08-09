// ui/custom-item-builder.js — pure, DOM-free builders for the custom-item form
// (docs/PLAN-CUSTOM-ITEMS.md §6.2–§6.4). No Lit, no state, no game values: given
// a form's working item it produces the cleaned item the shared validator gate
// accepts, and it owns the effect-summary auto-generation ("auto-generated —
// edit to override"). Lives apart from the modal so node --test can pin the
// form's save semantics (mirrors ui/picker.js).
//
// Why this module exists: a shipped bug silently dropped effects on save. A
// type change reset the row via blankEffect(newType) whose summary is '', and
// the old clean step filtered out every summary-less row — so any effect whose
// type you changed vanished from the saved file (docs/PLAN-CUSTOM-ITEMS.md
// §6.6). Here the summary is always derived from the row's fields and effects
// are never dropped; the modal's _setEffect keeps the summary in sync the same
// way.

import { validateItem, MAX_SHORT_EFFECT } from '../engine/validate-item.js';

export { MAX_SHORT_EFFECT };

// §6.4 — type → target/measure constraints (mirrors engine/validate-item.js).
// `open` names allow a free-text target name (a named ability / natural appendage).
export const TYPE_META = {
  'armor-modifier': { domain: 'armor', names: ['Physical', 'Mystic'], measure: 'rating', label: 'Armour' },
  'defense-modifier': { domain: 'defense', names: ['Physical', 'Mystic', 'Social'], measure: 'rating', label: 'Defence' },
  'attack-modifier': { domain: 'attack', names: ['Damage'], measure: 'step', label: '', open: true },
  'test-modifier': { domain: 'test', names: ['Action', 'Attack', 'Damage', 'Effect', 'Initiative', 'Recovery'], measure: 'result', label: 'Test', open: true },
  'characteristic-modifier': { domain: 'characteristic', names: ['WoundThreshold', 'DeathRating', 'UnconsciousnessRating', 'RecoveryTests', 'Initiative', 'Movement', 'CarryingCapacity'], measure: 'rating', label: '' },
  'attribute-modifier': { domain: 'attribute', names: ['Dexterity', 'Strength', 'Toughness', 'Perception', 'Willpower', 'Charisma'], measure: 'value', label: '' },
};
export const TYPE_ORDER = Object.keys(TYPE_META);
export const OPERATIONS = ['add', 'subtract', 'set'];
export const MEASURES = ['rating', 'step', 'result', 'value', 'points', 'rank'];
export const CONDITIONS = ['always', 'situational'];

// Presentation-only formatters (no game values computed here).
export const prettyName = (n) => (n ?? '').replace(/([a-z])([A-Z])/g, '$1 $2');
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const absVal = (v) => Math.abs(Number(v) || 0);
export const effectLabel = (e) => {
  const meta = TYPE_META[e.type];
  const name = prettyName(e.target?.name ?? '');
  const suffix = meta?.label ?? '';
  return `${name}${suffix ? ` ${suffix}` : ''}`.trim();
};
export const summaryFor = (e) => {
  if (e.type === 'note') return e.summary ?? '';
  const m = e.measure && e.measure !== 'rating' ? ` ${e.measure}` : '';
  if (e.operation === 'subtract') return `Reduces ${effectLabel(e)} by ${absVal(e.value)}${m}`;
  if (e.operation === 'set') return `Sets ${effectLabel(e)} to ${Number(e.value) || 0}${m}`;
  return `Adds +${absVal(e.value)} ${effectLabel(e)}${m}`;
};

/** The default empty row for a type (summary filled by the auto-sync later). */
export const blankEffect = (type = 'armor-modifier') => {
  const meta = TYPE_META[type];
  return {
    type,
    operation: 'add',
    value: 1,
    measure: meta?.measure,
    target: meta ? { domain: meta.domain, name: meta.names[0] } : undefined,
    condition: 'always',
    summary: '',
  };
};

/** Stamp an effect as item-sourced, default its condition, and auto-summarise
 * unless the caller passes an explicit summary (the user's typed override). */
export const finishEffect = (e, summary) => ({
  ...e,
  source: 'item',
  condition: e.condition ?? 'always',
  summary: summary ?? summaryFor(e),
});

// Strip the transient `_openTarget` flag and guarantee every row carries a
// summary, auto-generating one for rows left on their defaults. Effects are
// never silently dropped here — a row the user added stays, even if it falls
// back to its auto summary. (This is the fix: the old code filtered out rows
// with an empty summary, and a type change had blanked it.)
export const cleanEffects = (effects) =>
  (effects ?? []).map((e) => {
    const { _openTarget, ...rest } = e;
    return { ...rest, summary: rest.summary?.trim() ? rest.summary : summaryFor(rest) };
  });

// The pure core of the modal's "clean form" step: trim + validate the name,
// drop transient ref empties, persist presentation.shortEffect only when
// non-empty, then leave shape/taxonomy judgement to the shared engine gate.
export function cleanItemForm(name, item) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { ok: false, errors: ['Name is required.'] };
  const effects = cleanEffects(item.effects ?? []);
  const clean = { kind: item.kind, effects };
  const ref = {};
  for (const [k, v] of Object.entries(item.ref ?? {})) {
    if (k === 'cost') {
      if (typeof v === 'number' && v >= 0) ref.cost = v;
    } else if (v !== undefined && v !== '' && v !== false && v !== 0) {
      ref[k] = v;
    }
  }
  if (Object.keys(ref).length) clean.ref = ref;
  const short = item.presentation?.shortEffect?.trim();
  if (short) clean.presentation = { shortEffect: short };
  const checked = validateItem(trimmed, clean);
  return checked.ok ? { ok: true, name: trimmed, item: clean } : { ok: false, errors: checked.errors };
}
