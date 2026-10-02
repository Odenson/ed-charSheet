# EDCharSheet — Working Agreement

A static, GitHub-Pages web app for viewing and *running* an Earthdawn character.
Architecture, data model, and delivery phases live in
[ARCHITECTURE.md](ARCHITECTURE.md) — read it before any non-trivial change.

The app's current UI/UX and its engine/taxonomy/schema decisions are considered
**load-bearing**. The point of this file is simple: future changes extend the
system, they do not quietly re-decide it. This applies to AI-assisted sessions
and human contributors alike.

---

## Protected surfaces — three tiers

The rules live in **[docs/GUARDRAILS.md](docs/GUARDRAILS.md)** — read it before
editing the UI, character data, `rules/*.json`, `engine/*`, or the taxonomy.
In short:

- 🔒 **Tier 1 — Locked.** UI/UX contract (UI-GUIDELINES), data-down/dispatch-up
  with a pure DOM-free engine, "store only inputs", schema shapes and version
  tags. Do not change without explicit owner sign-off: **stop and ask**, quote
  the rule, say why the task appears to need it.
- 🔄 **Tier 2 — Ceremony.** Effect-taxonomy vocabulary changes: bump the doc
  version, migrate every `rules/*.json`, update schema/`effectTaxonomy` refs —
  all together or none.
- ✅ **Tier 3 — Free.** New data that fits the schema/taxonomy, new tab content
  or views, in-guideline styling, bug fixes restoring documented behavior.

Classify every change against the tiers first (AI sessions: the
**ed-change-guardrail** skill; a PreToolUse hook asks for it on the first
protected edit). The PR checklist is in GUARDRAILS.md.

**Git.** Never commit or push without the owner's explicit permission, and never
`git add -A`. The one exception is the `/build-feature` workflow, which may
commit, push to `dev` and open (never merge) the `dev → main` PR for the feature
it is building ([docs/FEATURE-WORKFLOW.md](docs/FEATURE-WORKFLOW.md)).

---

## Source-of-truth map

| Concern | Authority |
|---|---|
| Architecture, layers, phases | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Protected surfaces, tiers, change protocol, PR checklist | [docs/GUARDRAILS.md](docs/GUARDRAILS.md) |
| AI tooling map: agents, skill, hook, sync | [docs/AI-WORKFLOWS.md](docs/AI-WORKFLOWS.md) |
| New-feature planning and build flow (`/new-feature`, `/build-feature`) | [docs/FEATURE-WORKFLOW.md](docs/FEATURE-WORKFLOW.md) |
| UI/UX rules | [docs/UI-GUIDELINES.md](docs/UI-GUIDELINES.md) |
| Standard modal implementation (focus contract, Escape/focus handling) | [docs/MODALS.md](docs/MODALS.md) — shared `ui/modal-controller.js` |
| Effect vocabulary / schema of `effects` | [docs/EFFECT-TAXONOMY.md](docs/EFFECT-TAXONOMY.md) |
| Thread-item data model, engine fold, pricing | [docs/THREAD-ITEMS.md](docs/THREAD-ITEMS.md) |
| Homebrew rules format, term/ref grammar, authoring | [docs/HOMEBREW-RULES.md](docs/HOMEBREW-RULES.md) |
| Dev → prod deploy, relative-path rule | [WORKFLOW.md](WORKFLOW.md) |
| Serverless save feature design | [docs/GITHUB-SERVERLESS-SAVE.md](docs/GITHUB-SERVERLESS-SAVE.md) |
| Earthdawn rules questions | the **rule-agent** (`.claude/agents/rule-agent.md`; OpenCode copy in `.opencode/agent/`) — answers only from the local `rulebook extracts/`, ledger in [docs/RULES-FAQ.md](docs/RULES-FAQ.md). Delegate rules questions there instead of grepping the books ad hoc; the feature workflow settles rules at design time ([docs/FEATURE-WORKFLOW.md](docs/FEATURE-WORKFLOW.md)). |

If code and a doc disagree, that is a bug in one of them — resolve it explicitly,
don't just follow the code.
