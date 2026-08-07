# ed-charSheet

A static, GitHub-Pages–hostable **Earthdawn** character sheet — view, edit, and
*run* a character (dice rolling, attribute cascades, talent dice) entirely in the
browser, with no backend.

It starts as a simple stat display and grows into a small rules engine, modelled
on a long-running spreadsheet version of the character that had most of the game
logic already built in.

> **Status:** early development. Data is imported and hand-curated. The read-only
> sheet and exploding-dice roller are live; the rules engine is underway (Phase 3
> — derived characteristics). See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the
> roadmap.

## How it works

The design mirrors what a spreadsheet-based sheet already does, but as clean,
testable layers:

- **Data** — the grouped store `data/characters.json` holds every character's
  *inputs only* (attributes, ranks, resources) as `characters[id]` entries;
  `rules/*.json` holds shared Earthdawn reference data (the Step→Dice
  table, the Characteristics Table, talent mechanics, disciplines, skills, races).
  The store, the legacy `data/character.json` compat copy, and each character's
  portrait live on the `character-data` branch and are read live from it
  (gitignored local working copies serve local dev; see WORKFLOW.md). Modifiers
  live as `effects` arrays on the abilities/items that grant them, in a
  controlled vocabulary (`docs/EFFECT-TAXONOMY.md`).
- **Engine** (pure, framework-free, testable) — derives characteristics from the
  Characteristics Table plus the taxonomy effects, recomputing everything from
  inputs so editing one attribute cascades to all derived values; plus a Step→Dice
  roller with exploding dice. Run the tests with `npm test` (no dependencies).
- **UI** — thin [Lit](https://lit.dev) Web Components; no build step. Lit is
  self-hosted (`vendor/`) and resolved via an import map, so the page stays small,
  features load on demand, and there's **no external runtime dependency** (works
  offline; no CDN outage can blank the app).

Full details and design decisions are in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

## Project structure

```
data/            characters.json (grouped store: every character's inputs) + legacy character.json
rules/           steps, attributes, characteristics, talents, disciplines, skills, races
docs/            EFFECT-TAXONOMY.md (effect vocabulary), UI-GUIDELINES.md (UI/UX contract)
engine/          pure rules engine + *.test.js (derive, characteristics, dice)
ui/              Lit components (added from Phase 1)
vendor/          self-hosted Lit bundle (+ provenance) — no external runtime dep
tools/archive/   import-xlsx.mjs — archived data-bootstrap importer (not run)
ARCHITECTURE.md  architecture and phased delivery plan
CLAUDE.md        working agreement — protected surfaces & change tiers
```

## Development

The app is fully static — **no build and no dependencies to run it**. The JSON in
`data/` and `rules/` is the source of truth and is hand-maintained per
[docs/EFFECT-TAXONOMY.md](docs/EFFECT-TAXONOMY.md).

The data was originally bootstrapped from a spreadsheet by
`tools/archive/import-xlsx.mjs`, which is now **archived** (kept for provenance,
not run — see its header).

### Running locally

The app must be served over **HTTP** — opening `index.html` as a `file://` URL
won't work, because ES modules and `fetch()` of the JSON data are blocked on the
`file://` origin. Serve the project root with any static server; two options:

**Python** (no install needed on macOS/Linux):

```bash
python3 -m http.server 8000
```

**Node** (`npx`, downloads on first use):

```bash
npx http-server . -p 8000
```

Then open <http://localhost:8000> in a browser.

#### Simulating the dev instance locally

Some UI is gated to the **dev** deployment (e.g. the `DEV` pill). The app decides
it is "dev" purely by the **URL path containing `/dev/`** — there is no env var,
hostname, or query flag. Because all asset and `fetch()` paths are relative, you
can reproduce the real `/dev/` instance locally without changing any code:

```bash
ln -s . dev              # one-time: self-referential symlink (add to .gitignore)
python3 -m http.server 8000
```

- <http://localhost:8000/> — production-like (no DEV pill, dev-only UI off)
- <http://localhost:8000/dev/> — dev instance (`isDev` true, dev-only UI on)

Don't hardcode `isDev` or add a `?dev` flag: "the `DEV` pill shows only on the
`/dev/` instance" is a Tier-1 rule in [docs/UI-GUIDELINES.md](docs/UI-GUIDELINES.md).
The symlink faithfully mirrors the deployed `/dev/` URL without touching that logic.

### Stopping the app

If the server is running in the **foreground**, stop it with `Ctrl+C` in that
terminal.

If you started it in the **background** (ran with a trailing `&`), stop it by
port:

```bash
# macOS / Linux — kill whatever is serving port 8000
kill "$(lsof -ti tcp:8000)"
```

Or, if you know how it was launched, match the command:

```bash
pkill -f "http.server 8000"     # the Python server above
pkill -f "http-server"          # the npx/Node server above
```

### Tests

The engine ships pure, dependency-free tests (Node's built-in runner):

```bash
npm test
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
