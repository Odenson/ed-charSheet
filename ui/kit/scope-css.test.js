// ui/kit/scope-css.test.js — run with `npm test`. Pure helper; spec: plans/ui-kit-modal-migration-2/spec.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeCss } from './scope-css.js';

test('wraps css in the scope selector using native nesting', () => {
  assert.equal(scopeCss('.overlay { color: red; }', '.kit-portal'), '.kit-portal { .overlay { color: red; } }');
});

test('empty css still yields the wrapper', () => {
  assert.equal(scopeCss('', '.kit-portal'), '.kit-portal {  }');
});

test('the scope selector passes through unchanged', () => {
  const out = scopeCss('a{b:c}', '#x > .y');
  assert.ok(out.startsWith('#x > .y {'));
  assert.ok(out.includes('a{b:c}'));
  assert.ok(out.endsWith('}'));
});

test('multiple rules stay inside one wrapper', () => {
  const css = '.a{x:1}\n.b{y:2}';
  assert.equal(scopeCss(css, '.s'), `.s { ${css} }`);
});
