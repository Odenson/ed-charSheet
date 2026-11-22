#!/usr/bin/env node
// tools/fold-custom-skills.mjs — the CI fold job for owner-created custom skills
// (plans/gen-skill-other I5), mirroring tools/fold-custom-skills.mjs.
//
// Mirrors the custom-skill catalog (`data/custom-skills.json`, ed-skills/1)
// from the `character-data` branch into `rules/custom-skills.json` on
// the app's `dev` branch — durability/versioning only. The app never depends on
// the fold for availability: the live read is the branch (store.js); the bundled
// `rules/custom-skills.json` is only the offline fallback. Runs from GitHub
// Actions (`.github/workflows/fold-custom-skills.yml`) with the ephemeral
// `GITHUB_TOKEN` (`contents: write` + `issues: write`) whenever a custom-item
// commit lands on `character-data`.
//
// Contract (same GET-sha → PUT bounded-409-retry shape as the worker):
//   1. GET data/custom-skills.json on `character-data` (contents API).
//      A 404 (catalog never created yet) is a no-op success — nothing to fold.
//   2. File-level checks (valid JSON, schema `ed-skills/1`, `skills` array) abort
//      with an issue; nothing reaches dev. Then each ENTRY is validated with the
//      shared engine/validate-skill.js gate (core names + attributes read from the
//      dev checkout): an invalid entry is DROPPED and listed in an issue, valid
//      ones still fold — one bad entry never blocks the rest.
//   3. Diff-guard vs `rules/custom-skills.json` on `dev`: byte-identical →
//      exit 0, no PUT, no Pages rebuild.
//   4. PUT the file to `dev` (sha-preconditioned, bounded 409 retry). The push
//      to dev triggers deploy-pages.yml — that rebuild is the fold's job.
//   Any other upstream failure → open an issue and fail.
//
// Runs under `node --test` with a mocked fetch (tools/fold-custom-skills.test.js).

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { validateSkill } from '../engine/validate-skill.js';

const readRules = (f) => JSON.parse(readFileSync(new URL(`../rules/${f}`, import.meta.url), 'utf8'));

/**
 * Pure: keep the valid entries of a custom-skills file, drop (and report) the invalid ones.
 * The first of two same-named entries wins. Never mutates `sourceFile`.
 * @returns {{ file: object, dropped: { name: string, errors: string[] }[] }}
 */
export function foldSkills(sourceFile, { coreNames, attributeNames } = {}) {
  const kept = [];
  const dropped = [];
  const customNames = [];
  for (const skill of sourceFile?.skills ?? []) {
    const name = skill?.name;
    const r = validateSkill(name, skill, { coreNames, attributeNames, customNames });
    if (r.ok) {
      kept.push(skill);
      customNames.push(name);
    } else {
      dropped.push({ name: typeof name === 'string' ? name : '(unnamed)', errors: r.errors });
    }
  }
  return { file: { ...sourceFile, skills: kept }, dropped };
}

const GITHUB = 'https://api.github.com';
const MAX_RETRIES = 3; // bounded 409 (sha moved) retries, same as the worker

/** Defaults — overridable via env (the workflow pins the real values). */
export const DEFAULT_ENV = {
  SOURCE_BRANCH: 'character-data',
  TARGET_BRANCH: 'dev',
  SOURCE_PATH: 'data/custom-skills.json',
  TARGET_PATH: 'rules/custom-skills.json',
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
export async function foldCustomSkills(env, { fetchImpl = globalThis.fetch } = {}) {
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
  if (!parsed || parsed.schema !== 'ed-skills/1' || !Array.isArray(parsed.skills))
    return fail(
      `Fold blocked: ${cfg.SOURCE_PATH} on ${cfg.SOURCE_BRANCH} is not an ed-skills/1 file with a skills array`,
      '',
      { status: 'aborted' },
    );
  const folded = foldSkills(parsed, {
    coreNames: readRules('skills.json').skills.map((x) => x.name),
    attributeNames: readRules('attributes.json').order,
  });
  const dropped = folded.dropped;
  parsed = folded.file;
  // Report dropped entries (the valid ones still fold below).
  if (dropped.length) {
    await openIssue(
      `Fold dropped ${dropped.length} invalid custom skill(s) from ${cfg.SOURCE_PATH}`,
      dropped.map((d) => `- ${d.name}: ${d.errors.join('; ')}`).join('\n'),
    ).catch(() => null);
  }

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
        message: 'Fold custom skills (CI)',
        content: toBase64(content),
        sha: target.notFound ? undefined : target.sha,
        branch: cfg.TARGET_BRANCH,
      }),
    });
    if (res.ok) {
      const c = await res.json().catch(() => null);
      return { ok: true, status: 'folded', commit: c?.content?.sha, dropped };
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
  const result = await foldCustomSkills(process.env);
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
