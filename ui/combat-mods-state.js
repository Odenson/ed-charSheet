// ui/combat-mods-state.js — pure, DOM-free segment logic for the Combat tab's
// tabbed "Combat modifiers" control. The component delegates counts and the
// remembered-segment normalisation here.

export const MOD_TABS = [
  { id: 'opts', label: 'Combat options' },
  { id: 'sits', label: 'Situational' },
  { id: 'charms', label: 'Blood charms' },
];

// Live active-count per segment (same rules the old collapsible sections used).
export function modTabCounts({ options, armedNames, toggledOpts, sits, toggledSits, charmNames } = {}) {
  const armed = armedNames || new Set();
  const toggled = toggledOpts || [];
  const opts = (options || []).filter(o => (o.arms ? armed.has(o.name) : toggled.includes(o.name))).length;
  const sitCount = (toggledSits || []).length + (sits || []).filter(s => s.locked).length;
  return { opts, sits: sitCount, charms: (charmNames || []).length };
}

export function normalizeModTab(v) {
  return MOD_TABS.some(t => t.id === v) ? v : 'opts';
}

// Situational (rules/combat.json) chips are global live conditions held by ed-app
// (session.situations), so the Combat tab's local/remembered `_sits` keeps only
// the OTHER Situational-segment chips (spell-driven ones). Strips any rule
// situation name — e.g. one stored by an older session — harmlessly.
export function localSituationNames(names, situationRules) {
  const rules = new Set((situationRules || []).map(s => s.name));
  return (names || []).filter(n => !rules.has(n));
}
