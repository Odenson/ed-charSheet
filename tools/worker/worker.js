// worker.js — GitHub serverless save endpoint (Cloudflare Worker).
//
// POST /save  { "character": <inputs-only ed-character/1 JSON> }  (or the file itself)
//
// Commits the posted character to the `character-data` branch on the app's
// behalf, so the GitHub credential never enters the browser. The deploy workflow
// does not watch that branch, so a save is a data commit — never an app rebuild.
// The app reads the branch live (store.js), so a save shows up on next load.
//
// This build REQUIRES SAVE_KEY and fails closed (runbook §2.1 / §5.2): a missing
// or wrong `x-save-key`, OR an unconfigured SAVE_KEY, is rejected 401. Everything
// else follows the design doc §4.2 handler: schema/size validation, env-pinned
// path/branch (never taken from the request), GET-sha → PUT, bounded 409 retry.
//
// Secrets/vars come from the environment (wrangler.toml [vars] + `wrangler secret
// put`); nothing sensitive is committed or shipped in the app. Stateless: the
// worker holds nothing between calls.

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const GITHUB = 'https://api.github.com';
const MAX_BYTES = 512 * 1024; // character.json is a few KB; cap generously
const MAX_RETRIES = 3;        // bounded 409 (sha moved) retries

export default {
  async fetch(request, env) {
    // Allow-list the app origin; overridable by env for the /dev/ or a fork.
    const origin = env.ALLOWED_ORIGIN ?? 'https://odenson.github.io';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-save-key',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== '/save' || request.method !== 'POST')
      return json(cors, 404, { ok: false, error: { code: 'not_found', message: 'POST /save only' } });

    // SAVE_KEY is required (fail closed): reject if unconfigured, missing, or
    // wrong. The key is compared in constant time (hash-then-compare, see
    // safeEqual) so a timing side-channel can't leak it. Absence of the header
    // is not itself secret, so that one case short-circuits.
    const providedKey = request.headers.get('x-save-key');
    if (!env.SAVE_KEY || providedKey === null || !(await safeEqual(providedKey, env.SAVE_KEY)))
      return json(cors, 401, { ok: false, error: { code: 'unauthorized', message: 'bad or missing save key' } });

    let character;
    try {
      const body = await request.json();
      character = body.character ?? body; // accept { character } or the file itself
    } catch {
      return json(cors, 400, { ok: false, error: { code: 'invalid_json', message: 'body is not JSON' } });
    }
    if (!isValidCharacter(character))
      return json(cors, 400, { ok: false, error: { code: 'invalid_character', message: 'not an ed-character/1 file' } });

    const path = env.GITHUB_PATH ?? 'data/character.json';
    const branch = env.GITHUB_BRANCH ?? 'character-data'; // NOT main/dev — never triggers a deploy
    const repo = `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
    const gh = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      // GitHub's API rejects requests with no User-Agent (403 "Request forbidden
      // by administrative rules"). Workers don't set one by default, so send it.
      'User-Agent': 'ed-charsheet-save',
    };
    const content = toBase64(JSON.stringify(character, null, 2) + '\n'); // byte-identical to the file save

    try {
      await ensureBranch(repo, branch, gh); // first save only
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const sha = await currentSha(repo, path, branch, gh);
        const res = await fetch(`${GITHUB}/repos/${repo}/contents/${path}`, {
          method: 'PUT',
          headers: { ...gh, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Save character (serverless)', content, sha, branch }),
        });
        if (res.ok) {
          const c = await res.json();
          return json(cors, 200, { ok: true, commit: { sha: c.content.sha, url: c.html_url } });
        }
        if (res.status !== 409) { // other failure
          console.error(JSON.stringify({ message: 'github PUT failed', status: res.status }));
          return json(cors, 502, { ok: false, error: { code: 'upstream', message: `github ${res.status}` } });
        }
        // 409: sha moved between our GET and PUT — loop re-reads and retries.
      }
      return json(cors, 409, { ok: false, error: { code: 'conflict', message: 'sha kept moving' } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ message: 'save failed (upstream)', error: message }));
      return json(cors, 502, { ok: false, error: { code: 'upstream', message } });
    }
  },
};

// First save on a fresh repo: create the data branch from the default branch so
// the contents API has a ref to write into. No-op on every later save.
async function ensureBranch(repo, branch, gh) {
  const head = await fetch(`${GITHUB}/repos/${repo}/git/ref/heads/${branch}`, { headers: gh });
  if (head.ok) return;
  const meta = await (await fetch(`${GITHUB}/repos/${repo}`, { headers: gh })).json();
  const base = await (await fetch(`${GITHUB}/repos/${repo}/git/ref/heads/${meta.default_branch}`, { headers: gh })).json();
  const created = await fetch(`${GITHUB}/repos/${repo}/git/refs`, {
    method: 'POST',
    headers: { ...gh, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }),
  });
  if (!created.ok) throw new Error(`create branch ${created.status}`);
}

async function currentSha(repo, path, branch, gh) {
  const res = await fetch(`${GITHUB}/repos/${repo}/contents/${path}?ref=${branch}`, { headers: gh });
  if (!res.ok) throw new Error(`read ${res.status}`);
  return (await res.json()).sha;
}

// Base64-encode a string as its UTF-8 bytes. `btoa` alone only accepts Latin1
// (code points 0–255) and throws on characters like em-dashes or the ✦ magic
// star, which the character data contains. Encoding to UTF-8 bytes first is also
// exactly what GitHub's contents API wants (base64 of the file's UTF-8 bytes),
// so the committed file stays byte-identical to the local file save.
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Constant-time secret comparison. Hash both sides to a fixed 32 bytes, then
// compare with an XOR accumulator so neither the loop length nor the per-byte
// work depends on the secret's value — no timing side-channel. Uses only the
// web-standard crypto.subtle.digest, so it runs identically on the Workers
// runtime and under `node --test` (avoids the CF-only crypto.subtle.timingSafeEqual).
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

function isValidCharacter(c) {
  return (
    !!c &&
    typeof c === 'object' &&
    c.schema === 'ed-character/1' &&
    JSON.stringify(c).length <= MAX_BYTES
  );
}

function json(cors, status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...cors } });
}
