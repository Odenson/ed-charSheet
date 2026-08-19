#!/usr/bin/env node
// ============================================================================
// ONE-OFF MIGRATION (v3 → v4). Populates the structured `effects[]` on every
// spell's `successes[]` and `extraThreads[]` options in rules/spells.json, so
// the runtime engine applies them WITHOUT parsing label strings. Reads the
// current committed rules/spells.json (preserving descriptions + curated base
// effects) and writes it back. Build-time label parsing lives HERE; the runtime
// stays regex-free. Kept for provenance — safe to re-run (idempotent-ish: it
// re-derives every option's effects from labels + the spell's base effect).
//
//   node tools/archive/enrich-spell-options.mjs
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = resolve(ROOT, 'rules/spells.json');
const doc = JSON.parse(readFileSync(FILE, 'utf8'));

// The spell's base "add" modifier (the primary numeric effect) — its type,
// target and measure define what an "Increase Effect (+N)" option boosts.
function baseAddEffect(spell) {
  return (spell.effects ?? []).find(
    (e) => e.operation === 'add' && typeof e.value === 'number' && e.target && e.measure,
  ) ?? null;
}

function optionEffects(spell, label, { onSuccess }) {
  const l = String(label);
  const note = () => [{ type: 'note', source: 'spell', gmDiscretion: /\(-\d/.test(l),
    summary: l }];

  // Increase Duration (+N minutes/rounds/hours) → duration-modifier.
  if (/increase duration/i.test(l)) {
    const m = l.match(/\+\s*(\d+)\s*(minute|hour|round)/i);
    if (!m) return note();
    const measure = /minute/i.test(m[2]) ? 'minutes' : /hour/i.test(m[2]) ? 'hours' : 'rounds';
    const e = { type: 'duration-modifier', operation: 'add', value: Number(m[1]), measure,
      source: 'spell', summary: l };
    if (onSuccess) { e.condition = 'on-success'; e.perSuccess = true; }
    return [e];
  }

  // Increase Effect (+N …) → mirror the spell's base add-effect with value N.
  // A negative "(-N …)" is a debuff on the TARGET, not a caster boost → note.
  if (/increase effect/i.test(l)) {
    const m = l.match(/([+-])\s*(\d+)/);
    const base = baseAddEffect(spell);
    if (!m || m[1] === '-' || !base) return note();
    const e = { type: base.type, target: { ...base.target }, operation: 'add',
      value: Number(m[2]), measure: base.measure, source: 'spell', summary: l };
    if (base.duration) e.duration = base.duration;
    if (onSuccess) { e.condition = 'on-success'; e.perSuccess = true; }
    return [e];
  }

  // Increase Range / Additional Target / anything else → note (no derived fold).
  return note();
}

let succ = 0, xt = 0;
for (const spell of Object.values(doc.spells)) {
  for (const o of spell.successes ?? []) { o.effects = optionEffects(spell, o.label, { onSuccess: true }); succ++; }
  for (const o of spell.extraThreads ?? []) { o.effects = optionEffects(spell, o.label, { onSuccess: false }); xt++; }
}

doc.effectTaxonomy = 'docs/EFFECT-TAXONOMY.md (v4)';
writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log(`Enriched ${succ} success + ${xt} extra-thread options; effectTaxonomy → v4.`);
