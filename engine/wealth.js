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
