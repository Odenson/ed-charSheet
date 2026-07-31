# ed-charSheet

A static, GitHub-Pages–hostable **Earthdawn** character sheet — view, edit, and
*run* a character (dice rolling, attribute cascades, talent dice) entirely in the
browser, with no backend.

It starts as a simple stat display and grows into a small rules engine, modelled
on a long-running spreadsheet version of the character that had most of the game
logic already built in.

> **Status:** early development. Phase 0 (data importer) is complete; the web UI
> is next. See the [roadmap](#roadmap).

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
tools/           import-xlsx.mjs — dev-only importer (spreadsheet -> JSON)
engine/          rules engine (added from Phase 3)
ui/              Lit components (added from Phase 1)
ARCHITECTURE.md  architecture and phased delivery plan
```

## Development

The web app itself is static — no build required to run it. The only tooling is
the **importer**, a one-off script that regenerates the JSON data from the source
spreadsheet.

```bash
npm install          # installs the importer's dev dependency (SheetJS)
npm run import       # reads the local .xlsx -> data/character.json + rules/*.json
```

Running the app locally (once the UI lands) is just serving the folder, e.g.:

```bash
npx http-server .
```

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
