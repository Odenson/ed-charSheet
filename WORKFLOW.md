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

Promotion is a pull request:

```bash
# from an up-to-date dev branch
gh pr create --base main --head dev --title "Release: <summary>" --body "..."
# review, then:
gh pr merge --merge
```

Merging into `main` triggers the workflow and updates the **production** site.
(You can also open/merge the PR from the GitHub web UI.)

## Notes

- **Relative paths only.** Because the dev instance lives under `/dev/`, all
  asset and `fetch` paths in the app must be relative (`./data/...`,
  `./engine/...`), never root-absolute (`/data/...`). This keeps the same build
  working at both the root and the subpath.
- **What gets deployed:** the static app (`index.html`, `ui/`, `engine/`,
  `data/`, `rules/`, assets). Excluded: `tools/`, `node_modules/`, `package*.json`,
  `*.xlsx`, and anything gitignored (source spreadsheet, rulebook extracts,
  talent prose).
