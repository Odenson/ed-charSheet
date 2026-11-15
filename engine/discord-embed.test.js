// engine/discord-embed.test.js — run with `npm test`.
// Pure Discord embed formatter (plans/embedded-die-roll). No Earthdawn rule
// values are asserted; limits and colours are Discord/design constants and all
// expected values are literals derived from the fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRollEmbed,
  buildEmbedPayload,
  buildPayload,
  buildTestPayload,
  buildWebhookPayload,
  escapeDiscord,
} from './discord-roll.js';

const ZWSP = '​';
const GREEN = 0x2ecc71;
const RED = 0xe74c3c;
const GREY = 0x95a5a6;

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

const NAME = { name: 'Chakka' };
const emb = (report, opts = NAME) => buildEmbedPayload(report, opts).embeds[0];
const field = (e, name) => e.fields.find((f) => f.name === name);
const size = (e) =>
  e.title.length + (e.description?.length ?? 0) + e.fields.reduce((a, f) => a + f.name.length + f.value.length, 0);

test('formatRollEmbed returns {username, embed}', () => {
  const r = formatRollEmbed(base(), NAME);
  assert.equal(r.username, 'Chakka');
  assert.equal(r.embed.title, '🎲 Melee Weapons — Step 9 · Total 7');
});

test('plain roll: title, dice field, no description, grey, no other fields', () => {
  const e = emb(base());
  assert.equal(e.title, '🎲 Melee Weapons — Step 9 · Total 7');
  assert.ok(e.description === undefined);
  assert.equal(e.color, GREY);
  assert.deepEqual(e.fields, [{ name: 'Dice', value: 'D10 [3] = 3 · D6 [4] = 4', inline: false }]);
});

test('exploding chains and modifier in the Dice field', () => {
  const e = emb(base({ groups: [g('D10', [10, 7]), g('D6', [3])], modifier: 2, total: 22 }));
  assert.equal(field(e, 'Dice').value, 'D10 [10↦7] = 17 · D6 [3] = 3 · Modifier +2');
  const neg = emb(base({ modifier: -1 }));
  assert.equal(field(neg, 'Dice').value, 'D10 [3] = 3 · D6 [4] = 4 · Modifier -1');
  const zero = emb(base({ modifier: 0 }));
  assert.ok(!field(zero, 'Dice').value.includes('Modifier'));
});

test('Karma field: single group, inline', () => {
  const e = emb(base({ karmaResult: { groups: [g('D6', [4])], total: 4 } }));
  assert.deepEqual(field(e, '✦ Karma'), { name: '✦ Karma', value: 'D6 [4] = 4', inline: true });
});

test('Karma field: several groups add the Karma total', () => {
  const e = emb(base({ karmaResult: { groups: [g('D6', [4]), g('D4', [2])], total: 6 } }));
  assert.equal(field(e, '✦ Karma').value, 'D6 [4] = 4 · D4 [2] = 2 · Karma total = 6');
});

test('Bonus dice field, inline', () => {
  const e = emb(base({ bonusResult: { dice: [{ sides: 8, rolls: [3, 5] }, { sides: 6, rolls: [2] }], total: 10 } }));
  assert.deepEqual(field(e, 'Bonus dice'), { name: 'Bonus dice', value: 'D8 [3↦5] · D6 [2] = 10', inline: true });
});

test('Mods field: Step mods tagged, result mods not, full width', () => {
  const e = emb(
    base({
      mods: [
        { label: 'Aim', value: 2, measure: 'step' },
        { label: 'Cover', value: -1 },
      ],
    }),
  );
  assert.deepEqual(field(e, 'Mods'), { name: 'Mods', value: 'Aim +2 Step · Cover -1', inline: false });
});

test('field order is Dice, Karma, Bonus dice, Mods', () => {
  const e = emb(
    base({
      karmaResult: { groups: [g('D6', [4])], total: 4 },
      bonusResult: { dice: [{ sides: 8, rolls: [3] }], total: 3 },
      mods: [{ label: 'Aim', value: 1 }],
    }),
  );
  assert.deepEqual(
    e.fields.map((f) => f.name),
    ['Dice', '✦ Karma', 'Bonus dice', 'Mods'],
  );
});

test('empty karma / bonus / mods / groups produce no fields', () => {
  const e = emb(base({ groups: [], karmaResult: { groups: [] }, bonusResult: { dice: [] }, mods: [] }));
  assert.deepEqual(e.fields, []);
});

test('difficulty success: description and green', () => {
  const e = emb(base({ difficulty: 8, outcome: { ok: true, word: 'Success' } }));
  assert.equal(e.description, 'vs Difficulty 8 — **Success** ✅');
  assert.equal(e.color, GREEN);
});

test('difficulty failure: description and red', () => {
  const e = emb(base({ difficulty: 8, outcome: { ok: false, word: 'Failure' } }));
  assert.equal(e.description, 'vs Difficulty 8 — **Failure** ❌');
  assert.equal(e.color, RED);
});

test('difficulty without outcome: description only, grey', () => {
  const e = emb(base({ difficulty: 8 }));
  assert.equal(e.description, 'vs Difficulty 8');
  assert.equal(e.color, GREY);
});

test('outcome without difficulty: just the word', () => {
  const e = emb(base({ outcome: { ok: true, word: 'Success' } }));
  assert.equal(e.description, '**Success** ✅');
  assert.equal(e.color, GREEN);
});

test('aim roll: Defence wording, default Mystic', () => {
  const a = emb(base({ difficulty: 8, aim: { vs: 'Physical' }, outcome: { ok: true, word: 'Hit' } }));
  assert.equal(a.description, 'vs Physical Defence 8 — **Hit** ✅');
  const m = emb(base({ difficulty: 8, aim: {}, outcome: { ok: false, word: 'Miss' } }));
  assert.equal(m.description, 'vs Mystic Defence 8 — **Miss** ❌');
});

test('custom win/lose words are shown, capped at 200', () => {
  const e = emb(base({ difficulty: 5, outcome: { ok: true, word: 'Glorious' } }));
  assert.ok(e.description.includes('**Glorious**'));
  const long = emb(base({ difficulty: 5, outcome: { ok: true, word: 'w'.repeat(500) } }));
  assert.ok(long.description.length < 300);
});

test('mentions and markdown are neutralised in title, description and fields', () => {
  const p = buildEmbedPayload(
    base({
      label: '@everyone *hi*',
      difficulty: 3,
      aim: { vs: '@here <@123>' },
      outcome: { ok: true, word: '@everyone' },
      mods: [{ label: '@here', value: 1 }],
    }),
    NAME,
  );
  const s = JSON.stringify(p);
  assert.ok(!s.includes('@everyone'));
  assert.ok(!s.includes('@here'));
  assert.ok(!s.includes('<@1'));
  assert.ok(p.embeds[0].title.includes(`@${ZWSP}everyone`));
  assert.ok(p.embeds[0].title.includes('\\*hi\\*'));
  assert.ok(field(p.embeds[0], 'Mods').value.includes(`@${ZWSP}here`));
  assert.deepEqual(p.allowed_mentions, { parse: [] });
});

test('payload shape: username, one embed, allowed_mentions, no content/footer/thumbnail', () => {
  const p = buildEmbedPayload(base({ difficulty: 8, outcome: { ok: true, word: 'Success' } }), NAME);
  assert.equal(p.username, 'Chakka');
  assert.equal(p.embeds.length, 1);
  assert.deepEqual(p.allowed_mentions, { parse: [] });
  assert.ok(!('content' in p));
  assert.ok(!('footer' in p.embeds[0]));
  assert.ok(!('thumbnail' in p.embeds[0]));
  assert.equal(typeof p.embeds[0].color, 'number');
});

test('username rules match plain', () => {
  assert.equal(buildEmbedPayload(base(), {}).username, 'Character');
  assert.equal(buildEmbedPayload(base()).username, 'Character');
  assert.equal(buildEmbedPayload(base(), { name: '  ' }).username, 'Character');
  assert.equal(buildEmbedPayload(base(), { name: 'x'.repeat(200) }).username.length, 80);
  assert.ok(!/discord/i.test(buildEmbedPayload(base(), { name: 'Discord' }).username));
  assert.equal(
    buildEmbedPayload(base(), { name: 'Discord' }).username,
    buildWebhookPayload(base(), { name: 'Discord' }).username,
  );
});

test('empty / null / undefined reports give a valid minimal embed', () => {
  for (const r of [{}, null, undefined]) {
    const e = buildEmbedPayload(r, NAME).embeds[0];
    assert.equal(e.title, '🎲 Roll');
    assert.equal(e.color, GREY);
    assert.ok(e.description === undefined);
    assert.deepEqual(e.fields, []);
  }
});

test('missing step / total never print undefined or NaN; title never empty', () => {
  const variants = [
    base({ step: undefined }),
    base({ step: null }),
    base({ total: undefined }),
    base({ total: null }),
    base({ step: null, total: null }),
  ];
  for (const r of variants) {
    const t = emb(r).title;
    assert.ok(t.length > 0);
    assert.ok(!/undefined|NaN|null/.test(t), t);
    assert.ok(t.includes('Melee Weapons'));
  }
  assert.ok(!emb(base({ step: null })).title.includes('Step'));
  assert.ok(emb(base({ step: null })).title.includes('Total 7'));
  assert.ok(!emb(base({ total: null })).title.includes('Total'));
  assert.ok(emb(base({ total: null })).title.includes('Step 9'));
  assert.ok(emb(base({ total: 0 })).title.includes('Total 0'));
});

test('blank label falls back to Roll', () => {
  for (const label of ['', '   ', undefined, null]) {
    const t = emb(base({ label })).title;
    assert.ok(t.includes('Roll'), t);
    assert.ok(!t.includes('undefined'));
  }
});

test('title is capped at 256 and never cuts the escape sequence mid-way', () => {
  const t = emb(base({ label: 'a'.repeat(400) })).title;
  assert.ok(t.length <= 256);
  assert.ok(t.endsWith('…'));
  const t2 = emb(base({ label: '*'.repeat(400) })).title;
  assert.ok(t2.length <= 256);
});

test('a field value is capped at 1024 with an ellipsis', () => {
  const e = emb(base({ groups: [g('D6', Array(600).fill(5))] }));
  const v = field(e, 'Dice').value;
  assert.equal(v.length, 1024);
  assert.ok(v.endsWith('…'));
});

test('description is capped at 4096', () => {
  const e = emb(base({ difficulty: 5, aim: { vs: 'x'.repeat(5000) } }));
  assert.ok(e.description.length <= 4096);
});

test('over 6000 total: title and description kept, Dice shrinks first, then Mods; Bonus and Karma untouched', () => {
  const long = Array(600).fill(5);
  const report = base({
    difficulty: 8,
    aim: { vs: 'x'.repeat(3500) },
    outcome: { ok: true, word: 'Hit' },
    groups: [g('D6', long)],
    karmaResult: { groups: [g('D6', long)], total: 3000 },
    bonusResult: { dice: [{ sides: 6, rolls: long }], total: 3000 },
    mods: Array.from({ length: 200 }, () => ({ label: 'Modifier label', value: 1 })),
  });
  const e = emb(report);
  const small = emb({ ...report, aim: { vs: 'x' } });
  assert.equal(e.title, small.title);
  assert.ok(e.description.startsWith('vs ' + 'x'.repeat(3500)));
  assert.ok(e.description.endsWith('— **Hit** ✅'));
  assert.ok(size(e) <= 6000, String(size(e)));
  assert.equal(field(e, 'Dice').value, '…');
  const mods = field(e, 'Mods').value;
  assert.ok(mods.length >= 1 && mods.length < 1024);
  assert.equal(field(e, 'Bonus dice').value.length, 1024);
  assert.equal(field(e, '✦ Karma').value.length, 1024);
  for (const f of e.fields) assert.ok(f.value !== '' && f.name !== '');
  assert.deepEqual(emb(report), e); // deterministic
});

test('under 6000 nothing is shrunk beyond the per-field cap', () => {
  const e = emb(base({ groups: [g('D6', Array(100).fill(5))] }));
  assert.ok(!field(e, 'Dice').value.endsWith('…'));
});

test('buildPayload: embed by format, plain otherwise', () => {
  const r = base();
  assert.deepEqual(buildPayload(r, { name: 'Chakka', format: 'embed' }), buildEmbedPayload(r, NAME));
  const plain = buildWebhookPayload(r, NAME);
  assert.deepEqual(buildPayload(r, { name: 'Chakka', format: 'plain' }), plain);
  for (const f of [undefined, null, 'bogus', 'Embed', 5, {}]) {
    assert.deepEqual(buildPayload(r, { name: 'Chakka', format: f }), plain, String(f));
  }
  assert.deepEqual(buildPayload(r), buildWebhookPayload(r, {}));
  assert.ok('content' in buildPayload(r, { format: 'plain' }));
  assert.ok(!('embeds' in buildPayload(r, { format: 'plain' })));
});

test('buildTestPayload embed variant', () => {
  assert.deepEqual(buildTestPayload({ name: 'Chakka', format: 'embed' }), {
    username: 'Chakka',
    embeds: [{ title: '✅ Test message', description: 'Discord die reports are connected.', color: GREEN, fields: [] }],
    allowed_mentions: { parse: [] },
  });
});

test('buildTestPayload plain variant is the exact existing payload', () => {
  const today = {
    username: 'Chakka',
    content: '✅ Test message — Discord die reports are connected.',
    allowed_mentions: { parse: [] },
  };
  assert.deepEqual(buildTestPayload({ name: 'Chakka' }), today);
  assert.deepEqual(buildTestPayload({ name: 'Chakka', format: 'plain' }), today);
  for (const f of ['bogus', null, 3, 'EMBED']) {
    assert.deepEqual(buildTestPayload({ name: 'Chakka', format: f }), today, String(f));
  }
  assert.equal(buildTestPayload().username, 'Character');
});

// --- roll-knacks: Strain field (plans/roll-knacks I6) --------------------------

test('Strain field: absent when strain is missing or 0', () => {
  for (const strain of [undefined, 0]) {
    const { embed } = formatRollEmbed(base({ strain }), { name: 'Chakka' });
    assert.ok(!embed.fields.some((f) => f.name === 'Strain'), String(strain));
  }
});

test('Strain field: present, inline, numeric string when strain > 0', () => {
  const { embed } = formatRollEmbed(base({ strain: 2 }), { name: 'Chakka' });
  assert.deepEqual(
    embed.fields.find((f) => f.name === 'Strain'),
    { name: 'Strain', value: '2', inline: true },
  );
});

test('Strain field: knack name with markdown is escaped in the title; payload stays valid', () => {
  const { embed } = formatRollEmbed(base({ label: 'Lip *Reading*', strain: 1 }), { name: 'Chakka' });
  assert.ok(embed.title.includes(escapeDiscord('Lip *Reading*')));
  assert.ok(embed.fields.some((f) => f.name === 'Strain'));
});

test('Strain field: survives a long-detail embed (6000-char guard) and the total stays within limits', () => {
  const longMods = Array.from({ length: 200 }, (_, i) => ({ label: `Long modifier label ${i}`, value: 1, measure: 'result' }));
  const { embed } = formatRollEmbed(base({ strain: 3, mods: longMods }), { name: 'Chakka' });
  const size =
    embed.title.length + (embed.description?.length ?? 0) + embed.fields.reduce((a, f) => a + f.name.length + f.value.length, 0);
  assert.ok(size <= 6000);
  assert.equal(embed.fields.find((f) => f.name === 'Strain')?.value, '3');
});
