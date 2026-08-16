// engine/wealth.js — Earthdawn wealth: coin denominations and their silver value,
// plus the derived totals the sheet shows. Pure and DOM-free (ARCHITECTURE §3/§5):
// the character stores only *inputs* (coin counts + gems); the silver value of a
// coin, the running total, and the gem resale figure are all recomputed here and
// never stored (data-model invariant, "store only inputs").
//
// Denominations use Throal/Thera's decimal system — each coin is worth ten times
// the previous — plus the elemental coins (Player's Guide p.404-405):
//   copper 0.1 · silver 1 · gold 10 · earth/water 100 · air/fire 1,000 · orichalcum 10,000 (all in silver).

export const COIN_DENOMINATIONS = [
  { key: 'copper', label: 'Copper', rate: 0.1, elemental: false },
  { key: 'silver', label: 'Silver', rate: 1, elemental: false },
  { key: 'gold', label: 'Gold', rate: 10, elemental: false },
  { key: 'earth', label: 'Earth', rate: 100, elemental: true },
  { key: 'water', label: 'Water', rate: 100, elemental: true },
  { key: 'air', label: 'Air', rate: 1000, elemental: true },
  { key: 'fire', label: 'Fire', rate: 1000, elemental: true },
  { key: 'orichalcum', label: 'Orichalcum', rate: 10000, elemental: true },
];

// Recovered gems fetch ~70–80% of their listed value in coin; use the midpoint as
// the display hint (the full value is what's stored).
export const GEM_RESALE = 0.75;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const int = (v) => Math.max(0, Number.isFinite(Number(v)) ? Math.floor(Number(v)) : 0);

/**
 * Resolve a catalogue `ref.cost` to a silver amount (plan/PLAN-TRADE-ITEMS.md).
 * Numbers pass through; a string may carry a cp/sp suffix ("8 cp" → 0.8 sp),
 * thousands separators ("5,000" → 5000), or a range ("100-175" → midpoint 137.5).
 * Anything unparseable — custom items, strings we don't read — resolves to 0 so
 * the UI never fabricates a price. Copper quantization (whole coins only) is the
 * dialog's job; this stays the single canonical silver value so buy and sell
 * suggestions can never drift apart.
 * @param {number|string|null} cost
 * @returns {number} silver, >= 0
 */
export function parseCostSilver(cost) {
  if (typeof cost === 'number') return Number.isFinite(cost) && cost > 0 ? cost : 0;
  if (typeof cost !== 'string') return 0;
  const s = cost.replace(/,/g, '').trim().toLowerCase();
  if (!s) return 0;
  const range = s.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.max(0, (a + b) / 2);
  }
  const suffixed = s.match(/^([\d.]+)\s*(sp|cp)$/);
  if (suffixed) {
    const n = Number(suffixed[1]);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, suffixed[2] === 'cp' ? n / 10 : n);
  }
  const plain = Number(s);
  return Number.isFinite(plain) && plain > 0 ? plain : 0;
}

/**
 * Subtract a buy allocation (DECISION A): `alloc.coins` counts per denomination
 * and `alloc.gems` a list of `{ name, valueSilver, qty }` are checked against the
 * actually-owned coin counts and gem records, then deducted. Nothing may go
 * negative, so an allocation beyond the purse returns `{ ok: false }` and the
 * inputs are left untouched. Gems are matched by (name, valueSilver) identity —
 * duplicate records are consumed greedily, oldest first.
 * @param {object} coins  owned coin counts ({ copper, silver, … })
 * @param {object[]} gems  owned gem records ([{ name, valueSilver, qty }])
 * @param {{coins?: object, gems?: object[]}} alloc  the player's allocation
 * @returns {{ok: boolean, coins?: object, gems?: object[]}}
 */
export function spendAllocation(coins = {}, gems = [], alloc = {}) {
  const nextCoins = { ...coins };
  for (const c of COIN_DENOMINATIONS) {
    const want = int(alloc.coins?.[c.key]);
    if (!want) continue;
    const owned = int(coins[c.key]);
    if (want > owned) return { ok: false };
    nextCoins[c.key] = owned - want;
  }
  const working = (Array.isArray(gems) ? gems : []).map((g) => ({ ...g }));
  for (const ag of alloc.gems ?? []) {
    if (!ag || typeof ag !== 'object') continue;
    let want = int(ag.qty ?? 1);
    if (!want) continue;
    let i = 0;
    while (want > 0 && i < working.length) {
      const g = working[i];
      if (String(g.name) === String(ag.name) && Number(g.valueSilver) === Number(ag.valueSilver)) {
        const avail = int(g.qty);
        const take = Math.min(avail, want);
        want -= take;
        if (avail - take > 0) working[i] = { ...g, qty: avail - take };
        else { working.splice(i, 1); continue; }
      }
      i++;
    }
    if (want > 0) return { ok: false };
  }
  return { ok: true, coins: nextCoins, gems: working };
}

/**
 * Add a sell allocation (DECISION C): `alloc.coins` increments each denomination
 * and `alloc.gems` (a list of `{ name, valueSilver, qty }`) are credited — each
 * gem merges into an existing identically-named record or appends a new one. Full
 * face `valueSilver` on both sides (gemsSilver unchanged); GEM_RESALE never
 * applies to a trade.
 * @param {object} coins  owned coin counts
 * @param {object[]} gems  owned gem records
 * @param {{coins?: object, gems?: object[]}} alloc
 * @returns {{coins: object, gems: object[]}}
 */
export function creditAllocation(coins = {}, gems = [], alloc = {}) {
  const nextCoins = { ...coins };
  for (const c of COIN_DENOMINATIONS) {
    const add = int(alloc.coins?.[c.key]);
    if (add) nextCoins[c.key] = int(nextCoins[c.key]) + add;
  }
  const nextGems = (Array.isArray(gems) ? gems : []).map((g) => ({ ...g }));
  for (const ag of alloc.gems ?? []) {
    if (!ag || typeof ag !== 'object') continue;
    const qty = Math.max(1, int(ag.qty || 1));
    const idx = nextGems.findIndex((g) => String(g.name) === String(ag.name) && Number(g.valueSilver) === Number(ag.valueSilver));
    if (idx >= 0) nextGems[idx] = { ...nextGems[idx], qty: int(nextGems[idx].qty) + qty };
    else nextGems.push({ name: String(ag.name), valueSilver: int(ag.valueSilver), qty });
  }
  return { coins: nextCoins, gems: nextGems };
}

/** Total silver value of a coins map ({ copper, silver, … }). */
export function coinsSilver(coins = {}) {
  return COIN_DENOMINATIONS.reduce((t, c) => t + num(coins[c.key]) * c.rate, 0);
}

/** Total silver value of a gems array ([{ valueSilver, qty }]). */
export function gemsSilver(gems = []) {
  return (Array.isArray(gems) ? gems : []).reduce((t, g) => t + num(g.valueSilver) * (num(g.qty) || 1), 0);
}

/**
 * Derive the display wealth from the stored inputs. Returns the pass-through
 * inputs (coins, gems) alongside the computed silver totals and the gem resale
 * hint — everything the Equipment view needs, none of it stored.
 */
export function deriveWealth(wealth = {}) {
  const coins = wealth?.coins ?? {};
  const gems = Array.isArray(wealth?.gems) ? wealth.gems : [];
  const coinTotalSilver = coinsSilver(coins);
  const gemTotalSilver = gemsSilver(gems);
  return {
    coins,
    gems,
    denominations: COIN_DENOMINATIONS,
    coinTotalSilver,
    gemTotalSilver,
    totalSilver: coinTotalSilver + gemTotalSilver,
    gemResaleSilver: Math.round(gemTotalSilver * GEM_RESALE),
  };
}
