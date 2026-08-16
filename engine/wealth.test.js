// engine/wealth.test.js — the coin→silver rates and derived wealth totals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coinsSilver, gemsSilver, deriveWealth, GEM_RESALE, COIN_DENOMINATIONS, parseCostSilver, spendAllocation, creditAllocation } from './wealth.js';

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

test('parseCostSilver: numbers pass through, non-positive resolves to 0', () => {
  assert.equal(parseCostSilver(42), 42);
  assert.equal(parseCostSilver(0), 0);
  assert.equal(parseCostSilver(-5), 0);
  assert.equal(parseCostSilver(1.5), 1.5);
});

test('parseCostSilver: cp/sp suffixes resolve to silver', () => {
  assert.equal(parseCostSilver('8 cp'), 0.8); // exactly 8 copper
  assert.equal(parseCostSilver('3 cp'), 0.3);
  assert.equal(parseCostSilver('15 sp'), 15);
  assert.equal(parseCostSilver(' 8 cp '), 0.8);
});

test('parseCostSilver handles thousands separators and ranges', () => {
  assert.equal(parseCostSilver('5,000'), 5000);
  assert.equal(parseCostSilver('100-175'), 137.5); // midpoint
  assert.equal(parseCostSilver('1,000-2,000'), 1500);
});

test('parseCostSilver: unparseable strings resolve to 0 (never a fabricated price)', () => {
  assert.equal(parseCostSilver('custom bones'), 0);
  assert.equal(parseCostSilver(''), 0);
  assert.equal(parseCostSilver(null), 0);
  assert.equal(parseCostSilver(undefined), 0);
  assert.equal(parseCostSilver('1.5 dkp'), 0);
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
