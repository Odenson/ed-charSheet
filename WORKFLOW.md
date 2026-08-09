# Dev → Main Workflow

Two environments, one repository, deployed by GitHub Actions
([`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)).

| Branch | Environment | URL |
|--------|-------------|-----|
| `main` | Production  | https://odenson.github.io/ed-charSheet/ |
| `dev`  | Testing     | https://odenson.github.io/ed-charSheet/dev/ |

A push to **either** branch rebuilds the whole site from the current state of
**both** branches (`main` → root, `dev` → `/dev/`), so the two instances never
drift apart.

## The `character-data` branch — file store, not build input

There is a third branch, **`character-data`**, that is deliberately **not part of
the build**:

| Branch | Role | Deployed |
|--------|------|----------|
| `main` | Production app | ✅ → root |
| `dev` | Testing app | ✅ → `/dev/` |
| `character-data` | File store for the grouped character store `data/characters.json`, the portrait image `data/chakka.jpg`, **and the shared custom-item catalog `data/custom-items.json`** | ❌ never deployed |

The deploy workflow listens to `main` and `dev` only, so nothing committed to
`character-data` ever triggers a rebuild or a Pages deployment. The branch exists
for one reason: to hold the live data — the grouped store
`data/characters.json` (`{ schema: "ed-characters/1", characters: { "<id>": { …
} } }`) and the custom-item catalog `data/custom-items.json` (`ed-items/2`) —
committed by the serverless save target (docs/GITHUB-SERVERLESS-SAVE.md) on the
app's behalf, alongside the portrait image each entry references via
`meta.portrait`. The legacy single-file `data/character.json` was **removed at
the v1.6.0 promotion**; the grouped store is the only character save target, and
`data/custom-items.json` is the only custom-item target.

Both environments **source the character detail from this one branch**: on the
Pages site the app reads `data/characters.json` live from `character-data` —
preferring the GitHub contents API (git-consistent, so a fresh save shows up
immediately), falling back to the raw CDN
(docs/GITHUB-SERVERLESS-SAVE.md §4.5); locally it reads the gitignored working
copy (see "Local character copies" below). The portrait is read live from the
same branch's raw CDN. Because `/` and `/dev/` read the same branch, a save
shows up identically in both — and a save never rebuilds either one. The app
bundles ship **no character data**: `data/characters.json`, `data/custom-items.json`
and the portrait are gitignored so they stay out of every deploy (local working
copies only).

**The fold job — the one exception to "never a build input."** The workflow
[`.github/workflows/fold-custom-items.yml`](.github/workflows/fold-custom-items.yml)
runs on a push to `character-data` touching `data/custom-items.json` (or
manually) and mirrors that file into **`rules/custom-items.json` on `dev`** — a
real rule file, part of the build input. The consequence is deliberate and
`dev`-only (docs/PLAN-CUSTOM-ITEMS.md §3): a custom-item save triggers one extra
`dev` rebuild (so `/dev/` bundles the catalog as a durability fallback), while
`main`'s tree is untouched — production never rebuilds from a custom-item save.
The fold validates every item and the merged catalog through the shared
`engine/validate-item.js` gate and only writes when the mirrored file would
change.

## One-time setup (repo owner)

Enable Pages with the Actions source — this only you can do:

1. GitHub → repo **Settings** → **Pages**.
2. **Build and deployment → Source: GitHub Actions**.

(Optional but recommended) Protect production so it only changes via review:

3. **Settings → Branches → Add branch ruleset/protection** for `main`:
   require a pull request before merging.

## Everyday development

```bash
git switch dev
# ...make changes, commit...
git push            # auto-deploys the DEV instance (/dev/)
```

Test at the `/dev/` URL. The dev instance uses the same data and code paths as
production, just served from a subpath.

## Promoting dev → main (release to production)

Promotion is a **squash** pull request, so `main` gets exactly one commit per
release. Because the individual dev commits are collapsed, the changelog is
**authored, not generated** — finalize it as the first step of every release.

**1. Finalize the changelog** (`data/changelog.json` — the in-app "What's new").
Move everything under `unreleased.changes` into a **new `releases` entry** at the
top, with a bumped [SemVer](https://semver.org) version and today's date, and
empty out `unreleased`:

```jsonc
"unreleased": { "changes": [] },
"releases": [
  { "version": "1.1.0", "date": "2026-08-15", "changes": [ /* moved from unreleased */ ] },
  { "version": "1.0.0", "date": "2026-08-01", "changes": [ /* … */ ] }
]
```

SemVer at a glance: **major** = breaking/removed, **minor** = new features,
**patch** = fixes only. Commit this on `dev` before opening the PR.

**2. Open and squash-merge the release PR:**

```bash
# from an up-to-date dev branch (changelog already finalized & committed)
gh pr create --base main --head dev --title "Release v1.1.0: <summary>" --body "..."
# review, then squash so main keeps one commit per release:
gh pr merge --squash
```

**Keep the squash commit message = the changelog entry.** Paste the release's
changes into the PR/squash body so `main`'s git log and the in-app changelog tell
the same story and never drift.

Merging into `main` triggers the workflow and updates the **production** site.
(You can also open/merge the PR from the GitHub web UI — pick **Squash and merge**.)

**3. Sync `main` back into `dev` — do this immediately after every merge.**

```bash
git switch dev
git merge origin/main --no-edit   # brings the squash commit into dev's history
git push
```

This step is **not optional** — skipping it is what causes the "conflicts on
every release PR" problem. A squash merge puts a **brand-new commit** on `main`
that `dev` never receives; `dev` keeps its own commits for the same release. Left
alone, the two branches fork and their common ancestor freezes at an old release,
so `data/changelog.json` (which changes every release) shows up as a conflict each
time — two independent edits to the same lines with no shared base.

Right after the squash merge, `dev` and `main` are content-identical, so this
merge-back is trivial and conflict-free; its only job is to **advance the common
ancestor** to the release just cut, so the *next* release PR diffs cleanly. If a
release PR ever does conflict (e.g. this step was missed), resolve with `dev` as
the source of truth: `git merge -s ours origin/main` on `dev` keeps dev's tree
entirely while reconnecting the histories, then push.

## Notes

- **Relative paths only.** Because the dev instance lives under `/dev/`, all
  asset and `fetch` paths in the app must be relative (`./data/...`,
  `./engine/...`), never root-absolute (`/data/...`). This keeps the same build
  working at both the root and the subpath.
- **Saves never rebuild the app.** The serverless save target upserts
  `characters[id]` in `data/characters.json` on the dedicated `character-data`
  branch — a file store, not a build input (see "The `character-data` branch"
  above and docs/GITHUB-SERVERLESS-SAVE.md). It is never deployed. The one
  exception: a **custom-item** save (via `/save-items`) triggers the fold job,
  which mirrors the catalog into `rules/custom-items.json` **on `dev`** — a
  build input — so `/dev/` rebuilds while `main` stays untouched
  (docs/PLAN-CUSTOM-ITEMS.md §3).
- **Local character copies.** `data/characters.json`, `data/custom-items.json`
  and the portrait image (`data/chakka.jpg`) are gitignored (see `.gitignore`):
  they live on `character-data`, not in the bundle. Local dev / `file://` reads
  the working copies from the working tree. After a fresh clone, fetch the latest
  with `git show character-data:data/characters.json > data/characters.json` (and
  likewise for `data/custom-items.json` and the portrait) — or just rely on the
  branch live-read on the Pages site. Local custom-item editing works off the
  working copy exactly like character editing; a save commits it to the branch.
- **What gets deployed:** the static app (`index.html`, `ui/`, `engine/`,
  `data/`, `rules/`, assets). Excluded: `tools/`, `node_modules/`, `package*.json`,
  `*.xlsx`, and anything gitignored (source spreadsheet, rulebook extracts,
  talent prose, `data/characters.json`, the portrait image).
