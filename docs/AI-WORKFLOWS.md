# AI workflows — agents, skills, hooks

Current state of the AI-assisted tooling in this repo (as of 2026-10-02). Update
this file when any of it changes. The rules these tools enforce live in
[GUARDRAILS.md](GUARDRAILS.md); this doc only maps the tooling.

Two tools are supported: **Claude Code** (`.claude/`) and **OpenCode**
(`.opencode/`). Skills and hooks are Claude Code only.

## Layers

| Layer | Where | Loaded | Purpose |
|---|---|---|---|
| Working agreement | [CLAUDE.md](../CLAUDE.md) | always, every session | tier summary, source-of-truth map |
| Rules | [GUARDRAILS.md](GUARDRAILS.md) | read on demand | tiers, change protocol, PR checklist |
| Skill | `.claude/skills/ed-change-guardrail/` | on trigger | process for classifying a change |
| Hook | `.claude/settings.json` + `tools/guardrail-hook.mjs` | deterministic, on tool use | forces the skill before first protected edit |
| Agents | `.agents/` (source) → `.claude/agents/`, `.opencode/agent/` | when delegated to | rules lookups, design-doc sync, feature delivery |
| Commands | `.claude/commands/` | when typed | `/new-feature`, `/build-feature`, `/release-feature` orchestrators (Claude Code only) |

## Agents

Defined once and generated per tool. `rule-agent` and `design-agent` are
generated for both tools; the `feature-*` agents are Claude-only.

| Agent | Purpose | Claude Code | Can write |
|---|---|---|---|
| `rule-agent` | Answers Earthdawn rules questions (single or batch) only from the local, gitignored `rulebook extracts/`; checks `docs/RULES-FAQ.md` first and logs new answers and owner decisions there | Read, Grep, Glob, Edit; sonnet | `docs/RULES-FAQ.md` only |
| `design-agent` | Compares `plans/*.md`, recent git changes and `docs/REVIEW-FINDINGS.md` with the design docs; reports what shipped and proposes doc edits | Read, Grep, Glob, Bash; opus | nothing (proposes only; owner applies) |

OpenCode copies express the same limits through `permission:` frontmatter
(rule-agent `mode: all`, design-agent `mode: primary`).

Invocation: CLAUDE.md routes rules questions to `rule-agent`. In the feature
workflow it is used at **design time**: `/new-feature` batches every rules
dependency to it before planning (results in `plans/<slug>/rules.md`), and either
orchestrator runs it when a subagent emits `NEEDS_RULES`. It takes a batch plus
caller context, resolves serially, returns a `Status:` per answer (`FAQ-HIT`,
`ANSWERED`, `NOT-COVERED`, `CONFLICT`, `APP-DIFFERS`) and can record an owner
`Decision:` on an FAQ entry. `design-agent` is run by `/build-feature` before
shipping; otherwise manual.

### Feature-delivery agents (Claude Code only)

Driven by the `/new-feature` and `/build-feature` commands, which are the only
intended way to run them. Full flow, signals and folder layout:
[FEATURE-WORKFLOW.md](FEATURE-WORKFLOW.md).

| Agent | Purpose | Writes |
|---|---|---|
| `feature-planner` | tickets to ordered delivery plan; revises against review | `plans/<slug>/plan.md` |
| `feature-plan-reviewer` | per-item plan review incl. guardrail tiers | `plans/<slug>/review.md` |
| `feature-designer` | plan to short tech spec | `plans/<slug>/spec.md` |
| `feature-tester` | tests first; adjudicates one dispute | `*.test.js`, `test-plan.md` |
| `feature-dev` | builds to the tests, never edits them; commits | source, data, docs, commit |

### Single source and sync

Edit `.agents/`, never the generated files:

- `.agents/<name>.md` — description (frontmatter) and shared body. Text that
  differs per tool sits in `{{#claude}}…{{/claude}}` / `{{#opencode}}…{{/opencode}}` blocks.
- `.agents/<name>.claude.yml` — Claude-only frontmatter (`tools`, `model`).
- `.agents/<name>.opencode.yml` — OpenCode-only frontmatter (`mode`, `permission`).
  Omit it to make the agent Claude-only (no OpenCode copy is generated).

Regenerate with `node tools/sync-agents.mjs` (`--check` only reports).
`tools/sync-agents.test.js` runs in `npm test` and fails if a generated file is
stale.

Adding an agent: create the three source files, run the sync, commit source
and generated output together.

## Skill: `ed-change-guardrail`

`.claude/skills/ed-change-guardrail/SKILL.md`. Process only — check whether a
protected surface is touched, classify Tier 1/2/3, act per tier, run the final
re-check. Contains no rules itself; it points at GUARDRAILS.md so there is one
copy to keep true. Triggers on edits to `ui/*`, `engine/*`, character data,
`rules/*.json` or the effect taxonomy.

Because skill triggering depends on model judgment, it is backed by the hook
below.

## Hook: guardrail gate

`PreToolUse` on `Edit|Write|NotebookEdit|Bash`, configured in the committed
`.claude/settings.json`, implemented in `tools/guardrail-hook.mjs`.

- Protected paths: `ui/`, `engine/`, `rules/*.json`, `data/character*.json`
  (covers `data/characters/<id>.json` and `index.json`), `docs/EFFECT-TAXONOMY.md`.
- First protected edit in a session: the hook **denies** and tells Claude to
  load the skill, classify the change, and retry. A marker file in the OS temp
  dir (`ed-guardrail-<session_id>`) records that the gate fired.
- Retry and every later protected edit in that session pass.
- Hook errors never block an edit.
- Tests: `tools/guardrail-hook.test.js`.

Bash coverage is a heuristic: a command trips the gate when it both names a
protected path and looks like a write (`sed -i`, redirection, `tee`, `mv`/`cp`/
`rm`, scripted file writes, `git checkout`/`restore`/`apply`…). Reads never trip
it; a false positive only costs the one per-session prompt.

Limits: it enforces *that the prompt appears*, not that the classification is
correct, and a write the heuristic cannot see (a path assembled at runtime, a
script that edits protected files without naming them) is not caught.

## Settings and permissions

- `.claude/settings.json` — shared, committed: the guardrail hook and a
  permission baseline. `allow`: read-only git, `npm test`, the agent sync, and
  the git `/build-feature` needs (`git add`, `git commit`, `git push origin dev`)
  so a build never stalls on prompts. `ask`: `git merge`/`pull`,
  `gh pr create`/`merge`, `rm -rf`; the shared allow covers a push to `dev` only.
  `deny`: `git add -A`/`.`/`--all`, force-push, pushing to `main`,
  `git reset --hard`, `git clean -f`. Deny and ask outrank a personal allow, so
  a broad allow in `settings.local.json` cannot bypass them.
  `tools/settings.test.js` guards the baseline.
- `.claude/settings.local.json` — per-user, gitignored. Holds each person's
  extra tool allowlist on top of the shared baseline.
- `.claude/launch.json` — preview dev-server config, committed.
- `.gitignore` ignores `.claude/*` and re-includes `skills/`, `agents/`,
  `commands/`, `launch.json` and `settings.json`.

## Related automation (not AI)

- `npm test` — `node --test`, with `pretest` running `tools/check-imports.mjs`.
- `.github/workflows/deploy-pages.yml` — dev → `/dev`, main → root.
- `.github/workflows/fold-custom-items.yml` — folds player-created catalog
  items into `rules/custom-items.json` on dev.

## Memory

Claude Code's per-user auto-memory (outside the repo) holds phase status,
editing patterns, and working preferences such as "never commit or push without
explicit permission". It is not shared with other contributors, so anything
other contributors need belongs in CLAUDE.md or these docs.

## Release workflow

`/release-feature [slug]` (owner-run after testing) finalizes the changelog, opens
the `dev → main` release PR, squash-merges it and syncs `dev`, with one
confirmation and hard stops on a dirty/unsynced tree, red tests or red CI. It has
no subagents; `tools/release.mjs` does the deterministic changelog and plan-status
edits (`tools/release.test.js` guards it). Details:
[FEATURE-WORKFLOW.md](FEATURE-WORKFLOW.md#flow-3--release-feature-slug-release).

## Plan status

Plans carry YAML status frontmatter (draft / approved / building / implemented /
superseded, plus `shipped:`), enforced by `tools/plans-status.test.js`. The
`/build-feature` workflow maintains it; `design-agent` reads it first and
reconciles `shipped: unreleased` against the changelog. Details:
[FEATURE-WORKFLOW.md](FEATURE-WORKFLOW.md#plan-status).

## Tier-2 conformance

`tools/rules-conformance.test.js` (in `npm test`) checks `rules/*.json` against
`docs/EFFECT-TAXONOMY.md`: current-version `effectTaxonomy` refs, well-formed
schema tags, and effect vocabulary parsed from the doc's tables. It is the
mechanical half of the Tier-2 ceremony in [GUARDRAILS.md](GUARDRAILS.md).

## Known gaps

None open. Residual limits are noted under the hook (heuristic Bash coverage, no
check that the tier classification is correct).
