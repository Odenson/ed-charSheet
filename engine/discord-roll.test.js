// engine/discord-roll.test.js — run with `npm test`.
// Pure Discord die-report formatter (plans/discord-die-report). No Earthdawn
// rule values are asserted: every expected value is a literal from the fixture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRollForDiscord,
  formatTestMessage,
  buildWebhookPayload,
  buildTestPayload,
  discordSendDecision,
  escapeDiscord,
  safeUsername,
} from './discord-roll.js';

const ZWSP = '​';

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

const lines = (r) => r.content.split('\n');
const NAME = { name: 'Chakka' };

test('plain roll: header, dice line, bold total only', () => {
  const r = formatRollForDiscord(base(), NAME);
  assert.equal(r.username, 'Chakka');
  const l = lines(r);
  assert.equal(l[0], '🎲 **Melee Weapons** — Step 9 (D10+D6)');
  assert.equal(l[1], 'D10 [3] = 3 · D6 [4] = 4');
  assert.equal(l[l.length - 1], '**Total 7**');
  assert.ok(!r.content.includes('Karma'));
  assert.ok(!r.content.includes('Bonus'));
  assert.ok(!r.content.includes('Mods:'));
  assert.ok(!r.content.includes('vs'));
  assert.ok(!r.content.includes('Chakka')); // body does not repeat the name
});

test('exploding dice show the chain with arrows', () => {
  const r = formatRollForDiscord(base({ groups: [g('D10', [10, 7]), g('D6', [3])], total: 20 }), NAME);
  assert.ok(r.content.includes('D10 [10↦7] = 17 · D6 [3] = 3'));
  const r2 = formatRollForDiscord(base({ groups: [g('D6', [6, 6, 2])], total: 14 }), NAME);
  assert.ok(r2.content.includes('D6 [6↦6↦2] = 14'));
});

test('nonzero modifier is appended to the dice line; zero is omitted', () => {
  const r = formatRollForDiscord(base({ modifier: 2, total: 9 }), NAME);
  assert.equal(lines(r)[1], 'D10 [3] = 3 · D6 [4] = 4 · Modifier +2');
  const neg = formatRollForDiscord(base({ modifier: -1, total: 6 }), NAME);
  assert.ok(neg.content.includes('Modifier -1') || neg.content.includes('Modifier −1'));
  assert.ok(!formatRollForDiscord(base(), NAME).content.includes('Modifier'));
});

test('Karma line: single die', () => {
  const r = formatRollForDiscord(
    base({ karmaResult: { step: 4, dice: 'D6', groups: [g('D6', [5])], total: 5 }, total: 12 }),
    NAME,
  );
  const k = lines(r).find((x) => x.startsWith('✦ Karma'));
  assert.ok(k, 'karma line present');
  assert.ok(k.includes('D6 [5]'));
  assert.ok(k.endsWith('= 5') || k.includes('= 5'));
});

test('Karma line: multiple dice listed as multiple groups, exploded chain kept', () => {
  const r = formatRollForDiscord(
    base({
      karmaResult: { step: 4, dice: 'D6', groups: [g('D6', [6, 2]), g('D6', [3])], total: 11 },
      total: 18,
    }),
    NAME,
  );
  const k = lines(r).find((x) => x.startsWith('✦ Karma'));
  assert.ok(k.includes('D6 [6↦2] = 8'));
  assert.ok(k.includes('D6 [3] = 3'));
  assert.ok(k.includes(' · '));
  assert.ok(k.includes('= 11'));
});

test('Bonus dice line shows each die chain and the total', () => {
  const r = formatRollForDiscord(
    base({
      bonusResult: {
        dice: [
          { sides: 6, rolls: [6, 4] },
          { sides: 8, rolls: [2] },
        ],
        total: 12,
      },
      total: 19,
    }),
    NAME,
  );
  const b = lines(r).find((x) => x.includes('Bonus dice'));
  assert.ok(b, 'bonus line present');
  assert.ok(b.includes('[6↦4]'));
  assert.ok(b.includes('[2]'));
  assert.ok(b.includes('= 12'));
});

test('Mods line: result mods and Step mods tagged Step', () => {
  const r = formatRollForDiscord(
    base({
      mods: [
        { label: 'Knocked Down', value: -3 },
        { label: 'Aid', value: 2, measure: 'step' },
      ],
    }),
    NAME,
  );
  const m = lines(r).find((x) => x.startsWith('Mods:'));
  assert.ok(m);
  assert.ok(/Knocked Down [-−]3/.test(m));
  assert.ok(/Aid \+2/.test(m));
  assert.ok(m.includes(' · '));
  // Only the Step mod carries the Step tag.
  const [first, second] = m.slice('Mods:'.length).split(' · ');
  assert.ok(!/Step/.test(first));
  assert.ok(/Step/.test(second));
});

test('difficulty success', () => {
  const r = formatRollForDiscord(
    base({ difficulty: 6, outcome: { word: 'Success', ok: true } }),
    NAME,
  );
  const last = lines(r).pop();
  assert.equal(last, '**Total 7** vs Difficulty 6 — **Success** ✅');
});

test('difficulty failure', () => {
  const r = formatRollForDiscord(
    base({ difficulty: 9, outcome: { word: 'Failure', ok: false } }),
    NAME,
  );
  assert.equal(lines(r).pop(), '**Total 7** vs Difficulty 9 — **Failure** ❌');
});

test('custom win/lose words are used verbatim (escaped)', () => {
  const r = formatRollForDiscord(
    base({ difficulty: 5, outcome: { word: 'Hit', ok: true } }),
    NAME,
  );
  assert.ok(lines(r).pop().includes('**Hit** ✅'));
  const l = formatRollForDiscord(
    base({ difficulty: 50, outcome: { word: 'Miss', ok: false } }),
    NAME,
  );
  assert.ok(lines(l).pop().includes('**Miss** ❌'));
});

test('aim roll names the defence (default Mystic)', () => {
  const r = formatRollForDiscord(
    base({ difficulty: 9, outcome: { word: 'Aim hit', ok: true }, aim: { vs: 'Physical' } }),
    NAME,
  );
  assert.equal(lines(r).pop(), '**Total 7** vs Physical Defence 9 — **Aim hit** ✅');
  const m = formatRollForDiscord(
    base({ difficulty: 9, outcome: { word: 'Aim miss', ok: false }, aim: {} }),
    NAME,
  );
  assert.ok(lines(m).pop().includes('vs Mystic Defence 9'));
});

test('long aim outcome word is escaped and capped near 200 chars, ending with an ellipsis', () => {
  const word = '*'.repeat(500);
  const r = formatRollForDiscord(
    base({ difficulty: 9, outcome: { word, ok: true }, aim: { vs: 'Social' } }),
    NAME,
  );
  const last = lines(r).pop();
  assert.ok(last.startsWith('**Total 7** vs Social Defence 9'));
  assert.ok(last.includes('…'));
  assert.ok(last.length < 500, `total line too long: ${last.length}`);
  assert.ok(!last.includes('*'.repeat(10)), 'stars must be escaped, not raw');
});

test('escaping: markdown characters in labels', () => {
  assert.equal(escapeDiscord('a*b_c~d`e|f>g'), 'a\\*b\\_c\\~d\\`e\\|f\\>g');
  // backslash is escaped first, so it is not double-processed
  assert.equal(escapeDiscord('a\\b'), 'a\\\\b');
  assert.equal(escapeDiscord('*'), '\\*');
  assert.equal(escapeDiscord('\\*'), '\\\\\\*');
  assert.equal(escapeDiscord('plain text'), 'plain text');
});

test('escaping: leading-line markers are neutralised', () => {
  for (const s of ['# Big', '> quote']) {
    const out = escapeDiscord(s);
    assert.notEqual(out[0], s[0] === '#' ? '#' : '>', `${s} must not start a heading/quote`);
  }
});

test('escaping: mentions get a zero-width space', () => {
  for (const s of ['@everyone', '@here', '<@12345>', '<@&99>']) {
    const out = escapeDiscord(`hi ${s}`);
    assert.ok(out.includes(ZWSP), `${s} not neutralised`);
    assert.ok(!out.includes(s), `${s} still intact`);
  }
});

test('label, mod label and outcome word are escaped in the report', () => {
  const r = formatRollForDiscord(
    base({
      label: '*Bold* @everyone',
      mods: [{ label: '_it_ @here', value: 1 }],
      difficulty: 3,
      outcome: { word: '<@123>', ok: true },
    }),
    NAME,
  );
  assert.ok(r.content.includes('\\*Bold\\*'));
  assert.ok(!r.content.includes('@everyone'));
  assert.ok(!r.content.includes('@here'));
  assert.ok(!r.content.includes('<@123>'));
  assert.ok(r.content.includes('\\_it\\_'));
});

test('truncation: content never exceeds 2000, Total line kept, body ends with ellipsis', () => {
  const many = Array.from({ length: 400 }, () => g('D10', [10, 10, 10, 10, 10, 3]));
  const r = formatRollForDiscord(base({ groups: many, total: 12345 }), NAME);
  assert.ok(r.content.length <= 2000, `len ${r.content.length}`);
  assert.ok(r.content.includes('**Total 12345**'));
  assert.ok(r.content.includes('…'));
  assert.equal(lines(r)[0], '🎲 **Melee Weapons** — Step 9 (D10+D6)');
});

test('truncation: a short report is untouched (no ellipsis)', () => {
  assert.ok(!formatRollForDiscord(base(), NAME).content.includes('…'));
});

test('username: character name, trimmed to 80, blank falls back', () => {
  assert.equal(safeUsername('Chakka'), 'Chakka');
  assert.equal(safeUsername('  Chakka  '), 'Chakka');
  assert.equal(safeUsername('x'.repeat(200)).length, 80);
  assert.equal(safeUsername(''), 'Character');
  assert.equal(safeUsername('   '), 'Character');
  assert.equal(safeUsername(undefined), 'Character');
  assert.equal(safeUsername(null), 'Character');
});

test('username: "discord" / "clyde" substrings are broken with a zero-width space', () => {
  for (const n of ['Discord', 'my discord guy', 'CLYDE', 'Clyde the Bold', 'xDiScOrDx']) {
    const out = safeUsername(n);
    assert.ok(out.includes(ZWSP), `${n} not sanitised`);
    assert.ok(!/discord|clyde/i.test(out), `${n} still matches`);
  }
  // Removing the ZWSP gives back the original text.
  assert.equal(safeUsername('Clyde').replace(ZWSP, ''), 'Clyde');
  assert.ok(safeUsername('d'.repeat(5) + 'discord'.repeat(20)).length <= 80 + 20); // never throws
});

test('formatRollForDiscord username uses safeUsername', () => {
  assert.equal(formatRollForDiscord(base(), { name: '' }).username, 'Character');
  assert.ok(!/discord/i.test(formatRollForDiscord(base(), { name: 'Discord' }).username));
});

test('formatTestMessage returns username and short non-empty content', () => {
  const t = formatTestMessage(NAME);
  assert.equal(t.username, 'Chakka');
  assert.equal(typeof t.content, 'string');
  assert.ok(t.content.length > 0 && t.content.length < 2000);
  assert.equal(formatTestMessage({ name: '' }).username, 'Character');
});

test('buildWebhookPayload always carries allowed_mentions {parse: []}', () => {
  const p = buildWebhookPayload(base(), NAME);
  assert.deepEqual(p.allowed_mentions, { parse: [] });
  assert.equal(p.username, 'Chakka');
  assert.equal(p.content, formatRollForDiscord(base(), NAME).content);
  assert.deepEqual(Object.keys(p).sort(), ['allowed_mentions', 'content', 'username']);
});

test('buildTestPayload has the same shape', () => {
  const p = buildTestPayload(NAME);
  assert.deepEqual(p.allowed_mentions, { parse: [] });
  assert.equal(p.username, 'Chakka');
  assert.equal(p.content, formatTestMessage(NAME).content);
});

test('discordSendDecision: disabled / blank / invalid / ok', () => {
  const ok = 'https://discord.com/api/webhooks/123456/abc-DEF_9';
  assert.deepEqual(discordSendDecision({ url: ok, enabled: true }), { send: true });
  assert.deepEqual(discordSendDecision({ url: ok, enabled: false }), { send: false, reason: 'disabled' });
  assert.deepEqual(discordSendDecision({ url: '', enabled: true }), { send: false, reason: 'blank' });
  assert.deepEqual(discordSendDecision({ url: '   ', enabled: true }), { send: false, reason: 'blank' });
  assert.deepEqual(discordSendDecision({ url: 'https://evil.example/x', enabled: true }), {
    send: false,
    reason: 'invalid',
  });
  assert.equal(discordSendDecision(null).send, false);
  assert.equal(discordSendDecision(undefined).send, false);
});

// --- roll-knacks: Strain line (plans/roll-knacks I6) ---------------------------

test('Strain line: absent when strain is missing, 0 or negative', () => {
  for (const strain of [undefined, 0, -1]) {
    const r = formatRollForDiscord(base({ strain }), NAME);
    assert.ok(!lines(r).some((x) => x.startsWith('Strain')), String(strain));
  }
});

test('Strain line: "Strain N" body line sits after Mods and before Total', () => {
  const r = formatRollForDiscord(base({ strain: 2, mods: [{ label: 'Aim', value: 2, measure: 'result' }] }), NAME);
  const l = lines(r);
  const mi = l.findIndex((x) => x.startsWith('Mods:'));
  const si = l.indexOf('Strain 2');
  assert.ok(si > mi && mi >= 0);
  assert.equal(l[si + 1], l[l.length - 1]);
  assert.equal(l[l.length - 1], '**Total 7**');
});

test('Strain line: knack name with markdown characters is escaped in the header', () => {
  const r = formatRollForDiscord(base({ label: 'Lip *Reading*', strain: 1 }), NAME);
  assert.equal(lines(r)[0], `🎲 **${escapeDiscord('Lip *Reading*')}** — Step 9 (D10+D6)`);
  assert.ok(lines(r).includes('Strain 1'));
});

test('Strain line: long detail is cut but header and Total survive within 2000 chars', () => {
  const longMods = Array.from({ length: 60 }, (_, i) => ({ label: `Modifier number ${i}`, value: 1, measure: 'result' }));
  const r = formatRollForDiscord(base({ strain: 3, mods: longMods }), NAME);
  assert.ok(r.content.length <= 2000);
  assert.ok(r.content.startsWith('🎲 **Melee Weapons**'));
  assert.ok(r.content.endsWith('**Total 7**'));
});
