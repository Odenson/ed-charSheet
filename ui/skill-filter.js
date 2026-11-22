// ui/skill-filter.js — pure category-chip filter shared by both skill pickers
// (plans/gen-skill-other I7). No DOM, no state: the pickers own which chip is selected.

export const SKILL_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'artisan', label: 'Artisan' },
  { id: 'language-speak', label: 'Speak Language' },
  { id: 'language-readwrite', label: 'Read/Write Language' },
  { id: 'general', label: 'General' },
  { id: 'custom', label: 'Custom' },
];

const NON_GENERAL = new Set(['knowledge', 'artisan', 'language-speak', 'language-readwrite']);

/**
 * Does `item` (a picker option / creation candidate with `category`, `custom`) show under chip `chipId`?
 * Quick-add free-text rows carry their own category and no `custom`, so they show under All and
 * their category chip and are hidden under Custom.
 */
export function chipMatches(chipId, item) {
  if (chipId === 'all') return true;
  if (chipId === 'custom') return item?.custom === true;
  if (chipId === 'general') return !NON_GENERAL.has(item?.category);
  return item?.category === chipId;
}
