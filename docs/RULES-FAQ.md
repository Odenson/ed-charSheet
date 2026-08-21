# Earthdawn Rules FAQ

Answers to rules questions resolved against the local rulebook extracts
(`rulebook extracts/` — gitignored FASA Earthdawn Fourth Edition text).
Maintained by the **rule-agent** (`.opencode/agent/rule-agent.md`); questions
should be delegated there rather than grepping the books ad hoc.

## House rules for this file

- Every entry cites its sources as `file:line` into the extracts (+ printed
  page when visible). Answers are paraphrased; short verbatim quotes appear
  only where exact wording matters.
- **Update, don't duplicate** — extend an existing entry when a new question
  substantially overlaps it; append `(revised YYYY-MM-DD)` to its Resolved
  line.
- "Not covered in the local extracts" is a valid resolution and gets logged
  too, with the files searched.

## Ledger

### Q001 — Where does a talent's Legend-cost tier come from — the talent or the discipline?
Keywords: talent, tier, novice, journeyman, warden, master, circle, legend cost, cost column, additional discipline, versatility, equivalent tier, derive, derived, tierForCircle, costs.tiers, legend.json, learned circle, circle band, character tier, tier details, status level, experience level, circles 1-4, 5-8, 9-12, 13-15, NPC tier, step modifier, skill tier, karma, companion, where do tiers come from · Resolved: 2026-08-21 (revised 2026-08-21)

Tier is not intrinsic to the talent — it follows from the Circle at which the
talent was learned in its discipline placement:

- Discipline Talents are fixed per Circle. Talent Options are chosen from
  pools keyed to status (Novice/Journeyman/Warden/Master), but a slot may be
  filled from a *lower* pool, and "the cost of advancing the talent is based
  on the Circle at which it was learned" (p. 85).
- Bands are universal by Circle: 1–4 Novice, 5–8 Journeyman, 9–12 Warden,
  13–15 Master (Mica example, pp. 457–458).
- A talent known through multiple Disciplines is priced "based on its
  Circle — even if it is available as a Talent Option at a lower tier for a
  new Discipline" (pp. 457–458): no talent-intrinsic tier exists. Additional
  shifts (New-Discipline Rank-1 table, Equivalent-Tier table) apply on top.
- Versatility-learned talents cost one tier higher than normal (Versatility,
  Player's Guide).

Generalization (revised same day, broader question — "where do tier details
come from?"): **tier has no standalone rule system** — it is the name for the
four status bands of Discipline Circles, used wherever the game needs an
experience bracket:

- Bands: Novice = Circles 1–4, Journeyman = 5–8, Warden = 9–12,
  Master = 13–15. Established numerically by the multi-Discipline example
  ("Circle 1–4 talents … bought as if they were Circle 5–8 … Circle 9–12 …
  Circle 13–15", pp. 457–458) and named explicitly in the cost-table narration
  ("Novice Circle (1–4) … Journeyman Circle (5–8) … Warden Circle (9–12) …
  Master Circle (13–15)"). No extract numbers tiers ("First Tier" etc.) or
  gives a one-sentence circle→tier definition; the mapping lives in these
  tables/examples.
- What a tier gates: (a) Talent Option pools keyed to status level — a slot
  may draw from lower-status pools, never higher (p. 85); (b) the Legend cost
  column for talent ranks; skills likewise price by "the tier (Novice,
  Journeyman, etc) listed with the skill description" — skills only have
  Novice/Journeyman columns and cap at Rank 10 (p. 451); (c) Equivalent-Tier
  pricing for talents across multiple Disciplines (pp. 457–458); (d) the
  Versatility one-tier surcharge.
- Karma is NOT tier-gated: Karma bonuses arrive at specific Circles as
  Discipline Abilities ("special uses for Karma", p. 85), not on crossing a
  tier boundary.
- GM side: an NPC's tier is its experience level ("Discipline or Occupation
  and Tier … along with their experience level (Novice, Journeyman, etc.)")
  and sets Step modifiers +1–4 / +5–8 / +9–12 / +13–15 for its primary focus
  (secondary abilities use the next lower tier), with Defense bonuses roughly
  half the Step bonus (GMG p. 141).
- Warden/Master tier play (Circles 9–15) is the Earthdawn Companion's subject:
  it "describes the talent progression of the core fifteen Disciplines from
  Circles nine through fifteen", adds talent knacks and enchanting, and its
  Discipline descriptions list "talent options that become available at each
  new tier" followed by per-Circle talents/bonuses/abilities.
- Thread-item tier (Novice…Legendary) is a separate, item-power concept — not
  character tier.

App note: this repo derives talent tier as the band of the character-stored
learned Circle (`plans/PLAN-TALENT-TIER-DERIVATION.md`); the stored `tier`
string this change removes had drifted from exactly these rules. Concretely:
`rules/legend.json` `costs.tiers` is the only rule definition of the band
ladder, and `tierForCircle(circle, costs)` (`engine/legend-spent.js`) is the
only place tier is computed. Skills keep a stored tier (no circle to derive
from); thread-item `tier` is a separate concept (item power tier).

Sources:
- text-RB-players-guide.txt:3945–3948 (p. 85)
- text-RB-players-guide.txt:18400–18419 (pp. 457–458)
- text-RB-players-guide.txt:7464 (Versatility)
- text-RB-players-guide.txt:18136–18158 (p. 451 — Skill Training Table, tier listed with skill)
- player-tables-narrative.txt:1335–1349 (tier band names on the talent-cost table)
- text-RB-gamemasters-guide.txt:6016–6051 (p. 141 — NPC Discipline/Occupation and Tier, Step modifiers by tier)
- text-RB-companions-guide.txt:390–404, 777–782 (pp. 10, 20–21 — Circles 9–15, per-tier talent options)
