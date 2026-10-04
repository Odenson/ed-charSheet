#!/usr/bin/env node
// Token and cost report for the feature workflows (/new-feature, /build-feature,
// /release-feature). Reads the Claude Code session transcript (main session plus
// the subagent transcripts beside it), totals usage since a start timestamp, and
// records one run in <dir>/token-usage.json, rendering <dir>/token-usage.md.
//
//   node tools/token-report.mjs --workflow build-feature --since 2026-10-04T10:00:00Z \
//        --dir plans/<slug> [--session <id>] [--until <ISO>] [--projects <dir>]
//
// Cost is an ESTIMATE from tools/token-pricing.json list prices.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const WORKFLOWS = ['new-feature', 'build-feature', 'release-feature'];

export function loadPricing(file = path.join(here, 'token-pricing.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function priceFor(pricing, model) {
  if (!model) return null;
  const keys = Object.keys(pricing.models).sort((a, b) => b.length - a.length);
  const k = keys.find((p) => model.startsWith(p));
  return k ? pricing.models[k] : null;
}

// One message's usage, in tokens and USD. Returns cost null for an unpriced model.
export function messageCost(pricing, model, usage) {
  const cc = usage.cache_creation || {};
  const w1h = cc.ephemeral_1h_input_tokens ?? 0;
  const w5m = cc.ephemeral_5m_input_tokens ?? Math.max(0, (usage.cache_creation_input_tokens ?? 0) - w1h);
  const t = {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: w5m + w1h,
  };
  const p = priceFor(pricing, model);
  let cost = null;
  if (p) {
    const fast = usage.speed === 'fast' ? p.fastMultiplier ?? 1 : 1;
    cost = fast * (t.input * p.input + t.output * p.output + t.cacheRead * p.cacheRead
      + w5m * p.cacheWrite5m + w1h * p.cacheWrite1h) / 1e6;
  }
  return { tokens: t, cost };
}

// A transcript repeats one assistant message across several lines (one per content
// block). Its recorded output_tokens is a streaming snapshot and often far too low,
// so output is raised to a size estimate of the content actually written (~3.5
// chars/token); the report states this. Other counters are taken from the last line.
export function blockChars(content) {
  let c = 0;
  for (const b of Array.isArray(content) ? content : []) {
    if (b.type === 'text') c += (b.text || '').length;
    else if (b.type === 'tool_use') c += JSON.stringify(b.input || {}).length + (b.name || '').length;
    else if (b.type === 'thinking') c += (b.thinking || '').length;
  }
  return c;
}

export function readMessages(file) {
  const byId = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    const m = d.message;
    if (d.type !== 'assistant' || !m?.usage || !m.model || m.model.startsWith('<')) continue;
    const id = m.id ?? d.uuid;
    const prev = byId.get(id);
    const chars = (prev?.chars ?? 0) + blockChars(m.content);
    byId.set(id, { ts: d.timestamp, model: m.model, usage: { ...m.usage }, chars });
  }
  for (const m of byId.values())
    m.usage.output_tokens = Math.max(m.usage.output_tokens ?? 0, Math.ceil(m.chars / 3.5));
  return [...byId.values()];
}

export function projectDirFor(cwd, projectsRoot = path.join(os.homedir(), '.claude', 'projects')) {
  return path.join(projectsRoot, cwd.replace(/[/.]/g, '-'));
}

// Most recently written top-level transcript = the running session.
export function findSession(projectDir, sessionId) {
  if (sessionId) return sessionId;
  const files = fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, t: fs.statSync(path.join(projectDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error(`no session transcripts in ${projectDir}`);
  return files[0].f.replace(/\.jsonl$/, '');
}

// Rows: { agent, model, tokens, cost } per message in [since, until).
export function collect({ projectDir, sessionId, since, until, pricing }) {
  const rows = [];
  const add = (agent, msgs) => {
    for (const m of msgs) {
      if (m.ts < since || (until && m.ts >= until)) continue;
      rows.push({ agent, model: m.model, ...messageCost(pricing, m.model, m.usage) });
    }
  };
  add('orchestrator', readMessages(path.join(projectDir, `${sessionId}.jsonl`)));
  const subDir = path.join(projectDir, sessionId, 'subagents');
  if (fs.existsSync(subDir)) {
    for (const f of fs.readdirSync(subDir).filter((n) => n.endsWith('.jsonl'))) {
      let type = 'subagent';
      try { type = JSON.parse(fs.readFileSync(path.join(subDir, f.replace(/\.jsonl$/, '.meta.json')), 'utf8')).agentType || type; } catch { /* no meta */ }
      const msgs = readMessages(path.join(subDir, f));
      if (msgs.some((m) => m.ts >= since && (!until || m.ts < until))) rows.push({ spawn: type, agent: type, model: null, tokens: zero(), cost: 0, marker: true });
      add(type, msgs);
    }
  }
  return rows;
}

const zero = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
function addTo(acc, r) {
  for (const k of Object.keys(acc.tokens)) acc.tokens[k] += r.tokens[k];
  if (r.cost == null) acc.unpriced = true; else acc.cost += r.cost;
  acc.messages += 1;
}
const blank = () => ({ tokens: zero(), cost: 0, messages: 0, spawns: 0, unpriced: false });

export function summarize(rows) {
  const byAgent = {}, byModel = {}, total = blank();
  for (const r of rows) {
    if (r.marker) { (byAgent[r.agent] ??= blank()).spawns += 1; continue; }
    addTo((byAgent[r.agent] ??= blank()), r);
    addTo((byModel[r.model] ??= blank()), r);
    addTo(total, r);
  }
  byAgent.orchestrator && (byAgent.orchestrator.spawns = 1);
  return { total, byAgent, byModel };
}

export const totalTokens = (t) => t.input + t.output + t.cacheRead + t.cacheWrite;
const n = (x) => x.toLocaleString('en-US');
const usd = (x, unpriced) => (unpriced ? '≥ ' : '') + '$' + x.toFixed(x < 1 ? 3 : 2);

function table(head, rows) {
  const line = (cells) => '| ' + cells.join(' | ') + ' |';
  return [line(head), line(head.map((_, i) => (i === 0 ? '---' : '---:'))), ...rows.map(line)].join('\n');
}
function tokenCells(s) {
  return [n(s.tokens.input), n(s.tokens.output), n(s.tokens.cacheRead), n(s.tokens.cacheWrite), n(totalTokens(s.tokens)), usd(s.cost, s.unpriced)];
}
const HEAD = ['', 'Input', 'Output', 'Cache read', 'Cache write', 'Total tokens', 'Est. cost'];

// A run record is plain JSON, so token-usage.md can be re-rendered from it.
export function render(slug, runs, pricing) {
  const out = [`# Token usage: ${slug}`, '',
    `Estimated from list prices in \`tools/token-pricing.json\` (as of ${pricing.asOf}); a subscription plan bills differently. `
    + 'Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.', ''];
  const wf = {};
  for (const r of runs) {
    const w = (wf[r.workflow] ??= { ...blank(), runs: 0 });
    for (const k of Object.keys(w.tokens)) w.tokens[k] += r.total.tokens[k];
    w.cost += r.total.cost; w.unpriced ||= r.total.unpriced; w.runs += 1;
  }
  const all = blank();
  out.push('## Total per workflow', '');
  out.push(table(['Workflow', 'Runs', ...HEAD.slice(1)], Object.entries(wf).map(([k, w]) => {
    for (const x of Object.keys(all.tokens)) all.tokens[x] += w.tokens[x];
    all.cost += w.cost; all.unpriced ||= w.unpriced;
    return ['/' + k, String(w.runs), ...tokenCells(w)];
  }).concat([['**All workflows**', String(runs.length), ...tokenCells(all)]])), '');
  runs.forEach((r, i) => {
    out.push(`## Run ${i + 1}: /${r.workflow} — ${r.finished.slice(0, 16).replace('T', ' ')}Z`, '',
      `Window: ${r.since} → ${r.until}. Main-session model(s): ${r.mainModels.join(', ') || 'n/a'}.`
      + (r.note ? ` ${r.note}` : ''), '');
    out.push('### By model (mode)', '', table(['Model', ...HEAD.slice(1)],
      Object.entries(r.byModel).map(([m, s]) => [m, ...tokenCells(s)])), '');
    out.push('### By participant', '', table(['Participant', 'Spawns', ...HEAD.slice(1)],
      Object.entries(r.byAgent).map(([a, s]) => [a, String(s.spawns), ...tokenCells(s)])
        .concat([['**Workflow total**', '', ...tokenCells(r.total)]])), '');
    if (r.total.unpriced) out.push('> Some models have no entry in `tools/token-pricing.json`; their tokens are counted but not priced, so the cost is a lower bound.', '');
  });
  return out.join('\n');
}

export function record({ dir, workflow, since, until, projectDir, sessionId, pricing, note }) {
  const rows = collect({ projectDir, sessionId, since, until, pricing });
  const s = summarize(rows);
  const mainModels = [...new Set(rows.filter((r) => r.agent === 'orchestrator').map((r) => r.model))];
  const run = { workflow, since, until, finished: until, session: sessionId, mainModels, note: note || '', ...s };
  fs.mkdirSync(dir, { recursive: true });
  const jf = path.join(dir, 'token-usage.json');
  const runs = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, 'utf8')).runs : [];
  // Re-running for the same window replaces the earlier record.
  const next = runs.filter((r) => !(r.workflow === workflow && r.since === since)).concat(run)
    .sort((a, b) => a.since.localeCompare(b.since));
  fs.writeFileSync(jf, JSON.stringify({ schema: 'ed-token-usage/1', runs: next }, null, 2) + '\n');
  const md = path.join(dir, 'token-usage.md');
  fs.writeFileSync(md, render(path.basename(path.resolve(dir)), next, pricing) + '\n');
  return { run, md, jf };
}

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i];
  return o;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = args(process.argv.slice(2));
  if (!WORKFLOWS.includes(a.workflow) || !a.since || !a.dir) {
    console.error('usage: token-report.mjs --workflow <new-feature|build-feature|release-feature> --since <ISO> --dir <plans/...> [--until ISO] [--session id] [--projects dir] [--note text]');
    process.exit(2);
  }
  const pricing = loadPricing();
  const projectDir = a.projects ? path.resolve(a.projects) : projectDirFor(process.cwd());
  const sessionId = findSession(projectDir, a.session);
  const until = new Date(a.until || Date.now()).toISOString();
  const since = new Date(a.since).toISOString();
  const { run, md } = record({ dir: a.dir, workflow: a.workflow, since, until, projectDir, sessionId, pricing, note: a.note });
  console.log(`${md}\n/${a.workflow}: ${n(totalTokens(run.total.tokens))} tokens, ${usd(run.total.cost, run.total.unpriced)} est.`);
}
