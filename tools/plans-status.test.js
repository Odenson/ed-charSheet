import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plansDir = path.join(root, 'plans');
const STATUSES = ['draft', 'approved', 'building', 'implemented', 'superseded'];

// Legacy plans/PLAN-*.md plus workflow plans/<slug>/plan.md.
function planFiles() {
  const out = [];
  for (const e of fs.readdirSync(plansDir, { withFileTypes: true })) {
    if (e.isFile() && /^PLAN-.*\.md$/.test(e.name)) out.push(path.join(plansDir, e.name));
    if (e.isDirectory()) {
      const f = path.join(plansDir, e.name, 'plan.md');
      if (fs.existsSync(f)) out.push(f);
    }
  }
  return out;
}

function frontmatter(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

test('every plan has valid status frontmatter', () => {
  const files = planFiles();
  assert.ok(files.length > 0, 'no plans found');
  for (const f of files) {
    const rel = path.relative(root, f);
    const fm = frontmatter(f);
    assert.ok(fm, `${rel}: missing frontmatter (see docs/FEATURE-WORKFLOW.md "Plan status")`);
    assert.ok(STATUSES.includes(fm.status), `${rel}: status "${fm.status}" not one of ${STATUSES.join('|')}`);
    if (fm.status === 'implemented' || fm.status === 'superseded')
      assert.ok(fm.shipped, `${rel}: ${fm.status} plans need a shipped: value (vX.Y.Z or unreleased)`);
    if (fm.status === 'superseded')
      assert.ok(fm.supersededBy, `${rel}: superseded plans need supersededBy:`);
    if (fm.shipped)
      assert.match(fm.shipped, /^(v\d+\.\d+\.\d+|unreleased)$/, `${rel}: bad shipped: "${fm.shipped}"`);
  }
});

test('shipped versions exist in data/changelog.json', () => {
  const log = JSON.parse(fs.readFileSync(path.join(root, 'data/changelog.json'), 'utf8'));
  const versions = new Set(log.releases.map((r) => 'v' + r.version));
  for (const f of planFiles()) {
    const fm = frontmatter(f);
    if (fm?.shipped && fm.shipped !== 'unreleased')
      assert.ok(versions.has(fm.shipped), `${path.relative(root, f)}: shipped ${fm.shipped} is not a changelog release`);
  }
});
