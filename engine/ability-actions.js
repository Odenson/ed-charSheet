// engine/ability-actions.js — pure resolver for action-modifier effects
// (effect taxonomy v5, §2 / §5.1). DOM-free, store-free: plain data in, plain data out.
//
// An action-modifier `set`s the action (Free / Simple / Standard) a talent or skill
// uses. It overrides the printed action in either direction; when several active
// effects set different actions on one ability the fastest wins (owner house rule,
// rules.md R2). Nothing here is persisted: the store derives it per derive.

import { autoApplies } from './characteristics.js';

// Fastest first. Kept in step with docs/EFFECT-TAXONOMY.md §5.1 (drift-tested).
export const ACTION_SPEED = ['Free', 'Simple', 'Standard'];

/**
 * @param {string} abilityName
 * @param {*} baseAction  the printed action (raw; may be missing or non-listed)
 * @param {object[]} effects  origin-tagged active effects
 * @returns {{action: string, actionBase: *, actionSources: {name: string, action: string, applied: boolean}[]} | null}
 *   null when no effect applies or the resolved action equals the printed one.
 */
export function resolveAbilityAction(abilityName, baseAction, effects) {
  const considered = [];
  const seen = new Set();
  for (const e of effects ?? []) {
    if (!e || e.type !== 'action-modifier' || e.operation !== 'set') continue;
    if (e.target?.domain !== 'ability' || e.target?.name !== abilityName) continue;
    if (typeof e.value !== 'string' || !ACTION_SPEED.includes(e.value)) continue;
    if (!autoApplies(e)) continue;
    const name = e.origin?.name ?? e.source ?? 'effect';
    const key = `${name}|${e.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    considered.push({ name, action: e.value });
  }
  if (!considered.length) return null;
  const action = ACTION_SPEED[Math.min(...considered.map((c) => ACTION_SPEED.indexOf(c.action)))];
  if (action === baseAction) return null;
  return {
    action,
    actionBase: baseAction,
    actionSources: considered.map((c) => ({ ...c, applied: c.action === action })),
  };
}
