// engine/free-talents.js — pure, DOM-free derivation of a Discipline's free talents.
// A free talent is granted by the Discipline at a Circle and its rank equals the
// Discipline's current Circle (PG; docs/RULES-FAQ.md Q036). Derived, never stored.

/**
 * @param {object} ref discipline rules entry ({ circles: [{ circle, freeTalents }] })
 * @param {number} circle the character's Circle in this discipline
 * @param {Set<string>} storedNames names of talents the character stores in the SAME discipline
 * @returns {Array<{name:string, rank:number, circle:number, free:true}>}
 */
export function freeTalentRows(ref, circle, storedNames = new Set()) {
  if (!ref || typeof circle !== 'number' || !Number.isFinite(circle) || circle <= 0) return [];
  const rows = [];
  const circles = [...(ref.circles ?? [])].sort((a, b) => a.circle - b.circle);
  for (const c of circles) {
    if (!(c.circle <= circle)) continue;
    for (const name of c.freeTalents ?? []) {
      if (storedNames.has(name)) continue;
      rows.push({ name, rank: circle, circle: c.circle, free: true });
    }
  }
  return rows;
}
