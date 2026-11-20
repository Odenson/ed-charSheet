// ui/kit/modal-stack.test.js — run with `npm test` (node --test, no deps).
// The stack, the ordered key router (R1–R15) and the footer hint are pure, so
// they are tested on plain facts. Spec: plans/ui-kit-modal-keyboard-contract/spec.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KINDS, createModalStack, routeKey, footerHint } from './modal-stack.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// A plain Enter on a non-primary, non-special element inside the top `input` modal.
const enter = (over = {}) => ({
  key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
  isComposing: false, defaultPrevented: false, repeat: false, latched: false,
  targetTag: 'div', targetType: '', targetRole: '', targetEnterLocal: false,
  targetIsPrimary: false, targetInTop: true, targetInForeignDialog: false,
  stackEmpty: false, kind: 'input', canConfirm: true,
  ...over,
});
const esc = (over = {}) => enter({ key: 'Escape', ...over });

// ---------------------------------------------------------------- stack

test('KINDS is the frozen four-kind list', () => {
  assert.deepEqual([...KINDS], ['input', 'confirm', 'info', 'picker']);
  assert.ok(Object.isFrozen(KINDS));
});

test('createModalStack: empty stack', () => {
  const s = createModalStack();
  assert.equal(s.top(), null);
  assert.equal(s.size(), 0);
  assert.deepEqual(s.entries(), []);
  assert.equal(s.has({}), false);
});

test('createModalStack: push, top is the last pushed, entries bottom to top', () => {
  const s = createModalStack();
  const a = { n: 'a' }, b = { n: 'b' };
  s.push(a); s.push(b);
  assert.equal(s.top(), b);
  assert.equal(s.size(), 2);
  assert.deepEqual(s.entries(), [a, b]);
  assert.ok(s.has(a) && s.has(b));
});

test('createModalStack: push of a present entry moves it to the top (idempotent)', () => {
  const s = createModalStack();
  const a = {}, b = {};
  s.push(a); s.push(b); s.push(a);
  assert.equal(s.top(), a);
  assert.equal(s.size(), 2);
  assert.deepEqual(s.entries(), [b, a]);
  s.push(a);
  assert.equal(s.size(), 2);
});

test('createModalStack: remove drops the entry; absent remove is a no-op', () => {
  const s = createModalStack();
  const a = {}, b = {}, c = {};
  s.push(a); s.push(b);
  s.remove(c);
  assert.equal(s.size(), 2);
  s.remove(b);
  assert.equal(s.top(), a);
  s.remove(a);
  assert.equal(s.top(), null);
  s.remove(a);
  assert.equal(s.size(), 0);
});

test('createModalStack: remove from the middle keeps the order', () => {
  const s = createModalStack();
  const a = {}, b = {}, c = {};
  s.push(a); s.push(b); s.push(c);
  s.remove(b);
  assert.deepEqual(s.entries(), [a, c]);
});

test('createModalStack: entries() returns a copy', () => {
  const s = createModalStack();
  const a = {};
  s.push(a);
  const copy = s.entries();
  copy.push({});
  copy.length = 0;
  assert.equal(s.size(), 1);
  assert.equal(s.top(), a);
});

test('createModalStack: clear empties the stack', () => {
  const s = createModalStack();
  s.push({}); s.push({});
  s.clear();
  assert.equal(s.size(), 0);
  assert.equal(s.top(), null);
});

test('createModalStack: stacks are independent instances', () => {
  const s1 = createModalStack(), s2 = createModalStack();
  s1.push({});
  assert.equal(s2.size(), 0);
});

// ---------------------------------------------------------------- router rules

test('R1: keys other than Enter/Escape pass, even when latched/repeating/empty', () => {
  for (const key of ['Tab', 'a', ' ', 'ArrowDown', 'Backspace']) {
    assert.equal(routeKey(enter({ key })), 'pass', key);
    assert.equal(routeKey(enter({ key, latched: true, repeat: true })), 'pass', `${key} latched`);
    assert.equal(routeKey(enter({ key, stackEmpty: true })), 'pass', `${key} empty`);
  }
});

test('R2: composing Enter/Escape pass (IME), beating latched and repeat', () => {
  assert.equal(routeKey(enter({ isComposing: true })), 'pass');
  assert.equal(routeKey(esc({ isComposing: true })), 'pass');
  assert.equal(routeKey(enter({ isComposing: true, latched: true })), 'pass');
  assert.equal(routeKey(enter({ isComposing: true, repeat: true })), 'pass');
});

test('R3: latched blocks, even with an empty stack, for Enter and Escape', () => {
  assert.equal(routeKey(enter({ latched: true })), 'block');
  assert.equal(routeKey(esc({ latched: true })), 'block');
  assert.equal(routeKey(enter({ latched: true, stackEmpty: true, kind: null, canConfirm: false })), 'block');
});

test('R3 beats R5: latched blocks even on a foreign dialog target', () => {
  assert.equal(routeKey(enter({ latched: true, targetInForeignDialog: true })), 'block');
});

test('R4: empty stack passes', () => {
  assert.equal(routeKey(enter({ stackEmpty: true, kind: null, canConfirm: false })), 'pass');
  assert.equal(routeKey(esc({ stackEmpty: true, kind: null, canConfirm: false })), 'pass');
  assert.equal(routeKey(esc({ stackEmpty: true, kind: null, repeat: true })), 'pass');
});

test('R5: a foreign dialog target passes', () => {
  assert.equal(routeKey(enter({ targetInForeignDialog: true })), 'pass');
  assert.equal(routeKey(esc({ targetInForeignDialog: true })), 'pass');
});

test('R5 beats R6 and R9: foreign wins over repeat and over outside-the-top', () => {
  assert.equal(routeKey(esc({ targetInForeignDialog: true, repeat: true })), 'pass');
  assert.equal(routeKey(enter({ targetInForeignDialog: true, repeat: true })), 'pass');
  assert.equal(routeKey(esc({ targetInForeignDialog: true, targetInTop: false })), 'pass');
  assert.equal(routeKey(enter({ targetInForeignDialog: true, targetInTop: false, shiftKey: true })), 'pass');
});

test('R6: repeat blocks', () => {
  assert.equal(routeKey(enter({ repeat: true })), 'block');
  assert.equal(routeKey(esc({ repeat: true })), 'block');
  assert.equal(routeKey(enter({ repeat: true, targetIsPrimary: true })), 'block');
});

test('R6 carve-out: plain repeating Enter in a textarea inside the top falls through (D2)', () => {
  // falls through to R13 (textarea owns Enter) -> pass
  assert.equal(routeKey(enter({ repeat: true, targetTag: 'textarea' })), 'pass');
});

test('R6 carve-out does not apply with Ctrl/Meta, outside the top, or for Escape', () => {
  assert.equal(routeKey(enter({ repeat: true, targetTag: 'textarea', ctrlKey: true })), 'block');
  assert.equal(routeKey(enter({ repeat: true, targetTag: 'textarea', metaKey: true })), 'block');
  assert.equal(routeKey(enter({ repeat: true, targetTag: 'textarea', targetInTop: false })), 'block');
  assert.equal(routeKey(esc({ repeat: true, targetTag: 'textarea' })), 'block');
  assert.equal(routeKey(enter({ repeat: true, targetTag: 'input' })), 'block');
});

test('R7: defaultPrevented passes', () => {
  assert.equal(routeKey(enter({ defaultPrevented: true })), 'pass');
  assert.equal(routeKey(esc({ defaultPrevented: true })), 'pass');
  assert.equal(routeKey(esc({ defaultPrevented: true, targetInTop: false })), 'pass');
});

test('R8: a kind-less (legacy) controller: Escape closes, Enter passes', () => {
  assert.equal(routeKey(esc({ kind: null })), 'close');
  assert.equal(routeKey(enter({ kind: null })), 'pass');
  assert.equal(routeKey(enter({ kind: null, targetIsPrimary: true })), 'pass');
  assert.equal(routeKey(enter({ kind: null, targetInTop: false })), 'pass');
  assert.equal(routeKey(esc({ kind: null, targetInTop: false })), 'close');
});

test('R8: a missing or unknown kind reads as null', () => {
  assert.equal(routeKey({ key: 'Escape' }), 'close');
  assert.equal(routeKey({ key: 'Enter' }), 'pass');
  assert.equal(routeKey(enter({ kind: 'bogus' })), 'pass');
  assert.equal(routeKey(esc({ kind: 'bogus' })), 'close');
  assert.equal(routeKey(enter({ kind: undefined })), 'pass');
});

test('missing booleans read as false', () => {
  assert.equal(routeKey({ key: 'Escape', kind: 'input' }), 'close');
  assert.equal(routeKey({ key: 'Enter', kind: 'info', targetInTop: true }), 'close');
});

test('R9: outside the top (behind the backdrop / body): Escape closes', () => {
  for (const kind of KINDS) assert.equal(routeKey(esc({ targetInTop: false, kind })), 'close', kind);
});

test('R9: outside the top: any modified Enter is blocked, never passed', () => {
  for (const mod of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    for (const kind of KINDS) {
      assert.equal(routeKey(enter({ targetInTop: false, kind, [mod]: true })), 'block', `${mod} ${kind}`);
    }
  }
});

test('R9: outside the top: plain Enter by kind', () => {
  assert.equal(routeKey(enter({ targetInTop: false, kind: 'info', canConfirm: false })), 'close');
  assert.equal(routeKey(enter({ targetInTop: false, kind: 'input', canConfirm: true })), 'confirm');
  assert.equal(routeKey(enter({ targetInTop: false, kind: 'confirm', canConfirm: true })), 'confirm');
  assert.equal(routeKey(enter({ targetInTop: false, kind: 'input', canConfirm: false })), 'block');
  assert.equal(routeKey(enter({ targetInTop: false, kind: 'confirm', canConfirm: false })), 'block');
  assert.equal(routeKey(enter({ targetInTop: false, kind: 'picker', canConfirm: true })), 'block');
});

test('R9 beats R13: a button target behind the top is still routed by R9', () => {
  assert.equal(routeKey(enter({ targetInTop: false, targetTag: 'button', kind: 'picker' })), 'block');
  assert.equal(routeKey(enter({ targetInTop: false, targetTag: 'textarea', kind: 'input' })), 'confirm');
});

test('R10: Escape inside the top closes for every kind', () => {
  for (const kind of KINDS) assert.equal(routeKey(esc({ kind })), 'close', kind);
  assert.equal(routeKey(esc({ targetTag: 'textarea' })), 'close');
  assert.equal(routeKey(esc({ targetTag: 'input', targetEnterLocal: true })), 'close');
});

test('R11: Shift+Enter and Alt+Enter inside the top pass', () => {
  assert.equal(routeKey(enter({ shiftKey: true })), 'pass');
  assert.equal(routeKey(enter({ altKey: true })), 'pass');
  assert.equal(routeKey(enter({ shiftKey: true, targetIsPrimary: true })), 'pass');
  assert.equal(routeKey(enter({ shiftKey: true, kind: 'info' })), 'pass');
});

test('R12: Ctrl/Meta+Enter in a textarea confirms when allowed, else passes', () => {
  assert.equal(routeKey(enter({ ctrlKey: true, targetTag: 'textarea', canConfirm: true })), 'confirm');
  assert.equal(routeKey(enter({ metaKey: true, targetTag: 'textarea', canConfirm: true })), 'confirm');
  assert.equal(routeKey(enter({ ctrlKey: true, targetTag: 'textarea', canConfirm: false })), 'pass');
  assert.equal(routeKey(enter({ metaKey: true, targetTag: 'textarea', canConfirm: false })), 'pass');
});

test('R12 vs R11: Ctrl+Shift+Enter in a textarea is Shift+Enter (R11 first) and passes', () => {
  assert.equal(routeKey(enter({ ctrlKey: true, shiftKey: true, targetTag: 'textarea' })), 'pass');
});

test('R13: own-control targets pass', () => {
  assert.equal(routeKey(enter({ targetTag: 'textarea' })), 'pass');
  assert.equal(routeKey(enter({ targetTag: 'select' })), 'pass');
  assert.equal(routeKey(enter({ targetTag: 'a' })), 'pass');
  assert.equal(routeKey(enter({ targetEnterLocal: true, targetTag: 'input' })), 'pass');
});

test('R13: a non-primary button-like target passes', () => {
  assert.equal(routeKey(enter({ targetTag: 'button' })), 'pass');
  assert.equal(routeKey(enter({ targetTag: 'div', targetRole: 'button' })), 'pass');
  for (const type of ['button', 'submit', 'reset', 'image']) {
    assert.equal(routeKey(enter({ targetTag: 'input', targetType: type })), 'pass', type);
  }
});

test('R13: a text input is not button-like (reaches R15)', () => {
  assert.equal(routeKey(enter({ targetTag: 'input', targetType: 'text' })), 'confirm');
  assert.equal(routeKey(enter({ targetTag: 'input', targetType: 'number' })), 'confirm');
});

test('R14: Enter on the primary confirms (info always; others when canConfirm), else blocks', () => {
  assert.equal(routeKey(enter({ targetIsPrimary: true, targetTag: 'button', kind: 'info', canConfirm: false })), 'confirm');
  assert.equal(routeKey(enter({ targetIsPrimary: true, targetTag: 'button', kind: 'input', canConfirm: true })), 'confirm');
  assert.equal(routeKey(enter({ targetIsPrimary: true, targetTag: 'button', kind: 'confirm', canConfirm: true })), 'confirm');
  assert.equal(routeKey(enter({ targetIsPrimary: true, targetTag: 'button', kind: 'input', canConfirm: false })), 'block');
  assert.equal(routeKey(enter({ targetIsPrimary: true, targetTag: 'button', kind: 'confirm', canConfirm: false })), 'block');
});

test('R14: the primary beats the button-like exemption in R13', () => {
  assert.equal(routeKey(enter({ targetIsPrimary: true, targetTag: 'input', targetType: 'submit', kind: 'input', canConfirm: true })), 'confirm');
  assert.equal(routeKey(enter({ targetIsPrimary: true, targetTag: 'div', targetRole: 'button', kind: 'input', canConfirm: true })), 'confirm');
});

test('R15: Enter by kind on an ordinary field', () => {
  assert.equal(routeKey(enter({ kind: 'info', canConfirm: false })), 'close');
  assert.equal(routeKey(enter({ kind: 'input', canConfirm: true })), 'confirm');
  assert.equal(routeKey(enter({ kind: 'confirm', canConfirm: true })), 'confirm');
  assert.equal(routeKey(enter({ kind: 'input', canConfirm: false })), 'pass');
  assert.equal(routeKey(enter({ kind: 'confirm', canConfirm: false })), 'pass');
  assert.equal(routeKey(enter({ kind: 'picker', canConfirm: true })), 'pass');
});

test('only the four route strings are ever returned', () => {
  const allowed = new Set(['close', 'confirm', 'block', 'pass']);
  for (const key of ['Enter', 'Escape', 'x'])
    for (const kind of [...KINDS, null])
      for (const over of [{}, { repeat: true }, { shiftKey: true }, { targetInTop: false }, { latched: true }, { canConfirm: false }, { targetIsPrimary: true }])
        assert.ok(allowed.has(routeKey(enter({ key, kind, ...over }))));
});

// ---------------------------------------------------------------- I1 ordering cases

test('ordering: a held Escape on a two-entry stack is swallowed after the first close', () => {
  assert.equal(routeKey(esc()), 'close');
  assert.equal(routeKey(esc({ repeat: true })), 'block');
  assert.equal(routeKey(esc({ repeat: true, latched: true })), 'block');
});

test('ordering: Shift+Enter and a picker plain Enter behind an open modal are blocked', () => {
  assert.equal(routeKey(enter({ targetInTop: false, shiftKey: true })), 'block');
  assert.equal(routeKey(enter({ targetInTop: false, kind: 'picker' })), 'block');
});

test('ordering: a latched Enter with an empty stack is blocked', () => {
  assert.equal(routeKey(enter({ latched: true, repeat: true, stackEmpty: true, kind: null })), 'block');
});

test('ordering: a checkbox in an input modal confirms; with data-enter=local it passes', () => {
  assert.equal(routeKey(enter({ targetTag: 'input', targetType: 'checkbox' })), 'confirm');
  assert.equal(routeKey(enter({ targetTag: 'input', targetType: 'checkbox', targetEnterLocal: true })), 'pass');
  assert.equal(routeKey(enter({ targetTag: 'input', targetType: 'radio' })), 'confirm');
});

test('ordering: Ctrl/Meta+Enter outside a textarea routes like plain Enter', () => {
  for (const mod of ['ctrlKey', 'metaKey']) {
    assert.equal(routeKey(enter({ [mod]: true, targetTag: 'input', targetType: 'text' })), 'confirm');
    assert.equal(routeKey(enter({ [mod]: true, kind: 'info' })), 'close');
    assert.equal(routeKey(enter({ [mod]: true, kind: 'input', canConfirm: false })), 'pass');
    assert.equal(routeKey(enter({ [mod]: true, kind: 'picker' })), 'pass');
    assert.equal(routeKey(enter({ [mod]: true, targetTag: 'select' })), 'pass');
    assert.equal(routeKey(enter({ [mod]: true, targetIsPrimary: true, targetTag: 'button' })), 'confirm');
  }
});

// ---------------------------------------------------------------- footerHint

test('footerHint: default and textarea strings (U+00B7 separator)', () => {
  assert.equal(footerHint(), 'Enter = OK · Esc = Cancel');
  assert.equal(footerHint({}), 'Enter = OK · Esc = Cancel');
  assert.equal(footerHint({ hasTextarea: false }), 'Enter = OK · Esc = Cancel');
  assert.equal(footerHint({ hasTextarea: true }), 'Ctrl+Enter saves · Esc = Cancel');
  assert.ok(footerHint().includes('·'));
});

// ---------------------------------------------------------------- purity

test('modal-stack.js imports no lit and touches no document/window global', () => {
  const src = readFileSync(resolve(HERE, 'modal-stack.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.doesNotMatch(src, /from\s+['"]lit/);
  assert.doesNotMatch(src, /\bdocument\b/);
  assert.doesNotMatch(src, /\bwindow\b/);
});
