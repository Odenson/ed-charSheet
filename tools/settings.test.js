import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const s = JSON.parse(fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8'));

test('shared permission baseline: deny the dangerous git forms', () => {
  for (const p of ['Bash(git add -A)', 'Bash(git add .)', 'Bash(git push --force*)',
    'Bash(git push origin main*)', 'Bash(git reset --hard*)'])
    assert.ok(s.permissions.deny.includes(p), `deny is missing ${p}`);
});

test('shared permission baseline: commit and push ask first', () => {
  for (const p of ['Bash(git commit*)', 'Bash(git push*)'])
    assert.ok(s.permissions.ask.includes(p), `ask is missing ${p}`);
  assert.ok(!s.permissions.allow.some((p) => /git (commit|push|add)/.test(p)),
    'allow must not grant commit/push/add');
});

test('guardrail hook stays wired', () => {
  const cmd = JSON.stringify(s.hooks.PreToolUse);
  assert.match(cmd, /guardrail-hook\.mjs/);
  assert.match(s.hooks.PreToolUse[0].matcher, /\bBash\b/, 'hook must cover Bash-driven edits');
});
