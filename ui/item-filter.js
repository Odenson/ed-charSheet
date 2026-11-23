// ui/item-filter.js — pure type-chip filter for the Equipment add-item picker
// (mirrors ui/skill-filter.js). No DOM, no state: the picker owns which chip is
// selected. Presentation logic only — it never computes a game value.

// Section / chip order for the picker. `custom` is a pseudo-kind (player-made
// items, any real kind); the rest are the catalog `kind` values.
export const ITEM_KIND_ORDER = [
  'weapon', 'armor', 'shield', 'ammunition',
  'gear', 'magic-item', 'blood-charm', 'healing-aid', 'thread-item',
];

/**
 * Does `item` ({ kind, custom }) show under chip `chipId`?
 * 'all' shows everything, 'custom' only player-made items, a kind id only that kind.
 */
export function itemChipMatches(chipId, item) {
  if (chipId === 'all') return true;
  if (chipId === 'custom') return item?.custom === true;
  return item?.kind === chipId;
}
