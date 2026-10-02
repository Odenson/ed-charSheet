// Deterministic file logic for the /release-feature workflow (docs/FEATURE-WORKFLOW.md).
//   node tools/release.mjs check [slug]
//       Reads data/changelog.json and plan frontmatter; prints a JSON report:
//       the unreleased changes, plans still `shipped: unreleased`, the proposed
//       next version, plus `stops` (block the release) and `warnings` (show to
//       the owner). Git/CI/test preconditions are checked by the command.
//   node tools/release.mjs apply --version X.Y.Z --summary "…" [--date YYYY-MM-DD]
//       Moves `unreleased` into a new top `releases` entry, empties `unreleased`,
//       and rewrites `shipped: unreleased` to `shipped: vX.Y.Z` in plan frontmatter.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, '..');

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

export function planFiles(root = defaultRoot) {
  const dir = path.join(root, 'plans');
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile() && /^PLAN-.*\.md$/.test(e.name))
      out.push({ file: path.join(dir, e.name), slug: e.name.slice(5, -3).toLowerCase() });
    if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'plan.md')))
      out.push({ file: path.join(dir, e.name, 'plan.md'), slug: e.name });
  }
  return out;
}

export function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

export function nextVersion(latest, types) {
  const [maj, min, pat] = latest.split('.').map(Number);
  const fixesOnly = types.length > 0 && types.every((t) => t === 'fixed');
  return fixesOnly ? { version: `${maj}.${min}.${pat + 1}`, bump: 'patch' } : { version: `${maj}.${min + 1}.0`, bump: 'minor' };
}

export function check({ root = defaultRoot, slug = null } = {}) {
  const log = readJson(path.join(root, 'data/changelog.json'));
  const changes = log.unreleased?.changes ?? [];
  const latest = log.releases[0].version;
  const plans = planFiles(root).map((p) => {
    const fm = frontmatter(fs.readFileSync(p.file, 'utf8')) ?? {};
    return { slug: p.slug, file: path.relative(root, p.file), status: fm.status ?? null, shipped: fm.shipped ?? null };
  });
  const unreleasedPlans = plans.filter((p) => p.status === 'implemented' && p.shipped === 'unreleased');
  const inFlight = plans.filter((p) => ['draft', 'approved', 'building'].includes(p.status));
  const stops = [];
  const warnings = [];

  if (changes.length === 0) stops.push('Nothing to release: data/changelog.json `unreleased.changes` is empty.');

  let headline = null;
  if (slug) {
    const hit = plans.find((p) => p.slug === slug.toLowerCase());
    if (!hit) stops.push(`No plan found for slug "${slug}" (looked for plans/${slug}/plan.md and plans/PLAN-${slug.toUpperCase()}.md).`);
    else if (hit.status !== 'implemented' || hit.shipped !== 'unreleased')
      stops.push(`Plan "${slug}" is status=${hit.status}, shipped=${hit.shipped}; a release needs implemented + unreleased.`);
    else headline = hit;
  }

  if (changes.length > 0 && unreleasedPlans.length === 0 && !slug)
    warnings.push('Unreleased changelog lines exist but no plan is `implemented` + `shipped: unreleased` (plain fixes or work outside the feature workflow?).');
  if (changes.length === 0 && unreleasedPlans.length > 0)
    warnings.push('Plans are marked unreleased but the changelog has no unreleased lines: add the user-facing line(s) first.');
  for (const p of inFlight) warnings.push(`Plan "${p.slug}" is still ${p.status} (not part of this release).`);

  const proposed = nextVersion(latest, changes.map((c) => c.type));
  return {
    ok: stops.length === 0,
    stops, warnings, latest,
    proposed,
    headline: headline?.slug ?? null,
    unreleasedSummary: log.unreleased?.summary ?? '',
    changes,
    plansToMarkShipped: unreleasedPlans.map((p) => p.slug),
  };
}

export function apply({ root = defaultRoot, version, summary, date }) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error(`bad version "${version}"`);
  if (!summary || !summary.trim()) throw new Error('summary is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error(`bad date "${date}"`);
  const file = path.join(root, 'data/changelog.json');
  const raw = fs.readFileSync(file, 'utf8');
  const log = JSON.parse(raw);
  if (!(log.unreleased?.changes?.length > 0)) throw new Error('nothing unreleased');
  if (log.releases.some((r) => r.version === version)) throw new Error(`version ${version} already released`);
  log.releases.unshift({ version, date, summary: summary.trim(), changes: log.unreleased.changes });
  log.unreleased = { summary: '', changes: [] };
  fs.writeFileSync(file, JSON.stringify(log, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
  const marked = [];
  for (const p of planFiles(root)) {
    const text = fs.readFileSync(p.file, 'utf8');
    const fm = frontmatter(text);
    if (fm?.status === 'implemented' && fm.shipped === 'unreleased') {
      const end = text.indexOf('\n---\n', 3) + 1; // end of the frontmatter block
      const head = text.slice(0, end).replace(/^shipped:\s*unreleased$/m, `shipped: v${version}`);
      fs.writeFileSync(p.file, head + text.slice(end));
      marked.push(p.slug);
    }
  }
  return { version, marked };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
  try {
    if (cmd === 'check') console.log(JSON.stringify(check({ slug: rest.find((a) => !a.startsWith('--')) ?? null }), null, 2));
    else if (cmd === 'apply') console.log(JSON.stringify(apply({ version: arg('version'), summary: arg('summary'), date: arg('date') ?? new Date().toISOString().slice(0, 10) }), null, 2));
    else { console.error('usage: release.mjs check [slug] | apply --version X.Y.Z --summary "…" [--date YYYY-MM-DD]'); process.exit(2); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
