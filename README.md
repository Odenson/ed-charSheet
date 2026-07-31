# ed-charSheet

A static, GitHub-Pages–hostable **Earthdawn** character sheet — view, edit, and
*run* a character (dice rolling, attribute cascades, talent dice) entirely in the
browser, with no backend.

It starts as a simple stat display and grows into a small rules engine, modelled
on a long-running spreadsheet version of the character that had most of the game
logic already built in.

> **Status:** early development. Data is imported and hand-curated; Phase 1
> (read-only sheet) is live. See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the
> roadmap.

## How it works

The design mirrors what a spreadsheet-based sheet already does, but as clean,
testable layers:

- **Data** — `data/character.json` holds *inputs only* (attributes, ranks,
  resources); `rules/*.json` holds shared Earthdawn reference data (the Step→Dice
  table, talent mechanics, disciplines, skills, races).
- **Engine** (pure, framework-free) — an expression evaluator, a
  dependency-graph resolver (so editing one attribute cascades to everything
  derived from it), a Step→Dice roller with exploding dice, and an action
  executor for talents/attacks.
- **UI** — thin [Lit](https://lit.dev) Web Components; no build step (loaded via
  CDN + import maps), so the page stays small and features load on demand.

Full details and design decisions are in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

## Project structure

```
data/            character.json (the character's inputs)
rules/           steps, attributes, talents (mechanics), disciplines, skills, races
docs/            EFFECT-TAXONOMY.md — vocabulary for rule effects
engine/          rules engine (added from Phase 3)
ui/              Lit components (added from Phase 1)
tools/archive/   import-xlsx.mjs — archived data-bootstrap importer (not run)
ARCHITECTURE.md  architecture and phased delivery plan
```

## Development

The app is fully static — **no build and no dependencies to run it**. The JSON in
`data/` and `rules/` is the source of truth and is hand-maintained per
[docs/EFFECT-TAXONOMY.md](docs/EFFECT-TAXONOMY.md).

The data was originally bootstrapped from a spreadsheet by
`tools/archive/import-xlsx.mjs`, which is now **archived** (kept for provenance,
not run — see its header).

Run the app locally by serving the folder, e.g.:

```bash
npx http-server .
```

### Deployment

The app is deployed to GitHub Pages via Actions — `main` to production and `dev`
to a `/dev/` testing instance. See **[WORKFLOW.md](WORKFLOW.md)** for the dev→main
process and one-time Pages setup.

## Data & copyright

This repository contains **only** original character data and *game mechanics*
(names, attribute links, action types, the step/dice table). It deliberately does
**not** include any copyrighted Earthdawn rulebook text.

To use rule descriptions or import from the source spreadsheet, supply your own
files locally — the following are gitignored and never published:

- the source character spreadsheet (`*.xlsx`)
- rulebook text extracts
- `rules/talents.descriptions.json` (talent prose)

Earthdawn is a trademark of FASA Corporation. This is a personal, non-commercial
fan tool and is not affiliated with or endorsed by the rights holders.

## License

Licensed under the **GNU General Public License v3.0** — see [LICENSE](LICENSE).
