import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expected } from './sync-agents.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('generated agent files match .agents/ source', () => {
  for (const [rel, text] of Object.entries(expected())) {
    assert.equal(fs.readFileSync(path.join(root, rel), 'utf8'), text,
      `${rel} is stale — run node tools/sync-agents.mjs`);
  }
});
