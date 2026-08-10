// ui/item-equip-state.js — pure, DOM-free equip-state decisions for the
// Equipment tab. One rule lives here: only ONE set of armour may be worn, so
// equipping a second armour must be an explicit swap — the UI prompts, this
// module computes the next `{ name, equipped }` input list. The module never
// fetches or owns catalogs: the caller passes a `kindOf` resolver so an item's
// kind (canon or player-created custom armour) is decided outside.
//
// No game values are computed here — equipped/stored is an input, and this
// module only reshapes those inputs (the engine derives the effects from
// whatever ends up equipped). Mirrors the custom-item-state.js pattern: the
// component (ui/ed-equipment.js) delegates here so the decisions are testable
// without a DOM.

/**
 * Compute the next item inputs for an equip action. Returns
 * `{ blocked: true }` when the action would leave a second armour worn — the
 * caller should prompt the swap before applying — or `{ blocked: false, items }`
 * with the next input list ready to dispatch.
 *
 * @param {Array<{name:string, equipped:boolean}>} items  current inputs
 * @param {(name:string)=>string|null} kindOf  resolve an item's kind ('armor' competes)
 * @param {string} name  the item being equipped
 * @param {'add'|'toggle'} via  'add' appends equipped; 'toggle' flips the flag
 */
export function equipArmour(items, kindOf, name, via) {
  const next =
    via === 'add'
      ? [...items, { name, equipped: true }]
      : items.map((i) => (i.name === name ? { ...i, equipped: !i.equipped } : i));

  // Only armours compete for the single worn slot — a shield, a helm-as-gear,
  // or any non-armour never blocks.
  if (kindOf(name) !== 'armor') return { blocked: false, items: next };

  const otherWornArmour = next.some((i) => i.name !== name && kindOf(i.name) === 'armor' && i.equipped);

  if (via === 'toggle') {
    // Storing the worn armour never blocks; only equipping a SECOND armour does.
    const wasEquipped = items.find((i) => i.name === name)?.equipped;
    if (!wasEquipped && otherWornArmour) return { blocked: true };
    return { blocked: false, items: next };
  }

  if (otherWornArmour) return { blocked: true };
  return { blocked: false, items: next };
}

/**
 * Apply a confirmed swap: `name` ends up equipped and every OTHER armour is
 * stored. `via` must match the blocked action ('add' appends the new entry,
 * 'toggle' flips the existing one). Returns the next input list.
 *
 * @param {Array<{name:string, equipped:boolean}>} items  current inputs
 * @param {(name:string)=>string|null} kindOf  resolve an item's kind
 * @param {string} name  the armour being equipped
 * @param {'add'|'toggle'} via  the equip action being confirmed
 */
export function applyArmourSwap(items, kindOf, name, via) {
  const stored = items.map((i) => (i.name !== name && kindOf(i.name) === 'armor' ? { ...i, equipped: false } : i));
  if (via === 'add') return [...stored, { name, equipped: true }];
  return stored.map((i) => (i.name === name ? { ...i, equipped: true } : i));
}
