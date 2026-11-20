// ui/kit/modal-stack.js — the pure core of the modal keyboard contract
// (docs/MODALS.md). Three parts, all plain data in / plain data out:
//   - a modal stack (only the top entry is ever acted on);
//   - `routeKey(facts)`, the ordered Enter/Escape router (R1–R15);
//   - `footerHint()`, the frame's footer hint text (V4).
//
// This module is deliberately free of Lit and of every DOM global, so node can
// load and test it (ui/kit/modal-stack.test.js). The DOM wrapper that turns a
// keydown event into `facts` lives in ui/kit/modal-controller.js.

/** The four modal kinds the router understands (anything else reads as `null`). */
export const KINDS = Object.freeze(['input', 'confirm', 'info', 'picker']);
const KIND_SET = new Set(KINDS);

// `<input type=…>` values that behave like a button (Enter clicks them natively).
const BUTTON_INPUT_TYPES = new Set(['button', 'submit', 'reset', 'image']);

/**
 * A modal stack, bottom to top. `push` of an entry already present moves it to
 * the top (idempotent); `remove` of an absent entry is a no-op.
 */
export function createModalStack() {
  let items = [];
  return {
    push(entry) {
      items = items.filter((x) => x !== entry);
      items.push(entry);
    },
    remove(entry) {
      items = items.filter((x) => x !== entry);
    },
    top() {
      return items.length ? items[items.length - 1] : null;
    },
    size() {
      return items.length;
    },
    entries() {
      return items.slice();
    },
    has(entry) {
      return items.includes(entry);
    },
    clear() {
      items = [];
    },
  };
}

const lower = (v) => (typeof v === 'string' ? v.toLowerCase() : '');

/**
 * Route one Enter/Escape keydown. Returns:
 *   'close'   — close the top modal (the caller swallows the key);
 *   'confirm' — run the top modal's primary action (swallowed);
 *   'block'   — swallow the key and do nothing;
 *   'pass'    — leave the key alone (native behaviour / other handlers).
 *
 * Ordered rules, first match wins (spec R1–R15). Missing booleans read as
 * false; a missing or unknown `kind` reads as null (a legacy controller).
 * @param {object} facts  See spec "facts fields".
 * @returns {'close'|'confirm'|'block'|'pass'}
 */
export function routeKey(facts) {
  const f = facts ?? {};
  const key = f.key;
  // R1 — only Enter and Escape are routed.
  if (key !== 'Enter' && key !== 'Escape') return 'pass';
  const isEscape = key === 'Escape';
  const ctrl = !!f.ctrlKey;
  const meta = !!f.metaKey;
  const shift = !!f.shiftKey;
  const alt = !!f.altKey;
  const tag = lower(f.targetTag);
  const type = lower(f.targetType);
  const role = lower(f.targetRole);
  const inTop = !!f.targetInTop;

  // R2 — IME composition owns the key.
  if (f.isComposing) return 'pass';
  // R3 — a key held through a kit close/confirm keeps being swallowed.
  if (f.latched) return 'block';
  // R4 — no kit modal open.
  if (f.stackEmpty) return 'pass';
  // R5 — a legacy dialog on top handles its own keys (§8).
  if (f.targetInForeignDialog) return 'pass';
  // R6 — a held key acts once. Carve-out (D2): a plain held Enter in a textarea
  // inside the top modal keeps typing newlines.
  if (f.repeat) {
    const textareaNewline = !isEscape && !ctrl && !meta && tag === 'textarea' && inTop;
    if (!textareaNewline) return 'block';
  }
  // R7 — another handler already owns the key.
  if (f.defaultPrevented) return 'pass';

  const kind = KIND_SET.has(f.kind) ? f.kind : null;
  const canConfirm = !!f.canConfirm;

  // R8 — legacy controller (no kind): Escape closes, Enter is not routed (F11).
  if (kind == null) return isEscape ? 'close' : 'pass';

  // R9 — stray focus behind the backdrop or on <body>: never pass.
  if (!inTop) {
    if (isEscape) return 'close';
    if (ctrl || meta || shift || alt) return 'block';
    if (kind === 'info') return 'close';
    if (kind === 'picker') return 'block';
    return canConfirm ? 'confirm' : 'block';
  }

  // R10 — Escape closes the top modal.
  if (isEscape) return 'close';
  // R11 — Shift/Alt+Enter are left to the target.
  if (shift || alt) return 'pass';
  // R12 — Ctrl/⌘+Enter in a textarea saves (D2).
  if ((ctrl || meta) && tag === 'textarea') return canConfirm ? 'confirm' : 'pass';

  // R13 — controls that do their own job on Enter. Checkboxes and radios are
  // fields (F6), so they fall through to R15 unless marked data-enter="local".
  const buttonLike =
    tag === 'button' || role === 'button' || (tag === 'input' && BUTTON_INPUT_TYPES.has(type));
  if (
    tag === 'textarea' ||
    tag === 'select' ||
    tag === 'a' ||
    (buttonLike && !f.targetIsPrimary) ||
    f.targetEnterLocal
  ) {
    return 'pass';
  }

  // R14 — Enter on the primary (or the info `ack` button).
  if (f.targetIsPrimary) return kind === 'info' || canConfirm ? 'confirm' : 'block';

  // R15 — Enter by kind.
  if (kind === 'info') return 'close'; // D1: read-only Enter closes
  if (kind === 'picker') return 'pass';
  return canConfirm ? 'confirm' : 'pass';
}

/**
 * The frame's muted footer hint for input/confirm modals (V4).
 * @param {{ hasTextarea?: boolean }} [opts]
 */
export function footerHint({ hasTextarea = false } = {}) {
  return hasTextarea ? 'Ctrl+Enter saves · Esc = Cancel' : 'Enter = OK · Esc = Cancel';
}
