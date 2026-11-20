// ui/kit/modal-controller.test.js — run with `npm test` (node --test, no deps).
// The controller is lit-free and its DOM wiring is guarded by
// `typeof document !== 'undefined'`, so under node no listener registers and we
// drive it through handleKeydown/handleKeyup/releaseAllKeys with plain facts and
// a fake host. Spec: plans/ui-kit-modal-keyboard-contract/spec.md.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ModalController, modalStack, handleKeydown, handleKeyup, releaseAllKeys,
  __resetModalKit, FOCUSABLE,
} from './modal-controller.js';

beforeEach(() => __resetModalKit());

const settle = () => new Promise((r) => setImmediate(r));

// ---- fakes ---------------------------------------------------------------

const fakeEl = (over = {}) => ({
  disabled: false, n: 0,
  focus() { this.n += 1; },
  hasAttribute(a) { return !!this.attrs?.[a]; },
  setAttribute(a, v) { (this.attrs ??= {})[a] = v; },
  ...over,
});

// A dialog whose querySelector/All read a `selector -> [fakeEl]` map.
const fakeDialog = (map = {}) => {
  const d = fakeEl({
    map,
    querySelector(sel) { return this.map[sel]?.[0] ?? null; },
    querySelectorAll(sel) { return this.map[sel] ?? []; },
  });
  return d;
};

const fakeTrigger = () => ({
  isConnected: true, style: {}, n: 0,
  focus() { this.n = (this.n ?? 0) + 1; },
  addEventListener() {}, removeEventListener() {},
});

const fakeHost = () => {
  const roots = {};
  return {
    roots,
    addController() {},
    updateComplete: Promise.resolve(true),
    renderRoot: {
      activeElement: null,
      querySelector(sel) { return roots[sel] ?? null; },
      querySelectorAll() { return []; },
    },
  };
};

// Build a controller and (optionally) mount a fake dialog under its data-modal id.
const make = (opts = {}, { dialog } = {}) => {
  const host = fakeHost();
  const ctl = new ModalController(host, opts);
  if (dialog) {
    const sel = opts.kind != null || opts.dialogSelector ? (opts.dialogSelector ?? `[data-modal="${ctl.id}"]`) : '[role="dialog"]';
    host.roots[sel] = dialog;
  }
  return { host, ctl };
};

// Facts the DOM wrapper would compute for a key inside the top modal.
const facts = (key, over = {}) => ({
  key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
  isComposing: false, defaultPrevented: false, repeat: false,
  targetTag: 'div', targetType: '', targetRole: '', targetEnterLocal: false,
  targetIsPrimary: false, targetInTop: true, targetInForeignDialog: false,
  ...over,
});
const ENTER = (over) => facts('Enter', over);
const ESCAPE = (over) => facts('Escape', over);

// ---- identity / stack lifecycle -----------------------------------------

test('each controller gets a unique kit-modal-<n> id', () => {
  const a = make().ctl, b = make().ctl;
  assert.match(a.id, /^kit-modal-\d+$/);
  assert.match(b.id, /^kit-modal-\d+$/);
  assert.notEqual(a.id, b.id);
});

test('the controller registers itself with the host', () => {
  let added = null;
  const host = { ...fakeHost(), addController(c) { added = c; } };
  const ctl = new ModalController(host, { kind: 'info' });
  assert.equal(added, ctl);
});

test('opened pushes onto the shared stack; close removes it', () => {
  const { ctl } = make({ kind: 'info' });
  assert.equal(ctl.open, false);
  assert.equal(modalStack.size(), 0);
  ctl.opened(fakeTrigger());
  assert.equal(ctl.open, true);
  assert.equal(modalStack.size(), 1);
  ctl.close();
  assert.equal(ctl.open, false);
  assert.equal(modalStack.size(), 0);
});

test('re-opening moves the entry to the top and does not duplicate it', () => {
  const a = make({ kind: 'info' }).ctl, b = make({ kind: 'info' }).ctl;
  a.opened(fakeTrigger()); b.opened(fakeTrigger());
  assert.equal(modalStack.top(), b);
  a.opened(null);
  assert.equal(modalStack.top(), a);
  assert.equal(modalStack.size(), 2);
});

test('a non-null trigger on re-open replaces the stored one; null keeps it', () => {
  const t1 = fakeTrigger(), t2 = fakeTrigger();
  const { ctl } = make({ kind: 'info' });
  ctl.opened(t1);
  ctl.opened(null);
  ctl.close();
  assert.equal(t1.n, 1);
  ctl.opened(t1);
  ctl.opened(t2);
  ctl.close();
  assert.equal(t2.n, 1);
  assert.equal(t1.n, 1);
});

test('close() when not open is a no-op (no onClose)', () => {
  let n = 0;
  const { ctl } = make({ kind: 'info', onClose: () => { n += 1; } });
  ctl.close();
  assert.equal(n, 0);
});

test('the kind option is exposed through the ctl.kind getter, function re-read each time', () => {
  assert.equal(make({ kind: 'picker' }).ctl.kind, 'picker');
  assert.equal(make({}).ctl.kind, null);
  let k = 'input';
  const { ctl } = make({ kind: () => k });
  assert.equal(ctl.kind, 'input');
  k = 'info';
  assert.equal(ctl.kind, 'info');
});

// ---- Escape routing: top only --------------------------------------------

test('Escape closes only the top of two stacked controllers, twice', () => {
  const closed = [];
  const a = make({ kind: 'info', onClose: () => closed.push('a') }).ctl;
  const b = make({ kind: 'info', onClose: () => closed.push('b') }).ctl;
  a.opened(fakeTrigger()); b.opened(fakeTrigger());

  assert.equal(handleKeydown(ESCAPE()), 'close');
  assert.deepEqual(closed, ['b']);
  assert.equal(modalStack.top(), a);
  handleKeyup('Escape');

  assert.equal(handleKeydown(ESCAPE()), 'close');
  assert.deepEqual(closed, ['b', 'a']);
  assert.equal(modalStack.size(), 0);
});

test('a held Escape (repeat) closes only the top once and leaves the lower modal open', () => {
  const closed = [];
  const a = make({ kind: 'info', onClose: () => closed.push('a') }).ctl;
  const b = make({ kind: 'info', onClose: () => closed.push('b') }).ctl;
  a.opened(fakeTrigger()); b.opened(fakeTrigger());
  assert.equal(handleKeydown(ESCAPE()), 'close');
  assert.equal(handleKeydown(ESCAPE({ repeat: true })), 'block');
  assert.equal(handleKeydown(ESCAPE({ repeat: true })), 'block');
  assert.deepEqual(closed, ['b']);
  assert.equal(a.open, true);
  handleKeyup('Escape');
  assert.equal(handleKeydown(ESCAPE()), 'close');
  assert.deepEqual(closed, ['b', 'a']);
});

test('Escape with no open modal passes and does nothing', () => {
  assert.equal(handleKeydown(ESCAPE()), 'pass');
});

test('a hand-off from onClose leaves the new modal on top', () => {
  let b;
  const a = make({ kind: 'input', onClose: () => b.opened(null) }).ctl;
  b = make({ kind: 'info' }).ctl;
  a.opened(fakeTrigger());
  a.close({ restoreFocus: false });
  assert.equal(modalStack.size(), 1);
  assert.equal(modalStack.top(), b);
  assert.equal(b.open, true);
});

test('inside onClose the trigger is already focused and the stack no longer holds the controller', () => {
  const trigger = fakeTrigger();
  let seen;
  const { ctl } = make({
    kind: 'info',
    onClose: () => { seen = { focused: trigger.n, held: modalStack.entries().includes(ctl), open: ctl.open }; },
  });
  ctl.opened(trigger);
  ctl.close();
  assert.deepEqual(seen, { focused: 1, held: false, open: false });
});

test('close({ restoreFocus: false }) does not touch the trigger', () => {
  const trigger = fakeTrigger();
  const { ctl } = make({ kind: 'info' });
  ctl.opened(trigger);
  ctl.close({ restoreFocus: false });
  assert.equal(trigger.n, 0);
  assert.equal(modalStack.size(), 0);
});

test('hostDisconnected removes the entry, restores focus, and does not call onClose', () => {
  const trigger = fakeTrigger();
  let called = 0;
  const { ctl } = make({ kind: 'info', onClose: () => { called += 1; } });
  ctl.opened(trigger);
  ctl.hostDisconnected();
  assert.equal(ctl.open, false);
  assert.equal(modalStack.size(), 0);
  assert.equal(trigger.n, 1);
  assert.equal(called, 0);
});

test('hostDisconnected when not open is harmless; hostConnected is a no-op', () => {
  const { ctl } = make({ kind: 'info' });
  ctl.hostConnected();
  ctl.hostDisconnected();
  assert.equal(modalStack.size(), 0);
});

// ---- dirty guard ----------------------------------------------------------

test('dirty modal: Escape and requestClose ask via onDiscardPrompt and stay open', () => {
  let prompts = 0, closes = 0;
  const { ctl } = make({
    kind: 'input', isDirty: () => true, onDiscardPrompt: () => { prompts += 1; },
    onClose: () => { closes += 1; },
  });
  ctl.opened(fakeTrigger());
  assert.equal(handleKeydown(ESCAPE()), 'close');
  assert.equal(prompts, 1);
  ctl.requestClose();
  assert.equal(prompts, 2);
  assert.equal(closes, 0);
  assert.equal(ctl.open, true);
  assert.equal(modalStack.size(), 1);
});

test('dirty modal: programmatic close() is unguarded', () => {
  let prompts = 0, reasons = [];
  const { ctl } = make({
    kind: 'input', isDirty: () => true, onDiscardPrompt: () => { prompts += 1; },
    onClose: (r) => reasons.push(r),
  });
  ctl.opened(fakeTrigger());
  ctl.close();
  assert.equal(prompts, 0);
  assert.deepEqual(reasons, ['cancel']);
  assert.equal(ctl.open, false);
});

test('clean modal, or dirty with no prompt hook, closes on requestClose', () => {
  const r1 = [], r2 = [];
  const clean = make({ kind: 'input', isDirty: () => false, onDiscardPrompt: () => assert.fail('no prompt'), onClose: (r) => r1.push(r) }).ctl;
  clean.opened(null); clean.requestClose();
  assert.deepEqual(r1, ['cancel']);
  const noHook = make({ kind: 'input', isDirty: () => true, onClose: (r) => r2.push(r) }).ctl;
  noHook.opened(null); noHook.requestClose();
  assert.deepEqual(r2, ['cancel']);
});

// ---- reasons / confirm ----------------------------------------------------

test('requestClose gives reason cancel; info confirm() gives confirm', () => {
  const reasons = [];
  const a = make({ kind: 'info', onClose: (r) => reasons.push(r) }).ctl;
  a.opened(null); a.requestClose();
  const b = make({ kind: 'info', onClose: (r) => reasons.push(r) }).ctl;
  b.opened(null); b.confirm();
  assert.deepEqual(reasons, ['cancel', 'confirm']);
});

test('close({ reason }) passes the reason to onClose', () => {
  const reasons = [];
  const { ctl } = make({ kind: 'input', onClose: (r) => reasons.push(r) });
  ctl.opened(null); ctl.close({ reason: 'confirm' });
  assert.deepEqual(reasons, ['confirm']);
});

test('input confirm() calls onConfirm and never closes by itself', () => {
  let confirms = 0, closes = 0;
  const { ctl } = make({ kind: 'input', canConfirm: () => true, onConfirm: () => { confirms += 1; }, onClose: () => { closes += 1; } });
  ctl.opened(null);
  ctl.confirm();
  assert.equal(confirms, 1);
  assert.equal(closes, 0);
  assert.equal(ctl.open, true);
});

test('confirm kind behaves like input; confirm() is a no-op when canConfirm is false or not open', () => {
  let confirms = 0;
  let can = false;
  const { ctl } = make({ kind: 'confirm', canConfirm: () => can, onConfirm: () => { confirms += 1; } });
  ctl.confirm();
  assert.equal(confirms, 0);
  ctl.opened(null);
  ctl.confirm();
  assert.equal(confirms, 0);
  can = true;
  ctl.confirm();
  assert.equal(confirms, 1);
});

test('ctl.canConfirm() is false unless kind is input or confirm', () => {
  for (const kind of ['info', 'picker', null]) {
    const { ctl } = make({ kind, canConfirm: () => true });
    assert.equal(ctl.canConfirm(), false, String(kind));
  }
  assert.equal(make({ kind: 'input', canConfirm: () => true }).ctl.canConfirm(), true);
  assert.equal(make({ kind: 'confirm', canConfirm: () => true }).ctl.canConfirm(), true);
});

test('default canConfirm: true iff the primary exists and is not disabled', () => {
  const primary = fakeEl();
  const dialog = fakeDialog({ '[data-primary]': [primary] });
  const { ctl } = make({ kind: 'input' }, { dialog });
  assert.equal(ctl.primaryEl(), primary);
  assert.equal(ctl.canConfirm(), true);
  primary.disabled = true;
  assert.equal(ctl.canConfirm(), false);
  dialog.map['[data-primary]'] = [];
  assert.equal(ctl.primaryEl(), null);
  assert.equal(ctl.canConfirm(), false);
});

test('primarySelector option overrides the primary lookup', () => {
  const p = fakeEl();
  const dialog = fakeDialog({ '.go': [p] });
  const { ctl } = make({ kind: 'input', primarySelector: '.go' }, { dialog });
  assert.equal(ctl.primaryEl(), p);
});

test('dialogEl: a kind controller finds only [data-modal=id]; a legacy one uses [role="dialog"]', () => {
  const host = fakeHost();
  const kindCtl = new ModalController(host, { kind: 'info' });
  const dlg = fakeDialog();
  host.roots['[role="dialog"]'] = dlg;
  assert.equal(kindCtl.dialogEl(), null);
  host.roots[`[data-modal="${kindCtl.id}"]`] = dlg;
  assert.equal(kindCtl.dialogEl(), dlg);

  const host2 = fakeHost();
  const legacy = new ModalController(host2, {});
  host2.roots['[role="dialog"]'] = dlg;
  assert.equal(legacy.dialogEl(), dlg);
});

test('dialogSelector wins over the defaults', () => {
  const host = fakeHost();
  const ctl = new ModalController(host, { kind: 'info', dialogSelector: '.custom' });
  const dlg = fakeDialog();
  host.roots['.custom'] = dlg;
  assert.equal(ctl.dialogEl(), dlg);
});

test('handleKeydown fills kind/canConfirm from the top and routes Enter to confirm', () => {
  let confirms = 0;
  const { ctl } = make({ kind: 'input', canConfirm: () => true, onConfirm: () => { confirms += 1; } });
  ctl.opened(null);
  assert.equal(handleKeydown(ENTER({ targetIsPrimary: true, targetTag: 'button' })), 'confirm');
  assert.equal(confirms, 1);
});

test('canConfirm is evaluated per key', () => {
  let can = false, confirms = 0;
  const { ctl } = make({ kind: 'input', canConfirm: () => can, onConfirm: () => { confirms += 1; } });
  ctl.opened(null);
  assert.equal(handleKeydown(ENTER()), 'pass');
  handleKeyup('Enter');
  can = true;
  assert.equal(handleKeydown(ENTER()), 'confirm');
  assert.equal(confirms, 1);
});

test('handleKeydown: onSwallow is called for non-pass results only', () => {
  const { ctl } = make({ kind: 'info' });
  let swallowed = 0;
  assert.equal(handleKeydown(ESCAPE(), () => { swallowed += 1; }), 'pass'); // empty stack
  assert.equal(swallowed, 0);
  ctl.opened(null);
  assert.equal(handleKeydown(facts('Tab'), () => { swallowed += 1; }), 'pass');
  assert.equal(swallowed, 0);
  assert.equal(handleKeydown(ESCAPE(), () => { swallowed += 1; }), 'close');
  assert.equal(swallowed, 1);
});

test('Enter on a read-only (info) modal closes it with reason confirm', () => {
  const reasons = [];
  const { ctl } = make({ kind: 'info', onClose: (r) => reasons.push(r) });
  ctl.opened(null);
  // route result is close for a plain field target; the controller's requestClose gives cancel,
  // while Enter on the info OK/primary confirms (reason confirm).
  assert.equal(handleKeydown(ENTER({ targetIsPrimary: true, targetTag: 'button' })), 'confirm');
  assert.deepEqual(reasons, ['confirm']);
  assert.equal(ctl.open, false);
});

// ---- legacy (no kind) -----------------------------------------------------

test('a controller with no kind is legacy-neutral: Enter passes, Escape closes', () => {
  let closes = 0;
  const { ctl } = make({ onClose: () => { closes += 1; } });
  ctl.opened(fakeTrigger());
  assert.equal(handleKeydown(ENTER()), 'pass');
  assert.equal(closes, 0);
  handleKeyup('Enter');
  assert.equal(handleKeydown(ESCAPE()), 'close');
  assert.equal(closes, 1);
});

test('a legacy controller as top is still subject to Escape top-only with a kit modal below', () => {
  const closed = [];
  const kit = make({ kind: 'info', onClose: () => closed.push('kit') }).ctl;
  const legacy = make({ onClose: () => closed.push('legacy') }).ctl;
  kit.opened(null); legacy.opened(null);
  handleKeydown(ESCAPE());
  assert.deepEqual(closed, ['legacy']);
});

test('the kind function is re-read per key', () => {
  let k = 'info';
  const { ctl } = make({ kind: () => k });
  ctl.opened(null);
  assert.equal(handleKeydown(ENTER()), 'close');
  ctl.opened(null);
  handleKeyup('Enter');
  k = 'picker';
  assert.equal(handleKeydown(ENTER()), 'pass');
});

// ---- latch ----------------------------------------------------------------

test('latch: a routed close while Enter is held blocks the repeat with an empty stack; keyup releases', () => {
  const { ctl } = make({ kind: 'info' });
  ctl.opened(null);
  assert.equal(handleKeydown(ENTER()), 'close');
  assert.equal(modalStack.size(), 0);
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'block');
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'block');
  handleKeyup('Enter');
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'pass');
  assert.equal(handleKeydown(ENTER()), 'pass');
});

test('latch only affects repeats: a fresh (non-repeat) press after a latched close passes', () => {
  const { ctl } = make({ kind: 'info' });
  ctl.opened(null);
  handleKeydown(ENTER());
  assert.equal(handleKeydown(ENTER()), 'pass');
});

test('an Escape latch never swallows an Enter repeat', () => {
  const { ctl } = make({ kind: 'info' });
  ctl.opened(null);
  assert.equal(handleKeydown(ESCAPE()), 'close');
  assert.equal(handleKeydown(ESCAPE({ repeat: true })), 'block');
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'pass');
});

test('latch: a close with no key held latches nothing', () => {
  const { ctl } = make({ kind: 'info' });
  ctl.opened(null);
  ctl.close();
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'pass');
});

test('latch: only keys already held are latched (a key pressed after the close is not)', () => {
  const { ctl } = make({ kind: 'info' });
  ctl.opened(null);
  ctl.close();
  assert.equal(handleKeydown(ENTER()), 'pass');
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'pass');
});

test('latch: native-click path - Enter passes on Cancel, then requestClose() still latches it', () => {
  const { ctl } = make({ kind: 'input', canConfirm: () => true });
  ctl.opened(null);
  assert.equal(handleKeydown(ENTER({ targetTag: 'button' })), 'pass');
  ctl.requestClose();
  assert.equal(modalStack.size(), 0);
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'block');
});

test('latch: confirm() latches held keys, so Enter held on OK does not re-fire after onConfirm closes', () => {
  let ctlRef;
  const { ctl } = make({
    kind: 'input', canConfirm: () => true,
    onConfirm: () => ctlRef.close({ reason: 'confirm' }),
  });
  ctlRef = ctl;
  ctl.opened(null);
  assert.equal(handleKeydown(ENTER({ targetIsPrimary: true, targetTag: 'button' })), 'confirm');
  assert.equal(modalStack.size(), 0);
  assert.equal(handleKeydown(ENTER({ repeat: true, targetTag: 'button' })), 'block');
});

test('latch: hostDisconnected while open latches held keys', () => {
  const { ctl } = make({ kind: 'input', canConfirm: () => false });
  ctl.opened(null);
  assert.equal(handleKeydown(ENTER({ targetTag: 'button' })), 'pass');
  ctl.hostDisconnected();
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'block');
});

test('composing keys are not recorded as held, so they never latch', () => {
  const { ctl } = make({ kind: 'info' });
  ctl.opened(null);
  assert.equal(handleKeydown(ENTER({ isComposing: true })), 'pass');
  ctl.close();
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'pass');
});

test('releaseAllKeys clears held and latched keys (window blur)', () => {
  const { ctl } = make({ kind: 'info' });
  ctl.opened(null);
  handleKeydown(ENTER());
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'block');
  releaseAllKeys();
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'pass');
});

test('releaseAllKeys also forgets held keys so a later close latches nothing', () => {
  const { ctl } = make({ kind: 'input', canConfirm: () => false });
  ctl.opened(null);
  handleKeydown(ENTER({ targetTag: 'button' }));
  releaseAllKeys();
  ctl.close();
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'pass');
});

test('handleKeyup removes a key from held (a later close does not latch it)', () => {
  const { ctl } = make({ kind: 'input', canConfirm: () => false });
  ctl.opened(null);
  handleKeydown(ENTER({ targetTag: 'button' }));
  handleKeyup('Enter');
  ctl.close();
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'pass');
});

test('__resetModalKit clears the stack and the key sets', () => {
  const { ctl } = make({ kind: 'info' });
  ctl.opened(null);
  handleKeydown(ENTER());
  __resetModalKit();
  assert.equal(modalStack.size(), 0);
  assert.equal(handleKeydown(ENTER({ repeat: true })), 'pass');
});

// ---- initial focus --------------------------------------------------------

test('FOCUSABLE is an exported selector string', () => {
  assert.equal(typeof FOCUSABLE, 'string');
  assert.ok(FOCUSABLE.includes('button'));
});

// Build a kind-controller with a fake dialog + .mbody and return the pieces.
const focusSetup = (kind, opts = {}, map = {}, bodyEls = []) => {
  const body = fakeDialog({ [FOCUSABLE]: bodyEls });
  const dialog = fakeDialog({ '.mbody': [body], ...map });
  const { host, ctl } = make({ kind, ...opts }, { dialog });
  return { host, ctl, dialog, body };
};
const open = async (ctl) => { ctl.opened(fakeTrigger()); await settle(); };

test('focus 1: an enabled [autofocus] wins over the primary; the first enabled one is used', async () => {
  const dis = fakeEl({ disabled: true }), af = fakeEl(), primary = fakeEl();
  const { ctl } = focusSetup('input', {}, { '[autofocus]': [dis, af], '[data-primary]': [primary] });
  await open(ctl);
  assert.equal(dis.n, 0);
  assert.equal(af.n, 1);
  assert.equal(primary.n, 0);
});

test('focus 2: input/confirm focus the enabled primary before initialFocus', async () => {
  for (const kind of ['input', 'confirm']) {
    const primary = fakeEl(), other = fakeEl();
    const { ctl } = focusSetup(kind, { initialFocus: '.other' }, { '[data-primary]': [primary], '.other': [other] });
    await open(ctl);
    assert.equal(primary.n, 1, kind);
    assert.equal(other.n, 0, kind);
  }
});

test('focus 2: a disabled primary is skipped, falling to initialFocus', async () => {
  const primary = fakeEl({ disabled: true }), other = fakeEl();
  const { ctl } = focusSetup('input', { initialFocus: '.other' }, { '[data-primary]': [primary], '.other': [other] });
  await open(ctl);
  assert.equal(primary.n, 0);
  assert.equal(other.n, 1);
});

test('focus 3: initialFocus as a string array is tried in order, first enabled match wins', async () => {
  const a = fakeEl({ disabled: true }), b = fakeEl(), c = fakeEl();
  const { ctl } = focusSetup('picker', { initialFocus: ['.a', '.missing', '.b', '.c'] }, { '.a': [a], '.b': [b], '.c': [c] });
  await open(ctl);
  assert.equal(a.n, 0);
  assert.equal(b.n, 1);
  assert.equal(c.n, 0);
});

test('focus 3: initialFocus may be a function returning a string or an array', async () => {
  const x = fakeEl(), y = fakeEl();
  const s = focusSetup('picker', { initialFocus: () => '.x' }, { '.x': [x] });
  await open(s.ctl);
  assert.equal(x.n, 1);
  const a = focusSetup('picker', { initialFocus: () => ['.nope', '.y'] }, { '.y': [y] });
  await open(a.ctl);
  assert.equal(y.n, 1);
});

test('focus 3: a function initialFocus returning null falls through', async () => {
  const f = fakeEl();
  const { ctl } = focusSetup('picker', { initialFocus: () => null }, {}, [f]);
  await open(ctl);
  assert.equal(f.n, 1);
});

test('focus 3 beats the body fallback for picker kind', async () => {
  const init = fakeEl(), bodyFirst = fakeEl();
  const { ctl } = focusSetup('picker', { initialFocus: '.init' }, { '.init': [init] }, [bodyFirst]);
  await open(ctl);
  assert.equal(init.n, 1);
  assert.equal(bodyFirst.n, 0);
});

test('focus 4: info focuses the enabled primary (the ack button)', async () => {
  const ack = fakeEl(), bodyFirst = fakeEl();
  const { ctl } = focusSetup('info', {}, { '[data-primary]': [ack] }, [bodyFirst]);
  await open(ctl);
  assert.equal(ack.n, 1);
  assert.equal(bodyFirst.n, 0);
});

test('focus 4: info without a primary focuses the dialog itself', async () => {
  const bodyFirst = fakeEl();
  const { ctl, dialog } = focusSetup('info', {}, {}, [bodyFirst]);
  await open(ctl);
  assert.equal(dialog.n, 1);
  assert.equal(bodyFirst.n, 0);
});

test('focus 5: picker (and input/confirm without a primary) focus the first enabled FOCUSABLE in .mbody', async () => {
  for (const kind of ['picker', 'input', 'confirm']) {
    const dis = fakeEl({ disabled: true }), first = fakeEl(), second = fakeEl();
    const { ctl } = focusSetup(kind, {}, {}, [dis, first, second]);
    await open(ctl);
    assert.equal(dis.n, 0, kind);
    assert.equal(first.n, 1, kind);
    assert.equal(second.n, 0, kind);
    __resetModalKit();
  }
});

test('focus 5: a picker never focuses a primary (step 2 is input/confirm only)', async () => {
  const primary = fakeEl(), first = fakeEl();
  const { ctl } = focusSetup('picker', {}, { '[data-primary]': [primary] }, [first]);
  await open(ctl);
  assert.equal(primary.n, 0);
  assert.equal(first.n, 1);
});

test('focus 6: with nothing else, the dialog is focused and given tabindex=-1', async () => {
  const { ctl, dialog } = focusSetup('picker');
  await open(ctl);
  assert.equal(dialog.n, 1);
  assert.equal(dialog.attrs?.tabindex, '-1');
});

test('focus 6: an existing tabindex on the dialog is left alone', async () => {
  const { ctl, dialog } = focusSetup('picker');
  dialog.attrs = { tabindex: '0' };
  await open(ctl);
  assert.equal(dialog.n, 1);
  assert.equal(dialog.attrs.tabindex, '0');
});

test('focus: nothing is focused before the host finishes updating', () => {
  const af = fakeEl();
  const { ctl } = focusSetup('picker', {}, { '[autofocus]': [af] });
  ctl.opened(fakeTrigger());
  assert.equal(af.n, 0);
});

test('legacy focus order: [autofocus], then initialFocus, then first FOCUSABLE (header allowed), then dialog', async () => {
  const mk = (map) => {
    const dialog = fakeDialog(map);
    const { ctl } = make({ initialFocus: '.init' }, { dialog });
    return { ctl, dialog };
  };
  let af = fakeEl(), init = fakeEl(), first = fakeEl();
  let s = mk({ '[autofocus]': [af], '.init': [init], [FOCUSABLE]: [first] });
  await open(s.ctl);
  assert.deepEqual([af.n, init.n, first.n], [1, 0, 0]);
  __resetModalKit();

  af = fakeEl(); init = fakeEl(); first = fakeEl();
  s = mk({ '.init': [init], [FOCUSABLE]: [first] });
  await open(s.ctl);
  assert.deepEqual([init.n, first.n], [1, 0]);
  __resetModalKit();

  first = fakeEl();
  s = mk({ [FOCUSABLE]: [first] });
  await open(s.ctl);
  assert.equal(first.n, 1);
  __resetModalKit();

  s = mk({});
  await open(s.ctl);
  assert.equal(s.dialog.n, 1);
  assert.equal(s.dialog.attrs?.tabindex, '-1');
});

test('legacy order does not apply the primary rule (a [data-primary] is not preferred)', async () => {
  const primary = fakeEl(), first = fakeEl();
  const dialog = fakeDialog({ '[data-primary]': [primary], [FOCUSABLE]: [first] });
  const { ctl } = make({}, { dialog });
  await open(ctl);
  assert.equal(primary.n, 0);
  assert.equal(first.n, 1);
});

test('refocus() re-runs the initial-focus order while open (F5)', async () => {
  const first = fakeEl(), later = fakeEl();
  const { ctl, dialog } = focusSetup('input', {}, { '[autofocus]': [first] });
  await open(ctl);
  assert.equal(first.n, 1);
  dialog.map['[autofocus]'] = [later];
  ctl.refocus();
  await settle();
  assert.equal(later.n, 1);
  assert.equal(first.n, 1);
});

test('refocus() does nothing when the modal is closed', async () => {
  const af = fakeEl();
  const { ctl } = focusSetup('input', {}, { '[autofocus]': [af] });
  ctl.refocus();
  await settle();
  assert.equal(af.n, 0);
});

test('focus is not applied if the modal closed before the host finished updating', async () => {
  const af = fakeEl();
  const { ctl } = focusSetup('input', {}, { '[autofocus]': [af] });
  ctl.opened(fakeTrigger());
  ctl.close();
  await settle();
  assert.equal(af.n, 0);
});
