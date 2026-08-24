// store-log.js — standard device-local Log (Notes → Log) for app actions.
// One place for every system/action log entry so Legends, silver, and coin
// deltas format consistently. Device-local via store-rolllog's ed-rolllog key;
// never rides the edits overlay or a GitHub save (high-churn, ephemeral).
// Each entry gets a unique rollId so it never collides with roll upserts.

import { saveRollLog } from './store-rolllog.js';
import { coinsSilver, COIN_DENOMINATIONS } from './engine/wealth.js';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Per-coin net delta between two coin maps — e.g. "(-10 copper, -299 silver)".
 * Negative = spent, positive = change returned. Empty string if no net change.
 * @param {object} before
 * @param {object} after
 * @returns {string} " (-5 gold, -450 silver)" or ""
 */
export function formatCoinDelta(before = {}, after = {}) {
  const parts = [];
  for (const { key, label } of COIN_DENOMINATIONS) {
    const b = Math.floor(Number(before[key]) || 0);
    const a = Math.floor(Number(after[key]) || 0);
    const d = a - b;
    if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d} ${label.toLowerCase()}`);
  }
  return parts.length ? ` (${parts.join(', ')})` : '';
}

/**
 * Wealth detail string for a silver fee, including per-coin delta and purse totals.
 * @param {number} fee silver fee (0 = no fee)
 * @param {object} beforeCoins
 * @param {object} afterCoins
 * @returns {string}
 */
export function formatWealthDetail(fee, beforeCoins = {}, afterCoins = {}) {
  if (!fee || fee <= 0) return 'no silver fee';
  const delta = formatCoinDelta(beforeCoins, afterCoins);
  const before = Math.round(coinsSilver(beforeCoins));
  const after = Math.round(coinsSilver(afterCoins));
  return `paid ${fee} sp training fee${delta} · purse ${before} → ${after} sp`;
}

/**
 * Low-level system log writer — use for any app action that should appear in
 * Notes → Log alongside rolls. Generates uid + timestamp, persists via saveRollLog.
 * @param {string} characterId
 * @param {object} fields label, detail, legendCost, silverFee, grants, etc.
 * @returns {object} saved log state
 */
export function logSystem(characterId, fields = {}) {
  if (!characterId) return null;
  const entry = {
    rollId: uid(),
    at: new Date().toISOString(),
    kind: 'system',
    ...fields,
  };
  return saveRollLog(entry, characterId);
}

/**
 * Log a Circle training (PLAN-LEARN-TALENTS): grants, Legend, silver + coin delta.
 * @param {string} characterId
 * @param {object} p discipline, circle, grants, legendCost, silverFee, beforeCoins, afterCoins
 */
export function logCircleTraining(characterId, { discipline, circle, grants = [], legendCost = null, silverFee = 0, beforeCoins = {}, afterCoins = {} }) {
  const feeDetail = silverFee > 0 ? formatWealthDetail(silverFee, beforeCoins, afterCoins) : 'no silver fee';
  const detail = grants.length ? `Learned ${grants.join(', ')} at Rank 1 · ${feeDetail}` : feeDetail;
  const before = Math.round(coinsSilver(beforeCoins));
  const after = silverFee > 0 ? Math.round(coinsSilver(afterCoins)) : before;
  return logSystem(characterId, {
    label: `Trained ${discipline} to Circle ${circle}`,
    detail,
    discipline,
    circle,
    grants,
    legendCost,
    silverFee,
    coinDelta: formatCoinDelta(beforeCoins, afterCoins).trim(),
    purseBefore: before,
    purseAfter: after,
  });
}

/**
 * Log learning a Talent Option (or similar single-talent acquire at Rank 1).
 */
export function logTalentLearned(characterId, { discipline, name, circle, legendCost = null }) {
  return logSystem(characterId, {
    label: `Learned ${name} (${discipline} · Circle ${circle})`,
    detail: `Talent Option · Rank 1`,
    discipline,
    circle,
    grants: [name],
    legendCost,
    silverFee: 0,
  });
}

/**
 * Log learning a new Skill at Rank 1 (PLAN-LEARN-SKILLS). Legend from
 * skillRank[1][tier]; silver from skillTraining[1] (data, not code).
 */
export function logSkillLearned(characterId, { name, tier, legendCost = null, silverFee = 0, beforeCoins = {}, afterCoins = {} }) {
  const feeDetail = silverFee > 0 ? formatWealthDetail(silverFee, beforeCoins, afterCoins) : 'no silver fee';
  const detail = `Skill · Rank 1 · ${tier ?? 'Novice'} · ${feeDetail}`;
  const before = Math.round(coinsSilver(beforeCoins));
  const after = silverFee > 0 ? Math.round(coinsSilver(afterCoins)) : before;
  return logSystem(characterId, {
    label: `Learned ${name} (Skill · ${tier ?? 'Novice'})`,
    detail,
    grants: [name],
    tier,
    legendCost,
    silverFee,
    coinDelta: formatCoinDelta(beforeCoins, afterCoins).trim(),
    purseBefore: before,
    purseAfter: after,
  });
}

/**
 * Diff two item input arrays (store shape {name, equipped, threadRank?, qty?})
 * and describe adds/removes/equips/thread changes in human terms.
 * @param {Array} before
 * @param {Array} after
 * @returns {{added: string[], removed: string[], toggled: string[], threadChanges: string[]}}
 */
export function diffItems(before = [], after = []) {
  const byName = (arr) => new Map(arr.map((i) => [i.name, i]));
  const b = byName(before);
  const a = byName(after);
  const added = [];
  const removed = [];
  const toggled = [];
  const threadChanges = [];
  for (const [name, it] of a) if (!b.has(name)) added.push(name);
  for (const [name] of b) if (!a.has(name)) removed.push(name);
  for (const [name, it] of a) {
    const prev = b.get(name);
    if (!prev) continue;
    if (!!prev.equipped !== !!it.equipped) toggled.push(`${name} → ${it.equipped ? 'equipped' : 'stored'}`);
    const br = prev.threadRank ?? 0;
    const ar = it.threadRank ?? 0;
    if (br !== ar) threadChanges.push(`${name}: Thread ${br} → ${ar}`);
    const bq = prev.qty ?? 1;
    const aq = it.qty ?? 1;
    if (bq !== aq) threadChanges.push(`${name}: ×${bq} → ×${aq}`);
  }
  return { added, removed, toggled, threadChanges };
}

/**
 * Log an equipment change (adds, removes, equip toggles, thread weaves).
 * Computes Legend-relevant thread detail via optional threadCost helper if supplied.
 */
export function logEquipmentChange(characterId, { beforeItems = [], afterItems = [], legendCost = null, beforeCoins = null, afterCoins = null, silverFee = null }) {
  const { added, removed, toggled, threadChanges } = diffItems(beforeItems, afterItems);
  const parts = [];
  if (added.length) parts.push(`+ ${added.join(', ')}`);
  if (removed.length) parts.push(`− ${removed.join(', ')}`);
  if (toggled.length) parts.push(toggled.join('; '));
  if (threadChanges.length) parts.push(threadChanges.join('; '));
  const label = added.length || removed.length ? 'Equipment changed' : threadChanges.length ? 'Thread woven' : 'Equipment updated';
  const detail = parts.length ? parts.join(' · ') : 'no net change';
  const coinDelta = beforeCoins && afterCoins ? formatCoinDelta(beforeCoins, afterCoins).trim() : '';
  const purseBefore = beforeCoins ? Math.round(coinsSilver(beforeCoins)) : null;
  const purseAfter = afterCoins ? Math.round(coinsSilver(afterCoins)) : null;
  return logSystem(characterId, {
    label,
    detail,
    legendCost,
    silverFee,
    coinDelta,
    purseBefore,
    purseAfter,
    added,
    removed,
    toggled,
    threadChanges,
  });
}

/**
 * Log a New Day reset — recoveries, damage, wounds, combat clear.
 * @param {string} characterId
 * @param {object} p beforeHealth, afterHealth, maxRecoveries, source, pendingCleared, knockdownCleared, combatCleared
 */
export function logNewDay(characterId, { beforeHealth = {}, afterHealth = {}, maxRecoveries = null, source = null, pendingCleared = false, knockdownCleared = false, combatCleared = false }) {
  const bDmg = Number(beforeHealth.damage) || 0;
  const aDmg = Number(afterHealth.damage) || 0;
  const bW = Number(beforeHealth.wounds) || 0;
  const aW = Number(afterHealth.wounds) || 0;
  const bUsed = Number(beforeHealth.recoveriesUsed) || 0;
  const aUsed = Number(afterHealth.recoveriesUsed) || 0;
  const dmgHealed = Math.max(0, bDmg - aDmg);
  const woundsHealed = Math.max(0, bW - aW);
  // Recoveries spent during the loop = beforeUsed + additional used before reset - afterUsed
  // After is 0, so spent = total used before reset (if finalize after spends)
  // We can infer spent from damage/wound heals + reset, but simplest: beforeUsed → 0 means all were reset;
  // spent count is not directly known here, so derive from healed amounts where possible
  const parts = [];
  if (dmgHealed > 0) parts.push(`healed ${dmgHealed} damage`);
  if (woundsHealed > 0) parts.push(`healed ${woundsHealed} wound${woundsHealed === 1 ? '' : 's'}`);
  if (bUsed !== aUsed) parts.push(`Recoveries ${bUsed} → ${aUsed}${maxRecoveries != null ? `/${maxRecoveries}` : ''}`);
  else if (maxRecoveries != null) parts.push(`Recoveries ${aUsed}/${maxRecoveries} reset`);
  if (pendingCleared) parts.push('healing boost cleared');
  if (knockdownCleared) parts.push('knockdown cleared');
  if (combatCleared) parts.push('combat options cleared');
  const detail = parts.length ? parts.join(' · ') : 'no damage or wounds to heal';
  const label = source ? `New day (${source})` : 'New day — Recovery tests reset';
  return logSystem(characterId, {
    label,
    detail,
    beforeHealth,
    afterHealth,
    maxRecoveries,
    damageHealed: dmgHealed,
    woundsHealed,
    recoveriesBefore: bUsed,
    recoveriesAfter: aUsed,
  });
}

/**
 * Log a trade (buy/sell) — items + purse move atomically via ed-trade.
 */
export function logTrade(characterId, { mode, itemName, amount, beforeItems = [], afterItems = [], beforeCoins = {}, afterCoins = {}, beforeGems = [], afterGems = [] }) {
  const { added, removed, toggled, threadChanges } = diffItems(beforeItems, afterItems);
  const verb = mode === 'buy' ? 'Bought' : 'Sold';
  const price = typeof amount === 'number' ? `${amount} sp` : '';
  const delta = formatCoinDelta(beforeCoins, afterCoins).trim();
  const detail = `${verb} ${itemName}${price ? ` for ${price}` : ''}${delta ? ` ${delta}` : ''}${threadChanges.length ? ` · ${threadChanges.join('; ')}` : ''}`;
  return logSystem(characterId, {
    label: `${verb} ${itemName}`,
    detail,
    grants: added,
    legendCost: null,
    silverFee: mode === 'buy' ? amount : -amount,
    coinDelta: delta,
    purseBefore: Math.round(coinsSilver(beforeCoins)),
    purseAfter: Math.round(coinsSilver(afterCoins)),
    mode,
    itemName,
    amount,
    threadChanges,
  });
}
