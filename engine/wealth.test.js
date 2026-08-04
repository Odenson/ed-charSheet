// engine/wealth.test.js — the coin→silver rates and derived wealth totals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coinsSilver, gemsSilver, deriveWealth, GEM_RESALE, COIN_DENOMINATIONS } from './wealth.js';

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
