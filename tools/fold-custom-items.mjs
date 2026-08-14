#!/usr/bin/env node
// tools/fold-custom-items.mjs — the CI fold job (plans/PLAN-CUSTOM-ITEMS.md
// §6, Phase 6).
//
// Mirrors the player-created custom-item catalog (`data/custom-items.json`,
// ed-items/2) from the `character-data` branch into `rules/custom-items.json` on
// the app's `dev` branch — durability/versioning only. The app never depends on
// the fold for availability: the live read is the branch (store.js); the bundled
// `rules/custom-items.json` is only the offline fallback. Runs from GitHub
// Actions (`.github/workflows/fold-custom-items.yml`) with the ephemeral
// `GITHUB_TOKEN` (`contents: write` + `issues: write`) whenever a custom-item
// commit lands on `character-data`.
//
// Contract (same GET-sha → PUT bounded-409-retry shape as the worker):
//   1. GET data/custom-items.json on `character-data` (contents API).
//      A 404 (catalog never created yet) is a no-op success — nothing to fold.
//   2. Validate the fetched file with the shared engine/validate-item.js gate —
//      the fold is the final filter between the open `/save-items` endpoint and
//      the deployed rules. Invalid → open a GitHub issue (ephemeral token,
//      `issues: write`) and fail; nothing reaches dev.
//   3. Diff-guard vs `rules/custom-items.json` on `dev`: byte-identical →
//      exit 0, no PUT, no Pages rebuild.
//   4. PUT the file to `dev` (sha-preconditioned, bounded 409 retry). The push
//      to dev triggers deploy-pages.yml — that rebuild is the fold's job.
//   Any other upstream failure → open an issue and fail.
//
// Runs under `node --test` with a mocked fetch (tools/fold-custom-items.test.js).

import { pathToFileURL } from 'node:url';
import { validateItemsFile } from '../engine/validate-item.js';

const GITHUB = 'https://api.github.com';
const MAX_RETRIES = 3; // bounded 409 (sha moved) retries, same as the worker

/** Defaults — overridable via env (the workflow pins the real values). */
export const DEFAULT_ENV = {
  SOURCE_BRANCH: 'character-data',
  TARGET_BRANCH: 'dev',
  SOURCE_PATH: 'data/custom-items.json',
  TARGET_PATH: 'rules/custom-items.json',
};

/**
 * Run one fold. Pure I/O over the GitHub contents API — no git, no DOM, no
 * network beyond the given `fetchImpl`. Returns a result object; never throws
 * (upstream failures become `{ ok: false }` with an opened issue).
 *
 * @param {object} env `{ GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, … }` (all configurable)
 * @param {object} [opts] `{ fetchImpl }` — injectable for tests (defaults to globalThis.fetch)
 * @returns {Promise<{ ok: true, status: 'no-op'|'folded', reason?, commit? } |
 *                   { ok: false, status, error, issueUrl? }>}
 */
export async function foldCustomItems(env, { fetchImpl = globalThis.fetch } = {}) {
  const cfg = { ...DEFAULT_ENV, ...env };
  const { GITHUB_TOKEN: token, GITHUB_OWNER: owner, GITHUB_REPO: repo } = cfg;
  if (!token || !owner || !repo)
    return { ok: false, status: 'error', error: 'GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO are required' };

  const gh = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    // GitHub rejects requests with no User-Agent (403 by administrative rules).
    'User-Agent': 'ed-charsheet-fold',
  };

  const readTarget = () => readFile(fetchImpl, gh, owner, repo, cfg.TARGET_PATH, cfg.TARGET_BRANCH);
  const openIssue = (title, body) => createIssue(fetchImpl, gh, owner, repo, title, body);
  const fail = (title, body, extra = {}) =>
    openIssue(title, body).then(
      (issueUrl) => ({ ok: false, status: extra.status ?? 'error', error: title, issueUrl: issueUrl ?? null }),
      () => ({ ok: false, status: extra.status ?? 'error', error: title, issueUrl: null }),
    );

  // 1 — read the source catalog from the data branch.
  const source = await readFile(fetchImpl, gh, owner, repo, cfg.SOURCE_PATH, cfg.SOURCE_BRANCH);
  if (source.notFound) return { ok: true, status: 'no-op', reason: 'catalog not created on the source branch' };
  if (!source.ok)
    return fail(`Fold failed: could not read ${cfg.SOURCE_PATH} on ${cfg.SOURCE_BRANCH} (HTTP ${source.status})`, '');

  // 2 — validate with the shared gate (final filter before dev).
  let parsed;
  try {
    parsed = JSON.parse(source.text);
  } catch {
    return fail(`Fold blocked: ${cfg.SOURCE_PATH} on ${cfg.SOURCE_BRANCH} is not valid JSON`, source.text.slice(0, 500));
  }
  const checked = validateItemsFile(parsed);
  if (!checked.ok)
    return fail(
      `Fold blocked: ${cfg.SOURCE_PATH} on ${cfg.SOURCE_BRANCH} failed the shared validator`,
      checked.errors.join('\n'),
      { status: 'aborted' },
    );

  // Canonical bytes the fold writes and diffs against: pretty JSON + trailing
  // newline — byte-identical to what the worker commits to character-data.
  const content = JSON.stringify(parsed, null, 2) + '\n';

  // 3 — diff-guard vs the current dev copy (no PUT, no rebuild when identical).
  let target = await readTarget();
  if (!target.ok && !target.notFound)
    return fail(`Fold failed: could not read ${cfg.TARGET_PATH} on ${cfg.TARGET_BRANCH} (HTTP ${target.status})`, '');
  if (target.ok && target.text === content)
    return { ok: true, status: 'no-op', reason: 'rules copy already identical' };

  // 4 — write to dev: sha-preconditioned PUT, bounded 409 retry. A 409 means
  // the target moved (a concurrent fold or an unrelated dev push) — re-read and
  // retry, exactly like the worker's save loop.
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetchImpl(`${GITHUB}/repos/${owner}/${repo}/contents/${cfg.TARGET_PATH}`, {
      method: 'PUT',
      headers: { ...gh, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Fold custom items (CI)',
        content: toBase64(content),
        sha: target.notFound ? undefined : target.sha,
        branch: cfg.TARGET_BRANCH,
      }),
    });
    if (res.ok) {
      const c = await res.json().catch(() => null);
      return { ok: true, status: 'folded', commit: c?.content?.sha };
    }
    if (res.status !== 409)
      return fail(`Fold failed: PUT ${cfg.TARGET_PATH} on ${cfg.TARGET_BRANCH} returned HTTP ${res.status}`, '');

    const reread = await readTarget();
    if (!reread.ok && !reread.notFound)
      return fail(`Fold failed: could not re-read ${cfg.TARGET_PATH} (HTTP ${reread.status})`, '');
    if (reread.ok && reread.text === content)
      return { ok: true, status: 'no-op', reason: 'a concurrent fold already wrote identical content' };
    target = reread;
  }
  return fail(`Fold failed: ${cfg.TARGET_PATH} on ${cfg.TARGET_BRANCH} kept moving (409 × ${MAX_RETRIES})`, '');
}

// --- GitHub contents API helpers (contents API → { ok, sha, text }) ----------

async function readFile(fetchImpl, gh, owner, repo, path, branch) {
  const res = await fetchImpl(`${GITHUB}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: gh });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) return { ok: false, status: res.status };
  const obj = await res.json();
  return { ok: true, sha: obj.sha, text: base64ToString(obj.content) };
}

// Open a failure issue so the fold failure is visible without reading logs.
// Returns the issue URL, or null if the issue call itself failed.
async function createIssue(fetchImpl, gh, owner, repo, title, body) {
  const res = await fetchImpl(`${GITHUB}/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: { ...gh, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body: body || 'See the workflow run for details.' }),
  });
  if (!res.ok) return null;
  const out = await res.json().catch(() => null);
  return out?.html_url ?? null;
}

// Node-side base64 (Buffer), so the fold's output is byte-identical to the
// worker's UTF-8-safe toBase64 — no Latin-1 assumptions, em-dashes intact.
const toBase64 = (str) => Buffer.from(str, 'utf8').toString('base64');
const base64ToString = (b64) => Buffer.from(b64, 'base64').toString('utf8');

// --- CLI entry (run by the workflow; skipped under node --test) ---------------
async function main() {
  const result = await foldCustomItems(process.env);
  if (result.ok) {
    console.log(`fold: ${result.status}${result.reason ? ` — ${result.reason}` : ''}`);
    return;
  }
  console.error(`fold: FAILED — ${result.error}`);
  if (result.issueUrl) console.error(`fold: issue opened at ${result.issueUrl}`);
  process.exitCode = 1;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
