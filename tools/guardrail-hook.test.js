import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isProtected, decide } from './guardrail-hook.mjs';

const cwd = '/repo';

test('protected path matching', () => {
  for (const p of ['ui/ed-app.js', 'engine/derive.js', 'rules/races.json',
    'data/characters/a.json', 'data/characters/index.json', 'docs/EFFECT-TAXONOMY.md', '/repo/ui/x.js'])
    assert.ok(isProtected(p, cwd), p);
  for (const p of ['docs/UI-GUIDELINES.md', 'tools/x.mjs', 'store.js', 'rules/README.md', 'data/custom-items.json'])
    assert.ok(!isProtected(p, cwd), p);
});

test('denies once per session, then passes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edg-'));
  const input = { cwd, session_id: 's1', tool_input: { file_path: 'ui/a.js' } };
  assert.equal(decide(input, dir).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(decide(input, dir), null);
  assert.equal(decide({ ...input, session_id: 's2' }, dir).hookSpecificOutput.permissionDecision, 'deny');
});

test('unprotected edit never denies', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edg-'));
  assert.equal(decide({ cwd, session_id: 's', tool_input: { file_path: 'README.md' } }, dir), null);
});
