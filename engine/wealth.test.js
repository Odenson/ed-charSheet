// engine/wealth.test.js — the coin→silver rates and derived wealth totals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coinsSilver, gemsSilver, deriveWealth, GEM_RESALE, COIN_DENOMINATIONS, costSilver, spendAllocation, creditAllocation, allocForSilver } from './wealth.js';

test('coin denominations use the decimal + elemental silver values', () => {
  const rate = Object.fromEntries(COIN_DENOMINATIONS.map((c) => [c.key, c.rate]));
  assert.equal(rate.copper, 0.1);
  assert.equal(rate.silver, 1);
  assert.equal(rate.gold, 10);
  assert.equal(rate.earth, 100);
  assert.equal(rate.water, 100);
  assert.equal(rate.air, 1000);
  assert.equal(rate.fire, 1000);
  assert.equal(rate.orichalcum, 10000);
});

test('coinsSilver sums each denomination by its rate', () => {
  // 40 copper (4) + 1240 silver (1240) + 12 gold (120) = 1364
  assert.equal(coinsSilver({ copper: 40, silver: 1240, gold: 12 }), 1364);
  assert.equal(coinsSilver({ fire: 2, orichalcum: 1 }), 12000);
  assert.equal(coinsSilver({}), 0);
});

test('coinsSilver ignores negatives and non-numbers', () => {
  assert.equal(coinsSilver({ silver: -50, gold: 'x', copper: 10 }), 1);
});

test('gemsSilver multiplies value by quantity, defaulting qty to 1', () => {
  assert.equal(gemsSilver([{ valueSilver: 150 }, { valueSilver: 75, qty: 2 }]), 300);
  assert.equal(gemsSilver([]), 0);
  assert.equal(gemsSilver(undefined), 0);
});

test('allocForSilver splits a whole-copper amount into silver then copper', () => {
  assert.deepEqual(allocForSilver(0), { coins: {} });
  assert.deepEqual(allocForSilver(100), { coins: { silver: 100 } });   // Circle × 100 — the learn price
  assert.deepEqual(allocForSilver(0.7), { coins: { copper: 7 } });     // 0.7 sp = 7 cp
  assert.deepEqual(allocForSilver(2.3), { coins: { silver: 2, copper: 3 } });
  assert.deepEqual(allocForSilver(0), { coins: {} });
});

test('allocForSilver feeds spendAllocation (defensive: returns ok:false when coins are short)', () => {
  const coins = { silver: 3, copper: 10 };
  const ok = spendAllocation(coins, [], allocForSilver(2.5));
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.coins, { silver: 1, copper: 5 });
  const short = spendAllocation(coins, [], allocForSilver(50));
  assert.equal(short.ok, false);
});

test('deriveWealth reports coin, gem, total and resale figures', () => {
  const w = deriveWealth({
    coins: { copper: 40, silver: 1240, gold: 12 },
    gems: [{ valueSilver: 150, qty: 1 }, { valueSilver: 75, qty: 2 }],
  });
  assert.equal(w.coinTotalSilver, 1364);
  assert.equal(w.gemTotalSilver, 300);
  assert.equal(w.totalSilver, 1664);
  assert.equal(w.gemResaleSilver, Math.round(300 * GEM_RESALE)); // 225
});

test('deriveWealth is safe on an absent/empty wealth input', () => {
  const w = deriveWealth();
  assert.equal(w.totalSilver, 0);
  assert.deepEqual(w.gems, []);
  assert.equal(w.denominations.length, 8);
});

// --- trade engine (plans/PLAN-TRADE-ITEMS.md) ---

test('costSilver: numbers pass through, non-positive resolves to 0', () => {
  assert.equal(costSilver(42), 42);
  assert.equal(costSilver(0), 0);
  assert.equal(costSilver(-5), 0);
  assert.equal(costSilver(1.5), 1.5);
});

test('costSilver: the migrated catalogue values resolve to their silver totals', () => {
  assert.equal(costSilver(0.8), 0.8); // migrated "8 cp" → 0.8
  assert.equal(costSilver(15), 15); // migrated "15 sp" → 15
  assert.equal(costSilver(5000), 5000); // migrated "5,000" → 5000
  assert.equal(costSilver(137.5), 137.5); // migrated "100-175" → midpoint 137.5
  assert.equal(costSilver(1500), 1500); // migrated "1,000-2,000" → 1500
});

test('costSilver: non-numbers resolve to 0 (never a fabricated price)', () => {
  assert.equal(costSilver('8 cp'), 0); // stale legacy string — no longer parsed
  assert.equal(costSilver('custom bones'), 0);
  assert.equal(costSilver(''), 0);
  assert.equal(costSilver(null), 0);
  assert.equal(costSilver(undefined), 0);
});

test('spendAllocation deducts whole coins within the owned purse', () => {
  const r = spendAllocation({ copper: 40, silver: 5, gold: 12 }, [], { coins: { copper: 40, silver: 5 } });
  assert.equal(r.ok, true);
  assert.equal(r.coins.copper, 0);
  assert.equal(r.coins.silver, 0);
  assert.equal(r.coins.gold, 12); // untouched
  assert.deepEqual(r.gems, []);
});

test('spendAllocation refuses an allocation beyond the purse', () => {
  const r = spendAllocation({ silver: 5 }, [], { coins: { silver: 6 } });
  assert.equal(r.ok, false);
  assert.equal(r.coins, undefined); // inputs untouched on failure
});

test('spendAllocation spends owned gems by identity, oldest first, drops at 0', () => {
  const gems = [
    { name: 'Emerald', valueSilver: 100, qty: 2 },
    { name: 'Emerald', valueSilver: 100, qty: 3 },
    { name: 'Sapphire', valueSilver: 250, qty: 1 },
  ];
  const r = spendAllocation({}, gems, { gems: [{ name: 'Emerald', valueSilver: 100, qty: 4 }] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.gems, [{ name: 'Emerald', valueSilver: 100, qty: 1 }, { name: 'Sapphire', valueSilver: 250, qty: 1 }]);
  const r2 = spendAllocation({}, gems, { gems: [{ name: 'Emerald', valueSilver: 100, qty: 6 }] });
  assert.equal(r2.ok, false);
});

test('creditAllocation increments coins and merges/re-appends gems by identity', () => {
  const r = creditAllocation({ silver: 5 }, [{ name: 'Emerald', valueSilver: 100, qty: 2 }], {
    coins: { silver: 137, gold: 13, copper: 5 },
    gems: [{ name: 'Emerald', valueSilver: 100, qty: 3 }, { name: 'Ruby', valueSilver: 500, qty: 1 }],
  });
  assert.equal(r.coins.silver, 142);
  assert.equal(r.coins.gold, 13);
  assert.equal(r.coins.copper, 5);
  assert.deepEqual(r.gems, [
    { name: 'Emerald', valueSilver: 100, qty: 5 },
    { name: 'Ruby', valueSilver: 500, qty: 1 },
  ]);
});
