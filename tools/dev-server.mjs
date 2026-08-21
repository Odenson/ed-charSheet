// tools/dev-server.mjs — the file-backed local dev server (README → Running
// locally; docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md). Serves the repo root
// statically AND implements the worker's two save routes on the same origin, so
// the full save → read-after-write loop runs offline:
//
//   POST /save        { character, id } → write data/characters/<id>.json (ed-character/1)
//   POST /save-items  { items, delete } → merge  data/custom-items.json (ed-items/3)
//
// No Cloudflare, no GitHub, no secrets: writes land in the gitignored local
// working copies that store.js already reads off-Pages, and any/missing
// `x-save-key` is accepted. Validation and response shapes mirror
// tools/worker/worker.js so the app's SaveError mapping runs unchanged (the key
// prompt still appears locally — type anything). `/save` mirrors the worker's
// create-only index maintenance: a brand-new character file also gets an entry
// in `data/characters/index.json` (name + portrait). Local saves take the
// legacy overwrite path — local reads carry no ETag, so the app never sends a
// `base` here; a malformed base is still rejected 400 for mirror-shape.
// CORS is permissive `*` because this is a local-only server that writes only
// local files.
//
// Options (CLI):  --port <n>  or  PORT=<n>   listen port (default 8000)
//                 --lag <ms>                 simulate the Pages read-after-write
//                                            lag: after a write, the next read
//                                            of that file within <ms> returns
//                                            the PREVIOUS content (one lagged
//                                            read), so the isItemsReflected
//                                            reconcile logic can be verified
//                                            against a stale read
//                                            (plans/PLAN-CUSTOM-ITEMS.md §6.6).
//
// `npm test` boots it on an ephemeral port with a temp docroot
// (tools/dev-server.test.js); exports keep the routes testable without a fork.

import { createServer } from 'node:http';
import { readFile, writeFile, realpath, mkdir } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateItem, validateItemsFile } from '../engine/validate-item.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEP = process.platform === 'win32' ? '\\' : '/';
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const CORS = {
  'Access-Control-Allow-Origin': '*', // local-only server; writes only local files
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-save-key',
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

const MAX_BYTES = 512 * 1024;          // mirrors worker.js isValidCharacter
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/; // mirrors worker.js isValidId
const CHARACTERS_DIR = 'data/characters';
const ITEMS_STORE = 'data/custom-items.json';
const FRESH_CATALOG = {
  schema: 'ed-items/3',
  effectTaxonomy: 'docs/EFFECT-TAXONOMY.md (v3)',
  source: 'custom',
  notes: 'Player-created items, folded into rules/custom-items.json on dev by CI.',
  items: {},
};

function writeJson(res, status, body) {
  res.writeHead(status, { ...JSON_HEADERS, ...CORS });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolveJson, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolveJson(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

async function readRaw(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null; // missing or unreadable — callers fall back
  }
}

async function readJsonFile(path) {
  const raw = await readRaw(path);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null; // a corrupt working copy reads as absent, never blocks
  }
}

async function writePretty(path, obj) {
  await mkdir(dirname(path), { recursive: true }); // a fresh docroot may lack data/
  await writeFile(path, JSON.stringify(obj, null, 2) + '\n');
}

function isValidCharacter(c) {
  // ed-character/2: talent `tier` stripped (derived from the learned Circle,
  // PLAN-TALENT-TIER-DERIVATION). /1 files keep saving until each is rewritten.
  return (
    !!c &&
    typeof c === 'object' &&
    (c.schema === 'ed-character/1' || c.schema === 'ed-character/2') &&
    JSON.stringify(c).length <= MAX_BYTES
  );
}

function isValidId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

// Mirror worker.js checkItemsDelta: `{ items, delete? }`; the first error
// becomes the 400 message.
function checkItemsDelta(body) {
  const errors = [];
  const items = body?.items;
  const dels = body?.delete;
  if (items === undefined && dels === undefined) errors.push('must provide items and/or delete');
  if (items !== undefined && (typeof items !== 'object' || items === null || Array.isArray(items))) {
    errors.push('items: must be an object of name → item');
  } else {
    for (const [name, item] of Object.entries(items ?? {})) {
      for (const e of validateItem(name, item).errors) errors.push(`items["${name}"]: ${e}`);
    }
  }
  if (dels !== undefined && (!Array.isArray(dels) || dels.some((d) => typeof d !== 'string' || d === '')))
    errors.push('delete: must be an array of non-empty names');
  return { ok: errors.length === 0, errors };
}

// Reject path traversal and NULs before they reach the filesystem. Returns the
// root-relative path (no leading slash, `index.html` for the root) or null.
function safeRel(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const segments = decoded.split('/').filter((s) => s !== '' && s !== '.');
  if (segments.some((s) => s === '..' || s.includes('..'))) return null;
  return segments.join('/') || 'index.html';
}

/**
 * Create the local dev server. `root` is the docroot (default: repo root),
 * `lag` enables the one-shot stale-read simulation in ms. Returns a Node
 * `http.Server` — call `listen()` on it. Importable by the test suite.
 */
export function createDevServer({ root = ROOT, lag = 0 } = {}) {
  const resolvedRoot = resolve(root);
  // Serialize file writes so concurrent saves can't interleave read-modify-write
  // (the worker's bounded 409 retry solves this against GitHub; here it's one queue).
  let writeChain = Promise.resolve();
  const enqueue = (fn) => {
    const p = writeChain.then(fn);
    writeChain = p.catch(() => {});
    return p;
  };
  // Per-file lag history: { realPath -> { prior, at, laggedServed } }.
  const history = new Map();
  const recordWrite = async (path, prior) => {
    if (!lag) return;
    try {
      history.set(await realpath(path), { prior, at: Date.now(), laggedServed: false });
    } catch {
      /* file vanished — nothing to lag */
    }
  };

  return createServer((req, res) => {
    const started = Date.now();
    res.on('finish', () => console.log(`${res.statusCode} ${req.method} ${req.url} ${Date.now() - started}ms`));
    handle(req, res).catch((e) => {
      if (!res.headersSent) {
        writeJson(res, 500, { ok: false, error: { code: 'upstream', message: String(e?.message ?? e) } });
      } else {
        res.end();
      }
    });
  });

  async function handle(req, res) {
    const method = req.method ?? 'GET';
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return writeJson(res, 400, { ok: false, error: { code: 'not_found', message: 'bad path' } });
    }
    if (method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }
    if (method === 'POST') {
      if (url.pathname === '/save') return handleSave(req, res);
      if (url.pathname === '/save-items') return handleSaveItems(req, res);
      return writeJson(res, 404, { ok: false, error: { code: 'not_found', message: 'POST /save or POST /save-items only' } });
    }
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD, POST, OPTIONS' });
      return res.end();
    }
    return serveStatic(res, url.pathname, method === 'HEAD');
  }

  async function handleSave(req, res) {
    let body;
    try {
      body = await readJson(req);
    } catch {
      return writeJson(res, 400, { ok: false, error: { code: 'invalid_json', message: 'body is not JSON' } });
    }
    // Fail fast before any file I/O, mirroring the worker's ordering.
    if (!isValidCharacter(body?.character))
      return writeJson(res, 400, { ok: false, error: { code: 'invalid_character', message: 'not an ed-character/1 file' } });
    const id = body?.id;
    if (!isValidId(id))
      return writeJson(res, 400, { ok: false, error: { code: 'invalid_id', message: 'character id must match [a-z0-9][a-z0-9-]{0,63}' } });
    const rawBase = body?.base;
    if (rawBase !== undefined && rawBase !== null && typeof rawBase !== 'string')
      return writeJson(res, 400, { ok: false, error: { code: 'invalid_base', message: 'base must be a file sha string or omitted' } });
    // Local saves run the legacy overwrite path (local reads carry no ETag, so
    // the app never sends a base here); `base` is validated for mirror-shape.
    const filePath = join(resolvedRoot, CHARACTERS_DIR, `${id}.json`);
    const indexPath = join(resolvedRoot, CHARACTERS_DIR, 'index.json');
    await enqueue(async () => {
      const prior = await readRaw(filePath);
      const created = prior === null;
      await writePretty(filePath, body.character);
      await recordWrite(filePath, prior);
      if (!created) return; // index is create-only, mirroring the worker
      const index = (await readJsonFile(indexPath)) ?? { schema: 'ed-characters-index/1', characters: {} };
      index.characters = index.characters ?? {};
      if (!index.characters[id]) {
        index.characters[id] = { name: body.character.meta?.name ?? '', portrait: body.character.meta?.portrait ?? null };
        const priorIndex = await readRaw(indexPath);
        await writePretty(indexPath, index);
        await recordWrite(indexPath, priorIndex);
      }
    });
    return writeJson(res, 200, { ok: true, commit: { sha: 'local', url: '' } });
  }

  async function handleSaveItems(req, res) {
    let body;
    try {
      body = await readJson(req);
    } catch {
      return writeJson(res, 400, { ok: false, error: { code: 'invalid_json', message: 'body is not JSON' } });
    }
    const checked = checkItemsDelta(body);
    if (!checked.ok)
      return writeJson(res, 400, { ok: false, error: { code: 'invalid_items', message: checked.errors[0] } });
    const itemsPath = join(resolvedRoot, ITEMS_STORE);
    const bad = await enqueue(async () => {
      const file = (await readJsonFile(itemsPath)) ?? { ...FRESH_CATALOG, items: {} };
      const prior = await readRaw(itemsPath);
      for (const [name, item] of Object.entries(body?.items ?? {})) file.items[name] = item;
      for (const name of body?.delete ?? []) delete file.items[name];
      // Re-check the whole merged file before writing — the same gate the worker
      // applies before its PUT (a merged file that no longer validates never lands).
      const v = validateItemsFile(file);
      if (!v.ok) return { status: 400, body: { ok: false, error: { code: 'invalid_items', message: v.errors[0] } } };
      await writePretty(itemsPath, file);
      await recordWrite(itemsPath, prior);
      return null;
    });
    if (bad) return writeJson(res, bad.status, bad.body);
    return writeJson(res, 200, { ok: true, commit: { sha: 'local', url: '' } });
  }

  async function serveStatic(res, pathname, isHead) {
    const rel = safeRel(pathname);
    if (rel === null) return writeJson(res, 403, { ok: false, error: { code: 'not_found', message: 'forbidden' } });

    // realpath canonicalizes both sides so the containment check (and the lag
    // history key) hold even when the docroot path has a symlink hop — macOS
    // /var → /private/var, or the /dev self-symlink below.
    let rootReal;
    try {
      rootReal = await realpath(resolvedRoot);
    } catch {
      return writeJson(res, 500, { ok: false, error: { code: 'upstream', message: 'docroot missing' } });
    }
    let real;
    try {
      real = await realpath(join(resolvedRoot, rel));
    } catch {
      return writeJson(res, 404, { ok: false, error: { code: 'not_found', message: 'not found' } });
    }
    if (real !== rootReal && !real.startsWith(rootReal + SEP))
      return writeJson(res, 403, { ok: false, error: { code: 'not_found', message: 'forbidden' } });

    if (statSync(real).isDirectory()) {
      real = join(real, 'index.html');
      try {
        statSync(real);
      } catch {
        return writeJson(res, 404, { ok: false, error: { code: 'not_found', message: 'not found' } });
      }
    }

    let content;
    if (lag > 0) {
      const h = history.get(real);
      if (h && Date.now() - h.at < lag && !h.laggedServed) {
        h.laggedServed = true;
        content = Buffer.from(h.prior ?? '', 'utf8');
      }
    }
    if (content === undefined) content = await readFile(real);

    res.writeHead(200, {
      'Content-Type': MIME[extname(real).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(isHead ? undefined : content);
  }
}

// --- CLI ----------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [key, value] = a.slice(2).split('=');
    if (value !== undefined) out[key] = value;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
      out[key] = argv[i + 1];
      i++;
    } else out[key] = true;
  }
  return out;
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const port = args.port !== undefined ? Number(args.port) : Number(process.env.PORT ?? 8000);
  const lag = args.lag !== undefined ? Number(args.lag) : 0;
  const server = createDevServer({ lag });
  server.listen(port, () => {
    console.log(`EDCharSheet local dev server`);
    console.log(`  site:    http://localhost:${port}/  and  http://localhost:${port}/dev/`);
    console.log(`  save:    POST http://localhost:${port}/save  (data/characters/<id>.json)`);
    console.log(`  save-it: POST http://localhost:${port}/save-items  (custom-items.json)`);
    if (lag > 0) console.log(`  lag:     ${lag}ms one-shot stale-read simulation on`);
    console.log(`  open the app with the endpoint override, e.g.`);
    console.log(`  http://localhost:${port}/?save=http://localhost:${port}/save&save-items=http://localhost:${port}/save-items`);
  });
}
