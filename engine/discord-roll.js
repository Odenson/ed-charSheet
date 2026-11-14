// engine/discord-roll.js — pure, DOM-free formatter for the Discord die report
// (plans/discord-die-report). Turns a completed roll's report object into a
// Discord webhook payload (plain text or embed; plans/embedded-die-roll). No Earthdawn rules live here; it only reports
// values the app already computed.

import { isDiscordWebhookUrl, normalizeFormat } from '../store-discord.js';

const ZWSP = String.fromCharCode(0x200b);
const LIMIT = 2000;
const WORD_CAP = 200;

/** Escape Discord markdown and neutralise mentions (zero-width space). */
export function escapeDiscord(s) {
  const BS = String.fromCharCode(92);
  let out = '';
  for (const ch of String(s ?? '')) {
    out += ch === BS || '*_~`|>#'.includes(ch) ? BS + ch : ch;
  }
  out = out.replace(/@(?=everyone|here)/gi, '@' + ZWSP).replace(/<@/g, '<@' + ZWSP);
  // list markers at line start ("- x", "1. x")
  return out.replace(/^(\s*)(-|\+|\d+\.)(\s)/gm, (_m, a, b, c) => a + BS + b + c);
}

/** Webhook username: trimmed, <=80, never "discord"/"clyde", blank -> Character. */
export function safeUsername(name) {
  let n = typeof name === 'string' ? name.trim() : '';
  if (!n) return 'Character';
  n = n.replace(/discord|clyde/gi, (m) => `${m[0]}${ZWSP}${m.slice(1)}`);
  return n.slice(0, 80);
}

const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const chain = (rolls) => `[${rolls.join('↦')}]`;
const groupText = (gr) => `${gr.label} ${chain(gr.rolls)} = ${gr.subtotal}`;

function cap(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function formatRollForDiscord(report, { name } = {}) {
  const r = report ?? {};
  const header = `🎲 **${escapeDiscord(r.label)}** — Step ${r.step} (${escapeDiscord(r.dice)})`;

  const body = [];
  let dice = (r.groups ?? []).map(groupText).join(' · ');
  if (r.modifier) dice += `${dice ? ' · ' : ''}Modifier ${signed(r.modifier)}`;
  if (dice) body.push(dice);

  const k = r.karmaResult;
  if (k && (k.groups ?? []).length) {
    const gs = k.groups.map(groupText).join(' · ');
    body.push(k.groups.length > 1 ? `✦ Karma ${gs} · Karma total = ${k.total}` : `✦ Karma ${gs}`);
  }

  const b = r.bonusResult;
  if (b && (b.dice ?? []).length) {
    body.push(`Bonus dice ${b.dice.map((d) => `D${d.sides} ${chain(d.rolls)}`).join(' · ')} = ${b.total}`);
  }

  if ((r.mods ?? []).length) {
    body.push(
      `Mods: ${r.mods
        .map((m) => `${escapeDiscord(m.label)} ${signed(m.value)}${m.measure === 'step' ? ' Step' : ''}`)
        .join(' · ')}`,
    );
  }

  let total = `**Total ${r.total}**`;
  if (r.difficulty != null) {
    const vs = r.aim ? `${escapeDiscord(r.aim.vs ?? 'Mystic')} Defence` : 'Difficulty';
    total += ` vs ${vs} ${r.difficulty}`;
  }
  if (r.outcome) {
    const word = escapeDiscord(cap(String(r.outcome.word ?? ''), WORD_CAP));
    total += ` — **${word}** ${r.outcome.ok ? '✅' : '❌'}`;
  }

  let content = [header, ...body, total].join('\n');
  if (content.length > LIMIT) {
    // Cut the detail lines first; keep the header and the bold Total line.
    const budget = LIMIT - header.length - total.length - 2 - 1;
    const detail = body.join('\n');
    const cut = budget > 0 ? `${detail.slice(0, Math.max(0, budget))}…` : '…';
    content = [header, cut, total].join('\n').slice(0, LIMIT);
  }
  return { username: safeUsername(name), content };
}

export function formatTestMessage({ name } = {}) {
  return { username: safeUsername(name), content: '✅ Test message — Discord die reports are connected.' };
}

const withMentions = (m) => ({ username: m.username, content: m.content, allowed_mentions: { parse: [] } });

export function buildWebhookPayload(report, opts) {
  return withMentions(formatRollForDiscord(report, opts));
}

const GREEN = 0x2ecc71;
const RED = 0xe74c3c;
const GREY = 0x95a5a6;

/** Embed variant of the report (plans/embedded-die-roll). Pure; same details as plain. */
export function formatRollEmbed(report, { name } = {}) {
  const r = report ?? {};
  let label = escapeDiscord(r.label);
  if (!label.trim()) label = 'Roll';
  let title = `🎲 ${label}`;
  if (r.step != null) title += ` — Step ${r.step}`;
  if (r.total != null) title += `${r.step != null ? ' · ' : ' — '}Total ${r.total}`;
  title = cap(title, 256);

  let description;
  if (r.difficulty != null || r.outcome) {
    let d = '';
    if (r.difficulty != null) {
      const vs = r.aim ? `${escapeDiscord(r.aim.vs ?? 'Mystic')} Defence` : 'Difficulty';
      d = `vs ${vs} ${r.difficulty}`;
    }
    if (r.outcome) {
      const word = escapeDiscord(cap(String(r.outcome.word ?? ''), WORD_CAP));
      d += `${d ? ' — ' : ''}**${word}** ${r.outcome.ok ? '✅' : '❌'}`;
    }
    description = cap(d, 4096);
  }
  const color = r.outcome ? (r.outcome.ok ? GREEN : RED) : GREY;

  const fields = [];
  const push = (name, value, inline) => {
    if (value) fields.push({ name, value: cap(value, 1024), inline });
  };

  let dice = (r.groups ?? []).map(groupText).join(' · ');
  if (r.modifier) dice += `${dice ? ' · ' : ''}Modifier ${signed(r.modifier)}`;
  push('Dice', dice, false);

  const k = r.karmaResult;
  if (k && (k.groups ?? []).length) {
    const gs = k.groups.map(groupText).join(' · ');
    push('✦ Karma', k.groups.length > 1 ? `${gs} · Karma total = ${k.total}` : gs, true);
  }
  const b = r.bonusResult;
  if (b && (b.dice ?? []).length) {
    push('Bonus dice', `${b.dice.map((d) => `D${d.sides} ${chain(d.rolls)}`).join(' · ')} = ${b.total}`, true);
  }
  if ((r.mods ?? []).length) {
    push(
      'Mods',
      r.mods.map((m) => `${escapeDiscord(m.label)} ${signed(m.value)}${m.measure === 'step' ? ' Step' : ''}`).join(' · '),
      false,
    );
  }

  const size = () =>
    title.length + (description?.length ?? 0) + fields.reduce((a, f) => a + f.name.length + f.value.length, 0);
  for (const fname of ['Dice', 'Mods', 'Bonus dice', '✦ Karma']) {
    const over = size() - 6000;
    if (over <= 0) break;
    const f = fields.find((x) => x.name === fname);
    if (f) f.value = cap(f.value, Math.max(1, f.value.length - over));
  }

  const embed = { title, color, fields };
  if (description !== undefined) embed.description = description;
  return { username: safeUsername(name), embed };
}

export function buildEmbedPayload(report, opts) {
  const { username, embed } = formatRollEmbed(report, opts);
  return { username, embeds: [embed], allowed_mentions: { parse: [] } };
}

/** Single entry point: embed when format === 'embed', else the plain payload. */
export function buildPayload(report, { name, format } = {}) {
  return normalizeFormat(format) === 'embed' ? buildEmbedPayload(report, { name }) : buildWebhookPayload(report, { name });
}

export function buildTestPayload({ name, format } = {}) {
  if (normalizeFormat(format) === 'embed') {
    return {
      username: safeUsername(name),
      embeds: [{ title: '✅ Test message', description: 'Discord die reports are connected.', color: GREEN, fields: [] }],
      allowed_mentions: { parse: [] },
    };
  }
  return withMentions(formatTestMessage({ name }));
}

export function discordSendDecision(cfg) {
  if (!cfg || !cfg.enabled) return { send: false, reason: 'disabled' };
  const url = typeof cfg.url === 'string' ? cfg.url.trim() : '';
  if (!url) return { send: false, reason: 'blank' };
  if (!isDiscordWebhookUrl(url)) return { send: false, reason: 'invalid' };
  return { send: true };
}
