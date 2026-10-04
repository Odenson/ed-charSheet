import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadPricing, priceFor, messageCost, readMessages, collect, summarize, record, projectDirFor } from './token-report.mjs';

const pricing = loadPricing();

function line(id, ts, model, usage, content = [{ type: 'text', text: 'x' }]) {
  return JSON.stringify({ type: 'assistant', timestamp: ts, uuid: id + ts, message: { id, model, usage, content } });
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tok-'));
  const sid = 'sess1';
  fs.mkdirSync(path.join(root, sid, 'subagents'), { recursive: true });
  const u = (extra = {}) => ({ input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 200,
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 200 }, ...extra });
  fs.writeFileSync(path.join(root, `${sid}.jsonl`), [
    line('old', '2026-01-01T00:00:00.000Z', 'claude-sonnet-5-5', u()),
    line('m1', '2026-01-02T00:00:00.000Z', 'claude-sonnet-5-5', u()),
    line('m1', '2026-01-02T00:00:00.000Z', 'claude-sonnet-5-5', u()), // duplicate block line
    'not json',
  ].join('\n'));
  fs.writeFileSync(path.join(root, sid, 'subagents', 'agent-a.jsonl'),
    line('s1', '2026-01-02T01:00:00.000Z', 'claude-opus-5-5', u({ speed: 'fast' })));
  fs.writeFileSync(path.join(root, sid, 'subagents', 'agent-a.meta.json'), JSON.stringify({ agentType: 'feature-dev' }));
  return { root, sid };
}

test('priceFor: longest prefix wins; unknown is null', () => {
  assert.equal(priceFor(pricing, 'claude-opus-5-5').input, 4);
  assert.equal(priceFor(pricing, 'claude-opus-5-20260101').input, 5);
  assert.equal(priceFor(pricing, 'claude-fable-5-1').output, 50);
  assert.equal(priceFor(pricing, 'gpt-x'), null);
});

test('messageCost: splits cache writes by TTL and doubles fast mode', () => {
  const usage = { input_tokens: 1e6, output_tokens: 1e6, cache_read_input_tokens: 1e6, cache_creation_input_tokens: 2e6,
    cache_creation: { ephemeral_5m_input_tokens: 1e6, ephemeral_1h_input_tokens: 1e6 } };
  const std = messageCost(pricing, 'claude-sonnet-5-5', usage);
  assert.equal(std.cost, 2 + 10 + 0.2 + 2.5 + 4);
  assert.equal(std.tokens.cacheWrite, 2e6);
  assert.equal(messageCost(pricing, 'claude-opus-5-5', { ...usage, speed: 'fast' }).cost,
    2 * (4 + 20 + 0.2 + 5 + 8));
  assert.equal(messageCost(pricing, 'mystery', usage).cost, null);
});

test('readMessages: dedupes by message id and floors output at a content-size estimate', () => {
  const { root, sid } = fixture();
  const big = 'y'.repeat(3500);
  fs.writeFileSync(path.join(root, 'big.jsonl'),
    line('b', '2026-01-02T00:00:00.000Z', 'claude-sonnet-5-5', { input_tokens: 1, output_tokens: 5 }, [{ type: 'text', text: big }]));
  const msgs = readMessages(path.join(root, 'big.jsonl'));
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].usage.output_tokens, 1000);
  assert.equal(readMessages(path.join(root, `${sid}.jsonl`)).length, 2);
});

test('collect + summarize: window filter, per-participant and per-model totals', () => {
  const { root, sid } = fixture();
  const rows = collect({ projectDir: root, sessionId: sid, since: '2026-01-02T00:00:00.000Z', pricing });
  const s = summarize(rows);
  assert.equal(s.byAgent.orchestrator.messages, 1); // 'old' excluded, duplicate collapsed
  assert.equal(s.byAgent['feature-dev'].spawns, 1);
  assert.deepEqual(Object.keys(s.byModel).sort(), ['claude-opus-5-5', 'claude-sonnet-5-5']);
  assert.ok(Math.abs(s.total.cost - (s.byModel['claude-opus-5-5'].cost + s.byModel['claude-sonnet-5-5'].cost)) < 1e-9);
});

test('record: writes json + md, totals per workflow, re-run replaces same window', () => {
  const { root, sid } = fixture();
  const dir = path.join(root, 'out');
  const base = { dir, projectDir: root, sessionId: sid, pricing, until: '2026-02-01T00:00:00.000Z' };
  record({ ...base, workflow: 'new-feature', since: '2026-01-02T00:00:00.000Z' });
  record({ ...base, workflow: 'build-feature', since: '2026-01-02T00:30:00.000Z' });
  record({ ...base, workflow: 'build-feature', since: '2026-01-02T00:30:00.000Z' });
  const j = JSON.parse(fs.readFileSync(path.join(dir, 'token-usage.json'), 'utf8'));
  assert.equal(j.runs.length, 2);
  const md = fs.readFileSync(path.join(dir, 'token-usage.md'), 'utf8');
  assert.match(md, /## Total per workflow/);
  assert.match(md, /\/new-feature/);
  assert.match(md, /\*\*All workflows\*\*/);
  assert.match(md, /### By model \(mode\)/);
});

test('projectDirFor mirrors the Claude Code project folder naming', () => {
  assert.equal(projectDirFor('/a/b.c/d', '/p'), '/p/-a-b-c-d');
});
