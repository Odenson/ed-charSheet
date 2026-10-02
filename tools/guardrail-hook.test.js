import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isProtected, isProtectedBash, decide } from './guardrail-hook.mjs';

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

test('bash: writes to protected paths are caught', () => {
  for (const c of [
    "sed -i '' 's/a/b/' ui/ed-app.js",
    "python3 -c \"open('rules/races.json','w').write('x')\"",
    'echo x > engine/derive.js',
    'cat foo >> rules/talents.json',
    'tee docs/EFFECT-TAXONOMY.md < in',
    'git checkout -- ui/ed-app.js',
    'mv /tmp/x.json rules/items.json',
    'node -e "require(\'fs\').writeFileSync(\'data/characters/a.json\',\'{}\')"',
  ]) assert.ok(isProtectedBash(c), c);
});

test('bash: reads and unrelated writes are not caught', () => {
  for (const c of [
    'cat ui/ed-app.js', 'grep -rn foo engine/', 'ls rules/', 'git diff ui/ed-app.js',
    'node --test engine/derive.test.js', 'npm test 2>&1 | tail -3',
    'echo hi > /tmp/x', 'sed -n 1,5p rules/races.json', 'sed -i "" s/a/b/ README.md',
    'node tools/sync-agents.mjs 2>&1',
  ]) assert.ok(!isProtectedBash(c), c);
});

test('decide() applies to Bash commands once per session', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edg-'));
  const input = { cwd, session_id: 'b1', tool_name: 'Bash', tool_input: { command: "sed -i '' 's/a/b/' ui/x.js" } };
  assert.equal(decide(input, dir).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(decide(input, dir), null);
  assert.equal(decide({ ...input, session_id: 'b2', tool_input: { command: 'cat ui/x.js' } }, dir), null);
});
