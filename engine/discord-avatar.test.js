// engine/discord-avatar.test.js — run with `npm test`.
// plans/user-image-discord: optional top-level avatar_url on Discord payloads.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, buildTestPayload } from './discord-roll.js';

const g = (label, rolls) => ({
  label,
  die: Number(label.slice(1)),
  rolls,
  subtotal: rolls.reduce((a, b) => a + b, 0),
  exploded: rolls.length > 1,
});

const rep = {
  label: 'Melee Weapons',
  step: 9,
  dice: 'D10+D6',
  groups: [g('D10', [3]), g('D6', [4])],
  modifier: 0,
  karmaResult: null,
  bonusResult: undefined,
  mods: [],
  total: 7,
  difficulty: null,
  outcome: null,
  aim: null,
};

const AV = 'https://raw.githubusercontent.com/x/y/main/data/chakka.jpg';
const FORMATS = ['plain', 'embed'];
const BAD = [undefined, null, '', '   ', 5, 0, {}, [], true];

for (const format of FORMATS) {
  test(`buildPayload ${format}: avatar_url top-level when given`, () => {
    const p = buildPayload(rep, { name: 'Chakka', format, avatarUrl: AV });
    assert.equal(p.avatar_url, AV);
  });

  test(`buildPayload ${format}: avatar_url is trimmed`, () => {
    const p = buildPayload(rep, { name: 'Chakka', format, avatarUrl: `  ${AV}\n` });
    assert.equal(p.avatar_url, AV);
  });

  test(`buildPayload ${format}: omitted for missing/blank/non-string`, () => {
    for (const v of BAD) {
      const p = buildPayload(rep, { name: 'Chakka', format, avatarUrl: v });
      assert.equal('avatar_url' in p, false, JSON.stringify(v));
    }
    assert.equal('avatar_url' in buildPayload(rep, { name: 'Chakka', format }), false);
  });

  test(`buildPayload ${format}: with-avatar payload equals no-avatar payload plus the key`, () => {
    const without = buildPayload(rep, { name: 'Chakka', format });
    const withAv = buildPayload(rep, { name: 'Chakka', format, avatarUrl: AV });
    const { avatar_url, ...rest } = withAv;
    assert.equal(avatar_url, AV);
    assert.deepEqual(rest, without);
  });

  test(`buildTestPayload ${format}: avatar_url when given, trimmed`, () => {
    assert.equal(buildTestPayload({ name: 'Chakka', format, avatarUrl: AV }).avatar_url, AV);
    assert.equal(buildTestPayload({ name: 'Chakka', format, avatarUrl: ` ${AV} ` }).avatar_url, AV);
  });

  test(`buildTestPayload ${format}: omitted for missing/blank/non-string`, () => {
    for (const v of BAD) {
      const p = buildTestPayload({ name: 'Chakka', format, avatarUrl: v });
      assert.equal('avatar_url' in p, false, JSON.stringify(v));
    }
  });

  test(`buildTestPayload ${format}: other content unchanged by avatar`, () => {
    const without = buildTestPayload({ name: 'Chakka', format });
    const { avatar_url, ...rest } = buildTestPayload({ name: 'Chakka', format, avatarUrl: AV });
    assert.deepEqual(rest, without);
  });
}

test('plain payload keeps the avatar (plain path does not drop it)', () => {
  const p = buildPayload(rep, { name: 'Chakka', format: 'plain', avatarUrl: AV });
  assert.ok('content' in p);
  assert.ok(!('embeds' in p));
  assert.equal(p.avatar_url, AV);
});

test('embed object never contains avatar_url; thumbnail identical with/without avatar', () => {
  const T = 'https://example.test/thumb.png';
  const a = buildPayload(rep, { name: 'Chakka', format: 'embed', thumbnailUrl: T });
  const b = buildPayload(rep, { name: 'Chakka', format: 'embed', thumbnailUrl: T, avatarUrl: AV });
  assert.equal('avatar_url' in b.embeds[0], false);
  assert.deepEqual(b.embeds[0], a.embeds[0]);
  assert.deepEqual(b.embeds[0].thumbnail, { url: T });
  assert.deepEqual(b.allowed_mentions, a.allowed_mentions);
  assert.equal(b.content, a.content);
  assert.equal(b.username, a.username);
});

test('test payload embed variant: avatar not inside embeds', () => {
  const p = buildTestPayload({ name: 'Chakka', format: 'embed', avatarUrl: AV });
  assert.equal(p.avatar_url, AV);
  for (const e of p.embeds ?? []) assert.equal('avatar_url' in e, false);
});

test('avatar_url does not alter the embed (6000 budget unaffected)', () => {
  const big = 'https://example.test/' + 'a'.repeat(3000);
  const a = buildPayload(rep, { name: 'Chakka', format: 'embed' });
  const b = buildPayload(rep, { name: 'Chakka', format: 'embed', avatarUrl: big });
  assert.deepEqual(b.embeds, a.embeds);
});
