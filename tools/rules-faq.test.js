import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const faq = fs.readFileSync(path.join(root, 'docs/RULES-FAQ.md'), 'utf8');
const ids = [...faq.matchAll(/^### Q(\d+) — /gm)].map((m) => Number(m[1]));

test('RULES-FAQ entry ids are unique', () => {
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], `duplicate FAQ ids: ${dupes.map((n) => 'Q' + String(n).padStart(3, '0'))}`);
});

test('RULES-FAQ entry ids run in order from Q001 with no gaps', () => {
  assert.ok(ids.length > 0, 'no FAQ entries found');
  ids.forEach((id, i) => assert.equal(id, i + 1, `entry ${i + 1} has id Q${String(id).padStart(3, '0')}`));
});
