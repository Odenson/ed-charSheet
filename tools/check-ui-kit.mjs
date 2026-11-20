#!/usr/bin/env node
// tools/check-ui-kit.mjs — dependency-free enforcement of the UI kit rule: modals
// and modal-like UI use ui/kit/ (docs/MODALS.md), not hand-rolled copies.
//
// Five rules are counted per `ui/**/*.js` file (comments stripped first):
//   keydown      document/window keydown|keyup listeners (the kit owns the one listener)
//   dialog-role  a literal role="dialog"/"alertdialog" attribute (the frame stamps it)
//   frame-css    CSS preludes naming .overlay/.modal/.mhead/.mclose or button.btn
//   font-size    a font-size that is not a var(--fs-*) token, or a --fs-* redefinition
//   button-style an inline style= on a <button>
// Files under ui/kit/ are exempt from every rule except font-size.
//
// The counts are compared with tools/ui-kit-baseline.json as a two-way ratchet:
// a count above the baseline is a new violation; a count below it must lower the
// baseline in the same change. The analyzer is pure (in-memory modules) so it is
// unit-tested; the CLI just feeds it real files.
//
// Run:  npm run lint:ui-kit   (also runs automatically as a `pretest` hook)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const RULES = ['keydown', 'dialog-role', 'frame-css', 'font-size', 'button-style'];

// --- source passes ------------------------------------------------------------

// Blank // and /* */ comments, keeping string/template contents and newlines.
function stripComments(src) {
  let out = '';
  for (let i = 0, n = src.length; i < n; ) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; }
      i += 2; continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c; out += c; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') { out += src[i]; i++; } out += src[i] ?? ''; i++; }
      out += src[i] ?? ''; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

const blankHtmlComments = (s) => s.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));

// Skip a quoted string starting at src[i] (the quote); returns the index after it.
function skipString(src, i) {
  const q = src[i];
  i++;
  while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
  return i + 1;
}

// Read a template literal body; `i` is just after the opening backtick. Each
// ${…} is blanked to a space. Returns { body, end } with end after the closing backtick.
function readTemplate(src, i) {
  let body = '';
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { body += c + (src[i + 1] ?? ''); i += 2; continue; }
    if (c === '`') return { body, end: i + 1 };
    if (c === '$' && src[i + 1] === '{') { i = skipInterp(src, i + 2); body += ' '; continue; }
    body += c; i++;
  }
  return { body, end: i };
}

// Skip a ${…} interpolation; `i` is just after the `{`. Returns the index after the `}`.
function skipInterp(src, i) {
  let depth = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"') { i = skipString(src, i); continue; }
    if (c === '`') { i = readTemplate(src, i + 1).end; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i + 1; }
    i++;
  }
  return i;
}

// Every css`…` template body plus every <style>…</style> body, comments removed.
function cssBodies(src) {
  const out = [];
  const re = /\bcss`/g;
  let m;
  while ((m = re.exec(src))) {
    const { body, end } = readTemplate(src, m.index + m[0].length);
    out.push(body);
    re.lastIndex = end;
  }
  const sre = /<style[^>]*>([\s\S]*?)<\/style>/g;
  while ((m = sre.exec(src))) out.push(m[1]);
  return out.map((b) => b.replace(/\/\*[\s\S]*?\*\//g, ' '));
}

const FRAME_RE = /(?:^|[^\w-])\.(?:overlay|modal|mhead|mclose)(?![\w-])|(?:^|[^\w-])button\.btn(?![\w-])/;

function countFrameCss(src) {
  let n = 0;
  for (const css of cssBodies(src)) {
    let buf = '';
    for (const c of css) {
      if (c === '{') {
        const prelude = buf.trim();
        if (!prelude.startsWith('@') && FRAME_RE.test(prelude)) n++;
        buf = '';
      } else if (c === '}' || c === ';') buf = '';
      else buf += c;
    }
  }
  return n;
}

function countButtonStyle(src) {
  let n = 0;
  const re = /<button\b/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let tag = '';
    while (i < src.length && src[i] !== '>') {
      if (src[i] === '$' && src[i + 1] === '{') { i = skipInterp(src, i + 2); tag += ' '; continue; }
      tag += src[i]; i++;
    }
    if (/(?:^|\s)style\s*=/.test(tag)) n++;
  }
  return n;
}

const count = (re, s) => (s.match(re) ?? []).length;

/** Count the rule violations in one source file. */
export function countViolations(rel, src) {
  const s = blankHtmlComments(stripComments(src));
  const fontSize = count(/font-size\s*:(?!\s*var\(--fs-)/g, s) + count(/(?<![\w-])--fs-[\w-]+\s*:/g, s);
  if (rel.startsWith('ui/kit/')) {
    return { keydown: 0, 'dialog-role': 0, 'frame-css': 0, 'font-size': fontSize, 'button-style': 0 };
  }
  return {
    keydown: count(/\b(?:document|window)\s*\.\s*addEventListener\s*\(\s*(['"`])(?:keydown|keyup)\1/g, s),
    'dialog-role': count(/(?<!\[\s*)\brole\s*=\s*(['"])(?:alert)?dialog\1/g, s),
    'frame-css': countFrameCss(s),
    'font-size': fontSize,
    'button-style': countButtonStyle(s),
  };
}

// --- analyzer (pure) ----------------------------------------------------------

/**
 * modules: [{ rel, src }], baseline: the JSON object  →  { counts, errors }.
 * `counts` holds non-zero counts only; `errors` is sorted by file, then RULES order.
 */
export function analyzeUiKit(modules, baseline) {
  const counts = {};
  const errors = [];
  const rels = new Set(modules.map((m) => m.rel));
  const push = (file, rule, kind, count, allowed, msg) => errors.push({ file, rule, kind, count, allowed, msg });
  const badMsg = (file, rule) => `${file}: bad baseline value for ${rule} (rules: ${RULES.join(', ')}; positive integers only)`;

  // Validate the baseline's own shape.
  const goodRules = {};
  for (const [file, entry] of Object.entries(baseline ?? {})) {
    const keys = entry && typeof entry === 'object' ? Object.keys(entry) : [];
    if (!keys.length) { push(file, null, 'bad-entry', 0, 0, badMsg(file, '(empty entry)')); continue; }
    goodRules[file] = new Set();
    for (const rule of keys) {
      const v = entry[rule];
      if (!RULES.includes(rule) || !Number.isInteger(v) || v <= 0) push(file, rule, 'bad-entry', 0, 0, badMsg(file, rule));
      else goodRules[file].add(rule);
    }
    if (!rels.has(file)) push(file, null, 'stale-entry', 0, 0, `remove stale entry for ${file}`);
  }

  for (const { rel, src } of modules) {
    const c = countViolations(rel, src);
    const nz = {};
    for (const r of RULES) if (c[r] > 0) nz[r] = c[r];
    if (Object.keys(nz).length) counts[rel] = nz;
    const entry = baseline?.[rel];
    for (const rule of RULES) {
      const n = c[rule];
      if (entry && !goodRules[rel]?.has(rule) && entry[rule] !== undefined) continue; // flagged as bad-entry
      const allowed = entry?.[rule] ?? 0;
      if (n > allowed) {
        push(rel, rule, entry ? 'new-violation' : 'no-entry', n, allowed,
          entry
            ? `${rel}: ${rule} has ${n}, baseline allows ${allowed} (new violation — use ui/kit/)`
            : `${rel}: ${rule} has ${n} but the file has no baseline entry (new violation — use ui/kit/)`);
      } else if (n < allowed) {
        push(rel, rule, 'ratchet', n, allowed,
          `${rel}: ${rule} has ${n}, baseline allows ${allowed} — lower the baseline to ${n}${n === 0 ? ' (delete the rule)' : ''}`);
      }
    }
  }

  const order = (r) => (r == null ? -1 : RULES.indexOf(r));
  errors.sort((a, b) => a.file.localeCompare(b.file) || order(a.rule) - order(b.rule));
  return { counts, errors };
}

// --- CLI ----------------------------------------------------------------------

/** Every ui/**\/*.js (not *.test.js) as repo-relative POSIX paths. */
export function listUiSources(root = ROOT) {
  const out = [];
  const walk = (absDir) => {
    for (const entry of readdirSync(absDir)) {
      const abs = resolve(absDir, entry);
      if (statSync(abs).isDirectory()) { walk(abs); continue; }
      const rel = relative(root, abs).split(sep).join('/');
      if (rel.endsWith('.js') && !rel.endsWith('.test.js')) out.push(rel);
    }
  };
  walk(resolve(root, 'ui'));
  return out.sort();
}

function runCli() {
  const baseline = JSON.parse(readFileSync(resolve(ROOT, 'tools/ui-kit-baseline.json'), 'utf8'));
  const modules = listUiSources(ROOT).map((rel) => ({ rel, src: readFileSync(resolve(ROOT, rel), 'utf8') }));
  const { errors } = analyzeUiKit(modules, baseline);
  if (!errors.length) {
    console.log(`✓ ui-kit check: ${modules.length} files, baseline holds`);
    return 0;
  }
  console.error(`✗ ui-kit check: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  ${e.msg}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(runCli());
