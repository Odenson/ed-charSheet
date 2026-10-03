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

test('shared permission baseline: build-feature git is pre-allowed, nothing broader', () => {
  for (const p of ['Bash(git add *)', 'Bash(git commit*)', 'Bash(git push origin dev*)'])
    assert.ok(s.permissions.allow.includes(p), `allow is missing ${p}`);
  // Ask outranks allow, so a broad ask would re-prompt the build; push is allowed to dev only.
  for (const p of ['Bash(git commit*)', 'Bash(git push*)'])
    assert.ok(!s.permissions.ask.includes(p), `ask must not contain ${p}`);
  assert.ok(!s.permissions.allow.some((p) => /git push/.test(p) && !/ dev/.test(p)),
    'allow may grant git push to dev only');
  for (const p of ['Bash(git merge*)', 'Bash(git pull*)', 'Bash(gh pr create*)', 'Bash(gh pr merge*)'])
    assert.ok(s.permissions.ask.includes(p), `ask is missing ${p}`);
});

test('guardrail hook stays wired', () => {
  const cmd = JSON.stringify(s.hooks.PreToolUse);
  assert.match(cmd, /guardrail-hook\.mjs/);
  assert.match(s.hooks.PreToolUse[0].matcher, /\bBash\b/, 'hook must cover Bash-driven edits');
});
