import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { check, apply, nextVersion } from './release.mjs';

function fixture({ changes = [{ type: 'added', text: 'a' }], plans = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.mkdirSync(path.join(root, 'plans'));
  fs.writeFileSync(path.join(root, 'data/changelog.json'), JSON.stringify({
    schema: 'ed-changelog/1', note: 'n',
    unreleased: { summary: '', changes },
    releases: [{ version: '1.2.3', date: '2026-01-01', summary: 's', changes: [{ type: 'fixed', text: 'x' }] }],
  }, null, 2) + '\n');
  for (const [name, fm] of Object.entries(plans)) {
    const dir = path.join(root, 'plans', name);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'plan.md'), `---\n${fm}\n---\n# Plan ${name}\n`);
  }
  return root;
}
const IMPL = 'status: implemented\nshipped: unreleased';

test('nextVersion: fixes only is a patch, anything else a minor', () => {
  assert.deepEqual(nextVersion('1.2.3', ['fixed', 'fixed']), { version: '1.2.4', bump: 'patch' });
  assert.deepEqual(nextVersion('1.2.3', ['fixed', 'added']), { version: '1.3.0', bump: 'minor' });
  assert.deepEqual(nextVersion('1.2.3', ['changed']), { version: '1.3.0', bump: 'minor' });
});

test('check: clean full release proposes a version and lists plans', () => {
  const root = fixture({ plans: { feat: IMPL } });
  const r = check({ root });
  assert.equal(r.ok, true);
  assert.equal(r.proposed.version, '1.3.0');
  assert.deepEqual(r.plansToMarkShipped, ['feat']);
});

test('check: nothing unreleased stops', () => {
  const r = check({ root: fixture({ changes: [] }) });
  assert.equal(r.ok, false);
  assert.match(r.stops[0], /Nothing to release/);
});

test('check: slug must be implemented + unreleased', () => {
  const root = fixture({ plans: { feat: IMPL, wip: 'status: building' } });
  assert.equal(check({ root, slug: 'feat' }).headline, 'feat');
  assert.equal(check({ root, slug: 'wip' }).ok, false);
  assert.equal(check({ root, slug: 'nope' }).ok, false);
});

test('check: warns about in-flight plans and unreleased lines with no plan', () => {
  const r = check({ root: fixture({ plans: { wip: 'status: draft' } }) });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => /still draft/.test(w)));
  assert.ok(r.warnings.some((w) => /no plan is/.test(w)));
});

test('apply: moves unreleased into a new top release and marks plans shipped', () => {
  const root = fixture({ plans: { feat: IMPL, other: 'status: implemented\nshipped: v1.0.0' } });
  const out = apply({ root, version: '1.3.0', summary: 'Sum', date: '2026-10-02' });
  assert.deepEqual(out, { version: '1.3.0', marked: ['feat'] });
  const log = JSON.parse(fs.readFileSync(path.join(root, 'data/changelog.json'), 'utf8'));
  assert.equal(log.releases[0].version, '1.3.0');
  assert.equal(log.releases[0].summary, 'Sum');
  assert.deepEqual(log.releases[0].changes, [{ type: 'added', text: 'a' }]);
  assert.deepEqual(log.unreleased, { summary: '', changes: [] });
  assert.match(fs.readFileSync(path.join(root, 'plans/feat/plan.md'), 'utf8'), /shipped: v1\.3\.0/);
  assert.match(fs.readFileSync(path.join(root, 'plans/other/plan.md'), 'utf8'), /shipped: v1\.0\.0/);
});

test('apply: rejects bad input and duplicate versions', () => {
  const root = fixture();
  assert.throws(() => apply({ root, version: 'x', summary: 's', date: '2026-10-02' }), /bad version/);
  assert.throws(() => apply({ root, version: '1.3.0', summary: ' ', date: '2026-10-02' }), /summary/);
  assert.throws(() => apply({ root, version: '1.2.3', summary: 's', date: '2026-10-02' }), /already released/);
  assert.throws(() => apply({ root: fixture({ changes: [] }), version: '1.3.0', summary: 's', date: '2026-10-02' }), /nothing unreleased/);
});
