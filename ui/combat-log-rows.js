// ui/combat-log-rows.js — pure, DOM-free mapping of a roll-log entry to the
// Combat tab log table's cells. UI mapping only (no Earthdawn rule). A missing
// value is "—", never a fabricated number (UI-GUIDELINES §5).

const DASH = '—';

// Signed flat modifier, e.g. "Knocked Down −3"; a modifier with no numeric value
// shows its label alone.
function modText(m) {
  const v = Number(m?.value);
  if (m?.value == null || !Number.isFinite(v)) return m?.label ?? '';
  return `${m.label} ${v < 0 ? '−' : '+'}${Math.abs(v)}`;
}

export function logRowCells(entry) {
  const r = entry ?? {};
  if (r.kind === 'system' || r.kind === 'log' || r.kind === 'advancement') {
    const parts = [];
    if (r.detail) parts.push(String(r.detail));
    if (r.legendCost != null) parts.push(`${r.legendCost} Legend`);
    if (r.silverFee != null && r.silverFee > 0) parts.push(`${r.silverFee} sp`);
    if (r.coinDelta) parts.push(String(r.coinDelta));
    return { glyph: '✦', roll: r.label ?? 'System', step: DASH, total: DASH, vs: DASH, outcome: null, detail: parts.join(' · ') };
  }
  if (r.kind === 'action') {
    return { glyph: '↑', roll: r.label ?? 'Action', step: DASH, total: DASH, vs: DASH, outcome: null, detail: '' };
  }
  return {
    glyph: /attack|damage/i.test(r.label ?? '') ? '⚔' : '⚄',
    roll: r.label ?? 'Roll',
    step: r.step != null ? String(r.step) : DASH,
    total: r.total != null ? String(r.total) : DASH,
    vs: r.difficulty != null ? String(r.difficulty) : DASH,
    outcome: r.outcome ? { word: r.outcome.word, ok: !!r.outcome.ok } : null,
    // Detail: Karma die spent, then the roll-time flat modifiers — data the entry
    // already stores, nothing derived.
    detail: [
      r.karma?.total != null ? `Karma +${r.karma.total}` : '',
      // Bonus Dice (e.g. Night's Edge's D4) are their own group, absent on older entries.
      r.bonusResult?.total != null && Number.isFinite(Number(r.bonusResult.total)) ? `Bonus die +${r.bonusResult.total}` : '',
      ...(r.mods ?? []).map(modText),
    ].filter(Boolean).join(' · '),
  };
}
