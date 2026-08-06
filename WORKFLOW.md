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
| `character-data` | File store for `data/character.json` | ❌ never deployed |

The deploy workflow listens to `main` and `dev` only, so nothing committed to
`character-data` ever triggers a rebuild or a Pages deployment. The branch exists
for one reason: to hold the latest `data/character.json` — the inputs-only
character file — committed by the serverless save target
(docs/GITHUB-SERVERLESS-SAVE.md) on the app's behalf.

Both environments **source the character detail from this one branch**: on the
Pages site the app fetches `data/character.json` live from `character-data`
(`raw.githubusercontent.com`, falling back to the deployed copy in the bundle);
locally it reads the working copy. Because `/` and `/dev/` read the same branch,
a save shows up identically in both — and a save never rebuilds either one.

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
- **Saves never rebuild the app.** The serverless save target commits
  `data/character.json` to the dedicated `character-data` branch — a file store,
  not a build input (see "The `character-data` branch" above and
  docs/GITHUB-SERVERLESS-SAVE.md). It is never deployed.
- **What gets deployed:** the static app (`index.html`, `ui/`, `engine/`,
  `data/`, `rules/`, assets). Excluded: `tools/`, `node_modules/`, `package*.json`,
  `*.xlsx`, and anything gitignored (source spreadsheet, rulebook extracts,
  talent prose).
