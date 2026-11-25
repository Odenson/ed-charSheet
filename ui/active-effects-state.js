// ui/active-effects-state.js — pure, DOM-free view helpers for <ed-active-effects>.
import { groupEffects } from '../engine/active-effects.js';

// 'columns' keeps both groups (Combat); 'stack' omits empty ones (Spells).
export function viewGroups(effects, layout) {
  const groups = groupEffects(effects ?? []);
  return layout === 'stack' ? groups.filter((g) => g.items.length) : groups;
}

export function roundsPillText(entry) {
  if (entry.roundsLeft != null) return `${entry.roundsLeft} rds`;
  return 'active';
}

export function endButtonLabel(entry) {
  return `End ${entry.name}`;
}
