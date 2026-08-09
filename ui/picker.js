// ui/picker.js — pure, DOM-free picker selection shared by the Equipment tab
// (ui/ed-equipment.js) and its regression test (picker.test.js). Presentation
// logic only: it orders and caps *catalog* keys for the add-picker — it never
// mutates state or computes a game value, so the Tier-1 architecture rule
// (engine pure and DOM-free; UI never derives values) is untouched.
//
// The rule that matters (docs/PLAN-CUSTOM-ITEMS.md §6.6 P8.4): the merged
// `itemCatalog` appends player-created items AFTER ~179 canon entries
// (store.js) and the picker caps results at PICKER_CAP — so without
// prioritisation a freshly saved custom item would sit past the cap and never
// appear in the browse list. Custom items sort FIRST instead.
export const PICKER_CAP = 50;

export const PICKER_LABELS = {
  weapon: 'Weapon', armor: 'Armour', shield: 'Shield', ammunition: 'Ammunition',
  gear: 'Gear', 'magic-item': 'Magic item', 'blood-charm': 'Blood charm',
  'healing-aid': 'Healing aid', 'thread-item': 'Thread item',
};

const kindLabel = (kind) => PICKER_LABELS[kind] ?? '';

// The catalog keys the add-picker should offer, in order: filtered by `query`
// against name / kind label / effect summaries, custom items first, then capped.
//   catalog      — the merged { canon, custom, thread } catalog from the model
//   customNames  — keys of model.customCatalog (player-created items)
//   query        — the picker's raw input; '' / whitespace means "browse all"
export function pickItemKeys({ catalog, customNames = [], query = '' }) {
  const custom = new Set(customNames);
  const q = query.trim().toLowerCase();
  return Object.keys(catalog)
    .filter((n) => {
      if (!q) return true;
      const it = catalog[n];
      // Effect entries are objects carrying a `summary`; reduce every catalog
      // shape (plain `effects`, thread `base`/`threadRanks`) to strings first,
      // so the search always compares text.
      const summaries = [
        ...(it.effects ?? []).map((e) => e.summary ?? ''),
        ...(it.base?.effects ?? []).map((e) => e.summary ?? ''),
        ...(it.threadRanks ?? []).flatMap((r) => r.effects ?? []).map((e) => e.summary ?? ''),
      ];
      return n.toLowerCase().includes(q) || kindLabel(it.kind).toLowerCase().includes(q) ||
        summaries.some((s) => s.toLowerCase().includes(q));
    })
    .sort((a, b) => Number(custom.has(b)) - Number(custom.has(a)))
    .slice(0, PICKER_CAP);
}
