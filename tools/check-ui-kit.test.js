// tools/check-ui-kit.test.js — run with `npm test` (node --test, no deps).
// Exercises the UI-kit analyzer on in-memory fixtures (it is pure) plus a guard
// that the real repository passes against tools/ui-kit-baseline.json and ends in
// the state the ui-kit-modal-keyboard-contract build requires.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { RULES, countViolations, analyzeUiKit, listUiSources } from './check-ui-kit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const count = (src, rel = 'ui/ed-x.js') => countViolations(rel, src);
const baselinePath = resolve(ROOT, 'tools/ui-kit-baseline.json');

test('RULES lists the five rules in the fixed order', () => {
  assert.deepEqual(RULES, ['keydown', 'dialog-role', 'frame-css', 'font-size', 'button-style']);
});

test('countViolations returns every rule key, zero on clean source', () => {
  assert.deepEqual(count('export const x = 1;'), {
    keydown: 0, 'dialog-role': 0, 'frame-css': 0, 'font-size': 0, 'button-style': 0,
  });
});

// ---- keydown ----

test('keydown: document/window keydown and keyup listeners count', () => {
  assert.equal(count(`document.addEventListener('keydown', f);`).keydown, 1);
  assert.equal(count(`window.addEventListener("keyup", f);`).keydown, 1);
  assert.equal(count('document.addEventListener(`keydown`, f);').keydown, 1);
  assert.equal(count(`document . addEventListener ( 'keydown', f )`).keydown, 1);
  assert.equal(count(`document.addEventListener('keydown', a); window.addEventListener('keyup', b);`).keydown, 2);
});

test('keydown: element/this listeners, other events, and comments do not count', () => {
  assert.equal(count(`el.addEventListener('keydown', f);`).keydown, 0);
  assert.equal(count(`this.addEventListener('keydown', f);`).keydown, 0);
  assert.equal(count(`document.addEventListener('click', f);`).keydown, 0);
  assert.equal(count(`// document.addEventListener('keydown', f);`).keydown, 0);
  assert.equal(count(`/* window.addEventListener('keydown', f); */`).keydown, 0);
});

// ---- dialog-role ----

test('dialog-role: the role attribute counts', () => {
  assert.equal(count('html`<div role="dialog">`')['dialog-role'], 1);
  assert.equal(count(`html\`<div role='alertdialog'>\``)['dialog-role'], 1);
  assert.equal(count('html`<div role="dialog"></div><div role="dialog"></div>`')['dialog-role'], 2);
});

test('dialog-role: the selector string \'[role="dialog"]\' is not counted (gotcha)', () => {
  assert.equal(count(`const d = root.querySelector('[role="dialog"]');`)['dialog-role'], 0);
  assert.equal(count(`const s = '[ role="dialog"]';`)['dialog-role'], 0);
});

// ---- frame-css ----

test('frame-css: a frame class prelude in css`` counts once per prelude', () => {
  assert.equal(count('const s = css`.overlay { color: red }`;')['frame-css'], 1);
  assert.equal(count('const s = css`.modal { color: red }`;')['frame-css'], 1);
  assert.equal(count('const s = css`.mhead { color: red }`;')['frame-css'], 1);
  assert.equal(count('const s = css`.mclose { color: red }`;')['frame-css'], 1);
  assert.equal(count('const s = css`button.btn { color: red }`;')['frame-css'], 1);
  assert.equal(count('const s = css`.overlay { a: b } .modal { a: b } .mhead { a: b }`;')['frame-css'], 3);
});

test('frame-css: compound and descendant selectors count, one per prelude', () => {
  assert.equal(count('css`.modal.magic { a: b }`')['frame-css'], 1);
  assert.equal(count('css`.modal.magic .mtitle { a: b }`')['frame-css'], 1);
  assert.equal(count('css`button.btn.danger { a: b }`')['frame-css'], 1);
  assert.equal(count('css`.mhead .cr { a: b }`')['frame-css'], 1);
  assert.equal(count('css`.overlay, .modal { a: b }`')['frame-css'], 1);
});

test('frame-css: near-misses do not count', () => {
  assert.equal(count('css`.modal-x { a: b }`')['frame-css'], 0);
  assert.equal(count('css`.mtitle { a: b }`')['frame-css'], 0);
  assert.equal(count('css`.learnmodal { a: b }`')['frame-css'], 0);
  assert.equal(count("css`[data-variant='magic'] { a: b }`")['frame-css'], 0);
  assert.equal(count("css`[data-variant='magic'] .mtitle { a: b }`")['frame-css'], 0);
  assert.equal(count('css`.btn { a: b }`')['frame-css'], 0);
});

test('frame-css: an html property binding .overlay=${x} is not CSS (gotcha)', () => {
  assert.equal(count('const t = html`<div .overlay=${x}></div>`;')['frame-css'], 0);
  assert.equal(count('const t = html`<my-el .modal=${m} .overlay=${o}></my-el>`;')['frame-css'], 0);
});

test('frame-css: rules inside @media count; the @-prelude itself does not', () => {
  assert.equal(count('css`@media (max-width: 600px) { .overlay { a: b } }`')['frame-css'], 1);
  assert.equal(count('css`@media (max-width: 600px) { .x { a: b } }`')['frame-css'], 0);
  assert.equal(count('css`@keyframes modal { from { a: b } }`')['frame-css'], 0);
});

test('frame-css: <style> bodies count; comments inside CSS are removed', () => {
  assert.equal(count('const t = `<style>.modal { a: b }</style>`;')['frame-css'], 1);
  assert.equal(count('css`/* .overlay { a: b } */ .x { a: b }`')['frame-css'], 0);
});

test('frame-css: ${...} interpolations inside css`` do not derail the scan', () => {
  assert.equal(count('css`.x { color: ${c}; } .overlay { a: ${`b`}; }`')['frame-css'], 1);
  assert.equal(count('css`.x { color: ${f({a: 1})}; } .y { a: b }`')['frame-css'], 0);
});

test('frame-css: text outside css`` and <style> is not CSS', () => {
  assert.equal(count(`const s = '.overlay { a: b }';`)['frame-css'], 0);
});

// ---- font-size ----

test('font-size: a literal font-size counts; var(--fs-*) does not', () => {
  assert.equal(count('css`.x { font-size: 1rem }`')['font-size'], 1);
  assert.equal(count('css`.x { font-size:.9rem }`')['font-size'], 1);
  assert.equal(count('css`.x { font-size: inherit }`')['font-size'], 1);
  assert.equal(count('css`.x { font-size: 12px; } .y { font-size: 1em }`')['font-size'], 2);
  assert.equal(count('css`.x { font-size: var(--fs-body) }`')['font-size'], 0);
});

test('font-size: var(--fs-...) after extra whitespace is still allowed (gotcha)', () => {
  assert.equal(count('css`.x { font-size:    var(--fs-title) }`')['font-size'], 0);
  assert.equal(count('css`.x { font-size:\n    var(--fs-fine) }`')['font-size'], 0);
});

test('font-size: an inline style font-size counts', () => {
  assert.equal(count('html`<span style="font-size: 12px">x</span>`')['font-size'], 1);
});

test('font-size: redefining a --fs-* token outside index.html counts', () => {
  assert.equal(count('css`:host { --fs-body: .9rem }`')['font-size'], 1);
  assert.equal(count('css`:host { --fs-body: .9rem; --fs-title: 1rem; --fs-fine: .8rem }`')['font-size'], 3);
  assert.equal(count('css`.x { font-size: var(--fs-body); }`')['font-size'], 0);
});

// ---- button-style ----

test('button-style: a <button> with an inline style attribute counts', () => {
  assert.equal(count('html`<button style="color:red">x</button>`')['button-style'], 1);
  assert.equal(count('html`<button class="a" style=${s}>x</button>`')['button-style'], 1);
  assert.equal(count('html`<button\n  class="a"\n  style="color:red"\n>x</button>`')['button-style'], 1);
});

test('button-style: an arrow function in a binding does not end the tag early (gotcha)', () => {
  assert.equal(count('html`<button @click=${() => go()} style="color:red">x</button>`')['button-style'], 1);
  assert.equal(count('html`<button @click=${() => go()}>x</button>`')['button-style'], 0);
  assert.equal(count('html`<button ?disabled=${a > b} class="x">x</button>`')['button-style'], 0);
});

test('button-style: buttons without style, and other tags with style, do not count', () => {
  assert.equal(count('html`<button class="btn">x</button>`')['button-style'], 0);
  assert.equal(count('html`<button data-style="x">x</button>`')['button-style'], 0);
  assert.equal(count('html`<div style="color:red">x</div>`')['button-style'], 0);
  assert.equal(count('html`<button>x</button><span style="a:b"></span>`')['button-style'], 0);
});

test('button-style: counts each offending button', () => {
  assert.equal(count('html`<button style="a:b">1</button><button style="a:b">2</button><button>3</button>`')['button-style'], 2);
});

// ---- ui/kit exemption ----

test('a ui/kit/ file counts only font-size', () => {
  const src = [
    "document.addEventListener('keydown', f);",
    'const t = html`<div role="dialog"><button style="a:b">x</button></div>`;',
    'const s = css`.overlay { a: b } .modal { font-size: 1rem }`;',
  ].join('\n');
  assert.deepEqual(count(src, 'ui/kit/modal.js'), {
    keydown: 0, 'dialog-role': 0, 'frame-css': 0, 'font-size': 1, 'button-style': 0,
  });
  assert.equal(count(src, 'ui/ed-x.js').keydown, 1);
});

// ---- ratchet ----

const mod = (rel, src = '') => ({ rel, src });
const KD = `document.addEventListener('keydown', f);`;
const KD2 = `${KD}\n${KD}`;

test('analyzeUiKit: clean when counts equal the baseline; counts holds non-zero only', () => {
  const { counts, errors } = analyzeUiKit([mod('ui/a.js', KD), mod('ui/b.js', 'x')], { 'ui/a.js': { keydown: 1 } });
  assert.deepEqual(errors, []);
  assert.deepEqual(counts, { 'ui/a.js': { keydown: 1 } });
});

test('analyzeUiKit: new-violation when a file with an entry exceeds its allowance', () => {
  const { errors } = analyzeUiKit([mod('ui/a.js', KD2)], { 'ui/a.js': { keydown: 1 } });
  assert.equal(errors.length, 1);
  const e = errors[0];
  assert.deepEqual(
    { file: e.file, rule: e.rule, kind: e.kind, count: e.count, allowed: e.allowed },
    { file: 'ui/a.js', rule: 'keydown', kind: 'new-violation', count: 2, allowed: 1 },
  );
  assert.equal(e.msg, 'ui/a.js: keydown has 2, baseline allows 1 (new violation — use ui/kit/)');
});

test('analyzeUiKit: a new rule on a file that has an entry is a new-violation with allowed 0', () => {
  const { errors } = analyzeUiKit([mod('ui/a.js', `${KD}\ncss\`.overlay { a: b }\``)], { 'ui/a.js': { keydown: 1 } });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, 'new-violation');
  assert.equal(errors[0].rule, 'frame-css');
  assert.equal(errors[0].allowed, 0);
});

test('analyzeUiKit: no-entry when a file with no baseline entry has violations', () => {
  const { errors } = analyzeUiKit([mod('ui/new.js', KD)], {});
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, 'no-entry');
  assert.equal(errors[0].msg, 'ui/new.js: keydown has 1 but the file has no baseline entry (new violation — use ui/kit/)');
});

test('analyzeUiKit: ratchet when a count drops below the baseline', () => {
  const { errors } = analyzeUiKit([mod('ui/a.js', KD)], { 'ui/a.js': { keydown: 2 } });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, 'ratchet');
  assert.equal(errors[0].msg, 'ui/a.js: keydown has 1, baseline allows 2 — lower the baseline to 1');
  assert.match(errors[0].msg, /lower the baseline to 1/);
});

test('analyzeUiKit: ratchet to zero says "(delete the rule)"', () => {
  const { errors } = analyzeUiKit([mod('ui/a.js', 'x'), mod('ui/b.js', KD)], { 'ui/a.js': { keydown: 1 }, 'ui/b.js': { keydown: 1 } });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, 'ratchet');
  assert.equal(errors[0].msg, 'ui/a.js: keydown has 0, baseline allows 1 — lower the baseline to 0 (delete the rule)');
});

test('analyzeUiKit: stale-entry for a baseline file that is not in modules', () => {
  const { errors } = analyzeUiKit([mod('ui/a.js')], { 'ui/gone.js': { keydown: 1 } });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, 'stale-entry');
  assert.equal(errors[0].file, 'ui/gone.js');
  assert.equal(errors[0].msg, 'remove stale entry for ui/gone.js');
});

test('analyzeUiKit: bad-entry for an unknown rule, a non-positive-integer value, and an empty entry', () => {
  const msg = (rule) => `ui/a.js: bad baseline value for ${rule} (rules: ${RULES.join(', ')}; positive integers only)`;
  for (const [entry, rule] of [
    [{ nope: 1 }, 'nope'],
    [{ keydown: 0 }, 'keydown'],
    [{ keydown: -1 }, 'keydown'],
    [{ keydown: 1.5 }, 'keydown'],
    [{ keydown: '1' }, 'keydown'],
  ]) {
    const { errors } = analyzeUiKit([mod('ui/a.js', KD)], { 'ui/a.js': entry });
    const bad = errors.filter((e) => e.kind === 'bad-entry');
    assert.ok(bad.length >= 1, JSON.stringify(entry));
    assert.equal(bad[0].msg, msg(rule), JSON.stringify(entry));
  }
  const { errors } = analyzeUiKit([mod('ui/a.js')], { 'ui/a.js': {} });
  assert.ok(errors.some((e) => e.kind === 'bad-entry' && e.file === 'ui/a.js'));
});

test('analyzeUiKit: errors are sorted by file, then by RULES order', () => {
  const src = [KD, 'css`.overlay { a: b }`', 'css`.x { font-size: 1rem }`'].join('\n');
  const { errors } = analyzeUiKit([mod('ui/b.js', src), mod('ui/a.js', src)], {});
  assert.deepEqual(
    errors.map((e) => `${e.file}:${e.rule}`),
    ['ui/a.js:keydown', 'ui/a.js:frame-css', 'ui/a.js:font-size', 'ui/b.js:keydown', 'ui/b.js:frame-css', 'ui/b.js:font-size'],
  );
  for (const e of errors) assert.deepEqual(Object.keys(e).sort(), ['allowed', 'count', 'file', 'kind', 'msg', 'rule']);
});

test('analyzeUiKit: ui/kit/ files are only subject to font-size', () => {
  const { errors } = analyzeUiKit([mod('ui/kit/modal.js', `${KD}\ncss\`.overlay { a: b }\``)], {});
  assert.deepEqual(errors, []);
  const bad = analyzeUiKit([mod('ui/kit/modal.js', 'css`.x { font-size: 1rem }`')], {});
  assert.equal(bad.errors.length, 1);
  assert.equal(bad.errors[0].kind, 'no-entry');
});

test('analyzeUiKit: sees through comments', () => {
  const { counts, errors } = analyzeUiKit([mod('ui/a.js', `// ${KD}\n/* ${KD} */`)], {});
  assert.deepEqual(errors, []);
  assert.deepEqual(counts, {});
});

// ---- listUiSources ----

test('listUiSources: recursive, POSIX paths, excludes *.test.js', () => {
  const rels = listUiSources(ROOT);
  assert.ok(rels.length > 20);
  assert.ok(rels.includes('ui/ed-app.js'));
  assert.ok(rels.includes('ui/kit/modal-stack.js'), 'walks ui/kit/');
  assert.ok(rels.includes('ui/kit/modal-controller.js'));
  assert.ok(rels.every((r) => r.startsWith('ui/') && r.endsWith('.js') && !r.includes('\\')));
  assert.ok(!rels.some((r) => r.endsWith('.test.js')));
});

// ---- real repo ----

const loadRepo = () => {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const modules = listUiSources(ROOT).map((rel) => ({ rel, src: readFileSync(resolve(ROOT, rel), 'utf8') }));
  return { baseline, modules };
};

test('the real repository passes the UI-kit check against tools/ui-kit-baseline.json', () => {
  const { baseline, modules } = loadRepo();
  const { errors } = analyzeUiKit(modules, baseline);
  assert.deepEqual(errors, [], `ui-kit problems:\n${errors.map((e) => e.msg).join('\n')}`);
});

test('the baseline is well formed: sorted keys, known rules, positive integers', () => {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const files = Object.keys(baseline);
  assert.deepEqual(files, [...files].sort());
  for (const [file, entry] of Object.entries(baseline)) {
    assert.ok(Object.keys(entry).length > 0, file);
    for (const [rule, n] of Object.entries(entry)) {
      assert.ok(RULES.includes(rule), `${file}: ${rule}`);
      assert.ok(Number.isInteger(n) && n > 0, `${file}: ${rule}=${n}`);
    }
  }
});

test('end state: the seven migrated hosts and the old controller have no baseline entry', () => {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  for (const f of [
    'ui/ed-confirm.js', 'ui/ed-roll-modal.js', 'ui/ed-damage-modal.js', 'ui/ed-trade-modal.js',
    'ui/ed-equipment.js', 'ui/ed-disciplines.js', 'ui/modal-controller.js',
  ]) assert.ok(!(f in baseline), `${f} should have no baseline entry`);
});

test('end state: ed-spells.js keeps only font-size at 5; the other survivors match the spec', () => {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  assert.deepEqual(baseline['ui/ed-spells.js'], { 'font-size': 5 });
  assert.deepEqual(baseline['ui/ed-app.js'], { 'button-style': 1 });
  assert.deepEqual(baseline['ui/legend-spent-view.js'], { 'font-size': 2 });
});

test('end state: the baseline has exactly the 16 expected files', () => {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  assert.deepEqual(Object.keys(baseline), [
    'ui/ed-add-legend.js', 'ui/ed-app.js', 'ui/ed-changelog.js', 'ui/ed-character-picker.js',
    'ui/ed-combat.js', 'ui/ed-conflict.js', 'ui/ed-custom-item.js', 'ui/ed-day-reset.js',
    'ui/ed-edit-meta.js', 'ui/ed-homebrew.js', 'ui/ed-notes.js', 'ui/ed-overview.js',
    'ui/ed-save-key.js', 'ui/ed-settings.js', 'ui/ed-spells.js', 'ui/legend-spent-view.js',
  ]);
});

test('end state: the seven migrated hosts have no keydown/dialog-role/frame-css/button-style violations', () => {
  for (const rel of [
    'ui/ed-confirm.js', 'ui/ed-roll-modal.js', 'ui/ed-damage-modal.js', 'ui/ed-trade-modal.js',
    'ui/ed-equipment.js', 'ui/ed-spells.js', 'ui/ed-disciplines.js',
  ]) {
    const c = countViolations(rel, readFileSync(resolve(ROOT, rel), 'utf8'));
    assert.deepEqual(
      { keydown: c.keydown, 'dialog-role': c['dialog-role'], 'frame-css': c['frame-css'], 'button-style': c['button-style'] },
      { keydown: 0, 'dialog-role': 0, 'frame-css': 0, 'button-style': 0 },
      rel,
    );
  }
  // ed-trade-modal, ed-confirm, ed-roll-modal, ed-damage-modal, ed-equipment, ed-disciplines are font-size clean too.
  for (const rel of ['ui/ed-confirm.js', 'ui/ed-roll-modal.js', 'ui/ed-damage-modal.js', 'ui/ed-trade-modal.js', 'ui/ed-equipment.js', 'ui/ed-disciplines.js']) {
    assert.equal(countViolations(rel, readFileSync(resolve(ROOT, rel), 'utf8'))['font-size'], 0, rel);
  }
});

test('the controller moved: ui/modal-controller.js is gone and nothing imports the old path', () => {
  assert.ok(!existsSync(resolve(ROOT, 'ui/modal-controller.js')));
  assert.ok(existsSync(resolve(ROOT, 'ui/kit/modal-controller.js')));
  const { modules } = loadRepo();
  const old = /from\s+['"]\.\/modal-controller\.js['"]/;
  for (const { rel, src } of modules) {
    if (rel.startsWith('ui/kit/')) continue;
    assert.doesNotMatch(src, old, `${rel} still imports ./modal-controller.js`);
  }
});

test('package.json runs the check in pretest and exposes lint:ui-kit', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.pretest, 'node tools/check-imports.mjs && node tools/check-ui-kit.mjs');
  assert.equal(pkg.scripts['lint:ui-kit'], 'node tools/check-ui-kit.mjs');
});

test('the CLI exits 0 on the real repo and prints the success line', () => {
  const r = spawnSync(process.execPath, [resolve(ROOT, 'tools/check-ui-kit.mjs')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /✓ ui-kit check: \d+ files, baseline holds/);
});

test('data/changelog.json has the improved entry for the modal keyboard contract', () => {
  const log = JSON.parse(readFileSync(resolve(ROOT, 'data/changelog.json'), 'utf8'));
  const all = [...log.unreleased.changes, ...log.releases.flatMap((r) => r.changes)];
  const hit = all.find((c) => c.type === 'improved' && typeof c.text === 'string'
    && /Enter = OK/.test(c.text) && /Escape closes only the top/.test(c.text));
  assert.ok(hit, 'an "improved" changelog entry describing the shared modal keyboard contract');
});
