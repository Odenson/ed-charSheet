// engine/discord-thumbnail.test.js — run with `npm test`.
// plans/thumbnail-in-roll: optional thumbnailUrl on the pure embed builders.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRollEmbed,
  buildEmbedPayload,
  buildPayload,
  buildTestPayload,
  buildWebhookPayload,
} from './discord-roll.js';

const g = (label, rolls) => ({
  label,
  die: Number(label.slice(1)),
  rolls,
  subtotal: rolls.reduce((a, b) => a + b, 0),
  exploded: rolls.length > 1,
});

const base = (over = {}) => ({
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
  ...over,
});

const size = (e) =>
  e.title.length + (e.description?.length ?? 0) + e.fields.reduce((a, f) => a + f.name.length + f.value.length, 0);

const THUMB = 'https://example.test/pic.png';
const rep = base();
const N = { name: 'Chakka' };

test('formatRollEmbed sets embed.thumbnail = {url}', () => {
  const r = formatRollEmbed(rep, { ...N, thumbnailUrl: THUMB });
  assert.deepEqual(r.embed.thumbnail, { url: THUMB });
});

test('url is trimmed', () => {
  const r = formatRollEmbed(rep, { ...N, thumbnailUrl: `  ${THUMB}  ` });
  assert.deepEqual(r.embed.thumbnail, { url: THUMB });
});

test('buildEmbedPayload carries it', () => {
  const p = buildEmbedPayload(rep, { ...N, thumbnailUrl: THUMB });
  assert.deepEqual(p.embeds[0].thumbnail, { url: THUMB });
});

test('buildPayload embed format carries it', () => {
  const p = buildPayload(rep, { ...N, format: 'embed', thumbnailUrl: THUMB });
  assert.deepEqual(p.embeds[0].thumbnail, { url: THUMB });
});

test('buildTestPayload embed format carries it', () => {
  const p = buildTestPayload({ ...N, format: 'embed', thumbnailUrl: THUMB });
  assert.deepEqual(p.embeds[0].thumbnail, { url: THUMB });
});

test('invalid inputs produce no thumbnail key', () => {
  for (const bad of [undefined, '', '   ', null, 5, {}, [], true]) {
    const e = formatRollEmbed(rep, { ...N, thumbnailUrl: bad }).embed;
    assert.equal('thumbnail' in e, false, `bad=${JSON.stringify(bad)}`);
    const t = buildTestPayload({ ...N, format: 'embed', thumbnailUrl: bad });
    assert.equal('thumbnail' in t.embeds[0], false);
  }
});

test('absent url leaves embed deep-equal to before', () => {
  assert.deepEqual(formatRollEmbed(rep, { ...N, thumbnailUrl: undefined }), formatRollEmbed(rep, N));
  assert.deepEqual(
    buildTestPayload({ ...N, format: 'embed' }),
    buildTestPayload({ ...N, format: 'embed', thumbnailUrl: '' }),
  );
});

test('only adds the thumbnail key (other embed fields unchanged)', () => {
  const without = formatRollEmbed(rep, N).embed;
  const { thumbnail, ...rest } = formatRollEmbed(rep, { ...N, thumbnailUrl: THUMB }).embed;
  assert.deepEqual(rest, without);
});

test('plain payloads and webhook payload ignore it', () => {
  const plainA = buildPayload(rep, { ...N, format: 'plain', thumbnailUrl: THUMB });
  assert.deepEqual(plainA, buildPayload(rep, { ...N, format: 'plain' }));
  assert.ok(!JSON.stringify(plainA).includes('thumbnail'));
  const plainT = buildTestPayload({ ...N, format: 'plain', thumbnailUrl: THUMB });
  assert.deepEqual(plainT, buildTestPayload({ ...N, format: 'plain' }));
  assert.ok(!JSON.stringify(plainT).includes('thumbnail'));
  const wh = buildWebhookPayload(rep, { ...N, thumbnailUrl: THUMB });
  assert.ok(!JSON.stringify(wh).includes('thumbnail'));
});

test('a very long url does not change the 6000 text budget', () => {
  const long = 'https://example.test/' + 'a'.repeat(3000) + '.png';
  const big = base({ label: 'X'.repeat(300) });
  const a = formatRollEmbed(big, N).embed;
  const { thumbnail, ...rest } = formatRollEmbed(big, { ...N, thumbnailUrl: long }).embed;
  assert.deepEqual(rest, a);
  assert.ok(size(a) <= 6000);
});
