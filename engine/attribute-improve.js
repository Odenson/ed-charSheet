// engine/attribute-improve.js — pure, DOM-free rules for improving an attribute AFTER creation
// by spending Legend (plans/improve-attributes). Cost per +1 is 800 / 1,300 / 2,100 LP (per-step,
// not cumulative; rules/legend.json costs.attributeIncrease), cap +3 on `increases` only (creation
// `points` excluded), one improvement per save (baseline = the file's saved attributes), undo of the
// pending one. Only `increases` ever changes; Value/Step/defences derive from it elsewhere.
// Training days / silver / weeks-wait are info-only numbers for display.

import { valueToStep, attributeValue } from './derive.js';

/** Cost of the next +1 given current `increases`, or null beyond the table's highest key (the cap). */
export function nextIncreaseCost(increases, table) {
  const c = table?.[String(increases + 1)];
  return typeof c === 'number' ? c : null;
}

/** Name of the attribute whose `increases` exceed the baseline's, else null. */
export function pendingAttribute(attributes, saved) {
  if (!attributes || !saved) return null;
  for (const n of Object.keys(attributes)) {
    if ((attributes[n]?.increases ?? 0) > (saved[n]?.increases ?? 0)) return n;
  }
  return null;
}

/**
 * Describe (and gate) the next improvement of `name`.
 * ctx: { costTable, available, stepOf? }.
 */
export function attributeImprovePlan(attributes, saved, name, ctx = {}) {
  const fail = (reason) => ({ ok: false, reason });
  const a = attributes?.[name];
  if (!a) return fail('unknown-attribute');
  if (!saved) return fail('no-baseline');
  if (pendingAttribute(attributes, saved) !== null) return fail('already-pending');
  const inc = a.increases ?? 0;
  const cost = nextIncreaseCost(inc, ctx.costTable);
  if (cost === null) return fail('cap');
  if (!(ctx.available >= cost)) return { ...fail('insufficient-legend'), cost };
  const stepOf = ctx.stepOf ?? valueToStep;
  const value = attributeValue(a);
  const next = attributeValue({ ...a, increases: inc + 1 });
  const current = { value, step: stepOf(value) };
  const nextV = { value: next, step: stepOf(next) };
  return {
    ok: true,
    cost,
    newIncreases: inc + 1,
    current,
    next: nextV,
    trainingDays: current.step,
    silverFee: current.step * 10,
    weeksWait: nextV.step,
  };
}

/** Raise `name` by one increase. Refusals return the SAME `attributes` reference. */
export function applyAttributeIncrease(attributes, saved, name, ctx = {}) {
  const plan = attributeImprovePlan(attributes, saved, name, ctx);
  if (!plan.ok) return { ok: false, reason: plan.reason, attributes };
  const next = {};
  for (const n of Object.keys(attributes)) next[n] = { ...attributes[n] };
  next[name].increases = plan.newIncreases;
  return { ok: true, attributes: next };
}

/** Undo the pending increase on `name` (restore the baseline's `increases`; never below it). */
export function undoAttributeIncrease(attributes, saved, name) {
  const a = attributes?.[name];
  if (!a) return { ok: false, reason: 'unknown-attribute', attributes };
  if (!saved) return { ok: false, reason: 'no-baseline', attributes };
  const base = saved[name]?.increases ?? 0;
  if ((a.increases ?? 0) <= base) return { ok: false, reason: 'nothing-to-undo', attributes };
  const next = {};
  for (const n of Object.keys(attributes)) next[n] = { ...attributes[n] };
  next[name].increases = base;
  return { ok: true, attributes: next };
}
