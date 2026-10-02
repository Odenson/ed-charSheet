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
| Agents | `.agents/` (source) → `.claude/agents/`, `.opencode/agent/` | when delegated to | rules lookups, design-doc sync |

## Agents

Two agents, both defined once and generated for each tool.

| Agent | Purpose | Claude Code | Can write |
|---|---|---|---|
| `rule-agent` | Answers Earthdawn rules questions only from the local, gitignored `rulebook extracts/`; checks `docs/RULES-FAQ.md` first and logs new answers there | Read, Grep, Glob, Edit; sonnet | `docs/RULES-FAQ.md` only |
| `design-agent` | Compares `plans/*.md`, recent git changes and `docs/REVIEW-FINDINGS.md` with the design docs; reports what shipped and proposes doc edits | Read, Grep, Glob, Bash; opus | nothing (proposes only; owner applies) |

OpenCode copies express the same limits through `permission:` frontmatter
(rule-agent `mode: all`, design-agent `mode: primary`).

Invocation is manual. CLAUDE.md routes rules questions to `rule-agent`;
nothing triggers `design-agent` automatically.

### Single source and sync

Edit `.agents/`, never the generated files:

- `.agents/<name>.md` — description (frontmatter) and shared body. Text that
  differs per tool sits in `{{#claude}}…{{/claude}}` / `{{#opencode}}…{{/opencode}}` blocks.
- `.agents/<name>.claude.yml` — Claude-only frontmatter (`tools`, `model`).
- `.agents/<name>.opencode.yml` — OpenCode-only frontmatter (`mode`, `permission`).

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

`PreToolUse` on `Edit|Write|NotebookEdit`, configured in the committed
`.claude/settings.json`, implemented in `tools/guardrail-hook.mjs`.

- Protected paths: `ui/`, `engine/`, `rules/*.json`, `data/character*.json`
  (covers `data/characters/<id>.json` and `index.json`), `docs/EFFECT-TAXONOMY.md`.
- First protected edit in a session: the hook **denies** and tells Claude to
  load the skill, classify the change, and retry. A marker file in the OS temp
  dir (`ed-guardrail-<session_id>`) records that the gate fired.
- Retry and every later protected edit in that session pass.
- Hook errors never block an edit.
- Tests: `tools/guardrail-hook.test.js`.

Limits: it enforces *that the prompt appears*, not that the classification is
correct, and it does not see Bash-driven edits (`sed -i`, redirects). It is not
active in a session until Claude Code reloads its settings.

## Settings and permissions

- `.claude/settings.json` — shared, committed (hook only).
- `.claude/settings.local.json` — per-user, gitignored. Holds each person's
  tool allowlist; there is no shared permission baseline.
- `.claude/launch.json` — preview dev-server config, committed.
- `.gitignore` ignores `.claude/*` and re-includes `skills/`, `agents/`,
  `launch.json` and `settings.json`.

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

## Known gaps

- No automatic trigger for `design-agent`; `plans/*.md` carry no status
  frontmatter, so "implemented" must be inferred.
- No agent or script validating Tier 2 taxonomy migrations or `rules/*.json`
  schema conformance.
- No shared permission baseline; the commit/push policy exists only in personal
  memory and `settings.local.json` allows `git commit`/`git push`.
- The hook does not cover Bash-driven edits.
