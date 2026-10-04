---
description: Cut a release after the owner has tested — finalize the changelog, open the dev → main PR, squash-merge it, and sync dev. With a slug, that feature is the release headline.
argument-hint: [feature slug — optional]
---

# /release-feature — release orchestrator

You are the **Release Manager**. The product owner runs this **after** they have
finished testing the feature(s) on `dev`. You run in the main (interactive)
session and are the only participant who can ask the owner questions. There are no
subagents: the file logic is in `tools/release.mjs` and the rest is git/gh.

This is the release procedure from [WORKFLOW.md](../../WORKFLOW.md) ("Promoting
dev → main"), automated. Flow reference:
[docs/FEATURE-WORKFLOW.md](../../docs/FEATURE-WORKFLOW.md).

## Inputs

- `$ARGUMENTS` — an optional feature slug (`plans/<slug>/` or
  `plans/PLAN-<SLUG>.md`).
  - **With a slug:** that feature is the release **headline**. Its plan must be
    `status: implemented` and `shipped: unreleased` (built, owner-tested).
  - **Without a slug:** a **full release** of everything unreleased.
  - Either way **everything unreleased on `dev` ships** — a squash of `dev` cannot
    carve out one feature. The slug only names the release.

## Git authority

Running this command is the owner's authorization, for **this workflow only**, to:
commit the changelog and the token-usage report on `dev`, push `dev`, open the `dev → main` release PR,
**squash-merge it**, and merge `origin/main` back into `dev`. Never push to `main`
directly; never use `git add -A` / `git add .` (stage by explicit path); never
force-push. The shared permission baseline allows the push to `dev` but still prompts for
`git merge`, `gh pr create` and `gh pr merge` — the owner approves those prompts. Outside this workflow the usual rule stands.

## Phase 0 — Preflight (stop on any failure)

Before anything else record the start time for the token report:
`date -u +%Y-%m-%dT%H:%M:%SZ` (keep it as `<since>`).

Run these and **stop and report** (do not continue, do not "fix" silently) if any
fails:

1. On branch `dev`: `git branch --show-current`.
2. Clean tree: `git status --porcelain` is empty.
3. `git fetch origin`, then `dev` equals `origin/dev` (`git rev-list --left-right
   --count origin/dev...HEAD` is `0 0`).
4. `dev` already contains `origin/main` (`git merge-base --is-ancestor origin/main
   HEAD`); otherwise the last release was not synced back.
5. `npm test` is green.
6. CI on the `dev` head is green: `gh run list --branch dev --limit 1 --json
   conclusion,status,headSha` — completed, success, and `headSha` equals `HEAD`.
7. `node tools/release.mjs check [slug]` — its JSON `stops` must be empty (nothing
   unreleased; named slug not implemented + unreleased). Keep its `warnings`,
   `proposed`, `changes`, `plansToMarkShipped` for the confirmation.

## Phase 1 — Draft and the ONE confirmation

1. **Version:** use `proposed.version` (patch if every change is `fixed`,
   otherwise minor). Never choose a major bump yourself.
2. **Summary:** one sentence for the release entry. With a slug, lead with that
   feature (read the Summary in `plans/<slug>/tickets.md` if it exists); mention a
   second headline fix if there is one. Reuse `unreleasedSummary` when it is good.
3. **Worker reminder:** if `git diff --name-only origin/main...HEAD --
   tools/worker/worker.js` is non-empty, the Cloudflare save worker changed — note
   that the owner must redeploy it (you do not).
4. Ask the owner **once** (AskUserQuestion) with the full picture in the question:
   version and bump, headline (slug or "full release"), the summary, every change
   line, the plans that will be marked `shipped`, any warnings, and the worker
   reminder. Options: **Proceed** / **Change version** / **Edit summary** /
   **Cancel**. Apply a requested change and ask again only for what changed; on
   Cancel stop with nothing modified.

## Phase 2 — Finalize on dev

1. `node tools/release.mjs apply --version <X.Y.Z> --summary "<summary>"` (it moves
   `unreleased` into a new top release dated today, empties `unreleased`, and sets
   `shipped: v<X.Y.Z>` on plans that were `shipped: unreleased`).
2. `npm test` must be green again; if not, `git checkout -- data plans` and stop.
3. Commit by explicit path (`data/changelog.json` plus each plan file whose
   `shipped:` changed, from `git status --porcelain`): message
   `docs(changelog): release v<X.Y.Z>` with the body naming the headline, ending
   with the attribution trailer from your session's instructions.
4. `git push origin dev`.

## Phase 3 — Release PR and squash merge

1. `gh pr create --base main --head dev --title "Release v<X.Y.Z>: <short headline>"`.
   Body: the summary, the changes grouped by type (Added / Improved / Changed /
   Fixed), the plans marked shipped, the `npm test` result, and the PR checklist
   from [docs/GUARDRAILS.md](../../docs/GUARDRAILS.md) with results (note that the
   features were each tested by the owner on `dev`; per-feature checklists and
   deferred doc edits are in each `plans/<slug>/build-log.md`). End with the PR
   attribution line from your session's instructions.
2. Wait for the PR checks to finish (`gh pr checks <n>`; poll sparingly). If any
   fails, **stop and report** — do not merge.
3. Confirm `gh pr view <n> --json mergeStateStatus` is `CLEAN`, then
   `gh pr merge <n> --squash --subject "Release v<X.Y.Z>: <short headline> (#<n>)"
   --body "<the changelog entry text>"` — the squash message equals the changelog
   entry so `main`'s log and the in-app changelog never drift.

## Phase 4 — Sync dev (not optional)

`git fetch origin`, `git merge origin/main --no-edit`, `git push origin dev`.
Verify `git status -sb` shows `dev` level with `origin/dev` and
`git diff origin/main --stat` is empty. If the merge conflicts, stop and report;
the documented recovery is `git merge -s ours origin/main` on `dev` (WORKFLOW.md),
only with the owner's say-so.

## Phase 5 — Token report and final report

1. Run the report. With a slug it goes in that feature's folder; without one, in
   `plans/releases/v<X.Y.Z>/`:

   ```bash
   node tools/token-report.mjs --workflow release-feature --since <since> --dir plans/<slug>   # or plans/releases/v<X.Y.Z>
   ```
2. Commit `token-usage.md` and `token-usage.json` by explicit path
   (`docs(release): token usage report v<X.Y.Z>`, with the attribution trailer) and
   `git push origin dev`. This is the only commit after the sync; `dev` ends one
   docs commit ahead of `main`, which the next release folds in.
3. Report.

Tell the owner (include the token total and estimated cost from step 1): the version, the PR URL and merge commit, the plans now marked
`shipped: v<X.Y.Z>`, any warnings they accepted, whether `dev` and `main` are in
sync, and the production deploy run (`gh run list --branch main --limit 1`). Repeat
the worker-redeploy reminder if it applied.

## Guardrails

- One confirmation (Phase 1), then run through; stop immediately on any failed
  preflight, red gate, red CI or merge conflict.
- Never merge with failing checks; never push to `main`; never force-push.
- Only the changelog, plan `shipped:` lines and the token-usage report files are written — no application code.
- Do not open the preview or test the UI: the owner has already verified it.
