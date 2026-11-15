import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIE_VIEWBOX, DIE_FRAME, DIE_PIPS, DIE_PIP_R } from './dice-geometry.js';

const C = DIE_VIEWBOX / 2;

test('die frame is centred in the viewBox', () => {
  assert.equal(DIE_FRAME.x + DIE_FRAME.size / 2, C);
  assert.equal(DIE_FRAME.y + DIE_FRAME.size / 2, C);
});

test('five pips, point-symmetric about the centre, inside the frame', () => {
  assert.equal(DIE_PIPS.length, 5);
  for (const [x, y] of DIE_PIPS) {
    assert.ok(DIE_PIPS.some(([a, b]) => a === 2 * C - x && b === 2 * C - y), `no mirror for ${x},${y}`);
    assert.ok(x - DIE_PIP_R > DIE_FRAME.x && x + DIE_PIP_R < DIE_FRAME.x + DIE_FRAME.size);
    assert.ok(y - DIE_PIP_R > DIE_FRAME.y && y + DIE_PIP_R < DIE_FRAME.y + DIE_FRAME.size);
  }
});
