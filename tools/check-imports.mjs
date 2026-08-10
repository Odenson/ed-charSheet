#!/usr/bin/env node
// tools/check-imports.mjs — dependency-free static import validator.
//
// Catches the browser-runtime failures that `node --check` and `node --test`
// both miss, because they only surface when a module is evaluated in the page:
//
//   1. USING a known store/engine export without importing it — the
//      `saveNotesEdits is not defined` ReferenceError class (a missing import).
//   2. Importing a name a module does not actually export (typo, or an export
//      that was renamed/removed out from under the importer).
//   3. Importing from a relative path that does not exist.
//
// It parses ES-module syntax with small regex passes (no AST library), which is
// enough for this codebase's plain `export function/const/class` + `import { … }`
// style. The analyzer core (`analyzeModules`) is pure and filesystem-free so it
// can be unit-tested on in-memory fixtures; the CLI just feeds it real files.
//
// Run:  npm run lint:imports   (also runs automatically as a `pretest` hook)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --- source text passes -----------------------------------------------------

// Blank out // and /* */ comments (keep string/template contents, and preserve
// newlines so line numbers stay accurate). Used before parsing imports/exports,
// so a commented-out `import` is ignored.
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

// Blank comments AND string/template literals (preserving newlines). Used for
// identifier-usage and local-declaration scanning, so names mentioned only in a
// comment or string never count as "used" or "declared".
function stripCodeToIdentifiers(src) {
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
      const q = c; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') i++; if (src[i] === '\n') out += '\n'; i++; }
      i++; continue;
    }
    out += c; i++;
  }
  return out;
}

// Replace every import statement with same-length blanks (newlines preserved),
// so an aliased specifier like `import { saveHealthEdits as x }` can't be
// mistaken for a bare use of `saveHealthEdits`.
function blank(match) { return match.replace(/[^\n]/g, ' '); }
function removeImportStatements(code) {
  return code
    .replace(/\bimport\b[^'";]*?\bfrom\s*['"][^'"]+['"]\s*;?/gs, blank)
    .replace(/\bimport\s*['"][^'"]+['"]\s*;?/g, blank);
}

// --- parsing ----------------------------------------------------------------

function lineOf(src, index) { return src.slice(0, index).split('\n').length; }

// Public export names of a module + whether it has an un-enumerable `export *`.
function parseExports(noComments) {
  const names = new Set();
  let hasStar = false;
  let m;
  const add = (n) => n && names.add(n);

  for (const re of [
    /\bexport\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g,
    /\bexport\s+class\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  ]) { while ((m = re.exec(noComments))) add(m[1]); }

  // export { a, b as c }  and  export { a as b } from './x'
  const listRe = /\bexport\s*\{([^}]*)\}/g;
  while ((m = listRe.exec(noComments))) {
    for (const raw of m[1].split(',')) {
      const part = raw.trim();
      if (!part) continue;
      const asMatch = part.match(/\bas\s+([A-Za-z_$][\w$]*)/);
      add(asMatch ? asMatch[1] : part.split(/\s+/)[0]);
    }
  }
  if (/\bexport\s+default\b/.test(noComments)) add('default');
  if (/\bexport\s*\*\s*(?:as\s+[A-Za-z_$][\w$]*\s+)?from\b/.test(noComments)) hasStar = true;
  return { names, hasStar };
}

// All relative import statements: their specifier, the original exported names
// requested, and the set of local bindings they introduce.
function parseImports(noComments) {
  const imports = [];
  const bindings = new Set();

  // import <default>?, * as <ns>?, { named }? from 'spec'
  const re = /\bimport\s+([^;'"]*?)\bfrom\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(noComments))) {
    const clause = m[1].trim();
    const spec = m[2];
    const line = lineOf(noComments, m.index);
    const names = []; // {orig, local}

    const nsMatch = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (nsMatch) bindings.add(nsMatch[1]);

    const braceMatch = clause.match(/\{([^}]*)\}/);
    if (braceMatch) {
      for (const raw of braceMatch[1].split(',')) {
        const part = raw.trim();
        if (!part) continue;
        const asMatch = part.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
        const orig = asMatch ? asMatch[1] : part;
        const local = asMatch ? asMatch[2] : part;
        names.push({ orig, local });
        bindings.add(local);
      }
    }

    // default binding: leading bareword before any brace/star
    const head = clause.replace(/\{[^}]*\}/, '').replace(/\*\s+as\s+[A-Za-z_$][\w$]*/, '');
    const defMatch = head.match(/^\s*([A-Za-z_$][\w$]*)\s*,?/);
    if (defMatch && !nsMatch) bindings.add(defMatch[1]);

    imports.push({ spec, names, line, namespace: !!nsMatch });
  }

  // side-effect imports (no bindings) — still resolve the path
  const sideRe = /\bimport\s*['"]([^'"]+)['"]/g;
  while ((m = sideRe.exec(noComments))) {
    imports.push({ spec: m[1], names: [], line: lineOf(noComments, m.index), namespace: false });
  }
  return { imports, bindings };
}

// Local declarations anywhere in the module (functions, classes, bindings, and
// simple destructuring). Enough to know a name is defined locally, not missing.
function parseLocalDecls(code) {
  const names = new Set();
  let m;
  const declRe = /(?:^|[^.\w$])(?:function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = declRe.exec(code))) names.add(m[1]);
  const destrRe = /(?:const|let|var)\s*(?:\{([^}]*)\}|\[([^\]]*)\])/g;
  while ((m = destrRe.exec(code))) addList(names, m[1] || m[2] || '');
  return names;
}

const CONTROL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'do', 'else', 'typeof',
  'new', 'in', 'of', 'await', 'yield', 'with', 'function',
]);

// Parameter names are locally bound too — a param that shadows a provider export
// (e.g. `function woundsFromHit(take, woundThreshold)`) must not read as a
// missing import. Collect params from function/arrow/method signatures.
function parseParams(code) {
  const names = new Set();
  let m;
  // function name?(params)  and  arrow (params) =>
  const fnRe = /\bfunction\s*\*?\s*(?:[A-Za-z_$][\w$]*)?\s*\(([^()]*)\)/g;
  while ((m = fnRe.exec(code))) addList(names, m[1]);
  const arrowRe = /\(([^()]*)\)\s*=>/g;
  while ((m = arrowRe.exec(code))) addList(names, m[1]);
  // single-identifier arrow: x => …
  const soloRe = /(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*=>/g;
  while ((m = soloRe.exec(code))) names.add(m[1]);
  // method shorthand: name(params) {  — skip control-flow `if (…) {` etc.
  const methRe = /(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*\{/g;
  while ((m = methRe.exec(code))) { if (!CONTROL_KEYWORDS.has(m[1])) addList(names, m[2]); }
  return names;
}

// Add comma-separated binding names (params or destructuring) to a set, ignoring
// defaults, rest/spread, and nested braces/brackets.
function addList(names, raw) {
  for (const part of raw.split(',')) {
    const id = part.trim().replace(/^\.\.\./, '').split(/[=:]/)[0].replace(/[{}[\]\s.]/g, '').trim();
    if (/^[A-Za-z_$][\w$]*$/.test(id)) names.add(id);
  }
}

// --- resolution -------------------------------------------------------------

// Normalize a POSIX-style relative import to a repo-relative module key.
function resolveRel(fromRel, spec) {
  const baseParts = fromRel.split('/').slice(0, -1);
  const specParts = spec.split('/');
  for (const p of specParts) {
    if (p === '.' || p === '') continue;
    if (p === '..') baseParts.pop();
    else baseParts.push(p);
  }
  return baseParts.join('/');
}

const isRelative = (spec) => spec.startsWith('./') || spec.startsWith('../');
const isProvider = (rel) => /^engine\//.test(rel) || /^store(-[\w-]+)?\.js$/.test(rel);

// --- analyzer (pure) --------------------------------------------------------

// modules: [{ rel, src }]  →  { errors: [{ file, line, kind, msg }] }
export function analyzeModules(modules) {
  const errors = [];
  const byRel = new Map();

  // Pass 1: parse every module.
  for (const { rel, src } of modules) {
    const noComments = stripComments(src);
    // Remove import statements while their string specifiers are still intact
    // (the removal regex needs the quotes), then blank remaining strings so an
    // aliased specifier can't be mistaken for a use.
    const code = stripCodeToIdentifiers(removeImportStatements(noComments));
    const { names: exportNames, hasStar } = parseExports(noComments);
    const { imports, bindings } = parseImports(noComments);
    const locals = new Set([...parseLocalDecls(code), ...parseParams(code)]);
    byRel.set(rel, { rel, src, noComments, code, exportNames, hasStar, imports, bindings, locals });
  }

  // Provider export → the modules that export it (store*/engine utility layer).
  const providerOf = new Map();
  for (const mod of byRel.values()) {
    if (!isProvider(mod.rel)) continue;
    for (const name of mod.exportNames) {
      if (!providerOf.has(name)) providerOf.set(name, []);
      providerOf.get(name).push(mod.rel);
    }
  }

  for (const mod of byRel.values()) {
    // (2)/(3): validate every relative import against the target module.
    for (const imp of mod.imports) {
      if (!isRelative(imp.spec)) continue; // bare specifier (e.g. 'lit') — skip
      const targetRel = resolveRel(mod.rel, imp.spec);
      const target = byRel.get(targetRel);
      if (!target) {
        errors.push({ file: mod.rel, line: imp.line, kind: 'missing-file',
          msg: `import from '${imp.spec}' → '${targetRel}' does not exist` });
        continue;
      }
      if (target.hasStar) continue; // can't enumerate re-exported names
      for (const { orig } of imp.names) {
        if (orig === 'default') continue;
        if (!target.exportNames.has(orig)) {
          errors.push({ file: mod.rel, line: imp.line, kind: 'bad-import',
            msg: `'${orig}' is not exported by '${imp.spec}' (${targetRel})` });
        }
      }
    }

    // (1): a known provider export used without importing or declaring it.
    for (const [name, origins] of providerOf) {
      if (mod.bindings.has(name) || mod.locals.has(name)) continue;
      // bare identifier use — not a member access (`store.foo`) or object key (`foo:`)
      const useRe = new RegExp(`(?<![.\\w$])${name}(?![\\w$])(?!\\s*:)`);
      const hit = useRe.exec(mod.code);
      if (hit) {
        errors.push({ file: mod.rel, line: lineOf(mod.code, hit.index), kind: 'missing-import',
          msg: `uses '${name}' but never imports it (exported by ${origins.join(', ')})` });
      }
    }
  }

  errors.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { errors };
}

// --- CLI --------------------------------------------------------------------

function listSourceFiles() {
  const out = [];
  const walk = (absDir) => {
    for (const entry of readdirSync(absDir)) {
      const abs = resolve(absDir, entry);
      const rel = relative(ROOT, abs).split(sep).join('/');
      if (statSync(abs).isDirectory()) {
        if (rel === 'engine' || rel === 'ui') walk(abs);
        continue;
      }
      if (!rel.endsWith('.js') || rel.endsWith('.test.js')) continue;
      if (rel.includes('/') && !rel.startsWith('engine/') && !rel.startsWith('ui/')) continue;
      out.push(rel);
    }
  };
  walk(ROOT);
  return out;
}

function runCli() {
  const rels = listSourceFiles();
  const modules = rels.map((rel) => ({ rel, src: readFileSync(resolve(ROOT, rel), 'utf8') }));
  const { errors } = analyzeModules(modules);

  if (errors.length === 0) {
    console.log(`✓ import check: ${modules.length} modules, no problems`);
    return 0;
  }
  console.error(`✗ import check: ${errors.length} problem(s) found\n`);
  let current = '';
  for (const e of errors) {
    if (e.file !== current) { current = e.file; console.error(`  ${current}`); }
    console.error(`    ${e.file}:${e.line}  [${e.kind}] ${e.msg}`);
  }
  console.error('');
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runCli());
}
