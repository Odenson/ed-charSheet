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

### Q002 — Talent Option slots, acquiring talents, free/racial talents, and knacks (for the "add talents to Disciplines" feature)
Keywords: talent option slot, one per circle, gain slot, fill slot, lower pool, higher pool, novice journeyman warden master options, discipline talent always available, five first circle, learn new talent, learn later, specific training, deferred choice, training requirements 40 hours, circle training cost, improving talent ranks, eight hours meditation, one rank per day, talent cost table, versatility, human racial talent, rank 0, karma ritual, free talent, entertainer, air sailing, spell matrix, enhanced matrix, racial ability, astral sight windling, speak language read/write language free skill ranks, companion warden master talent options, knack minimum talent rank, knack cost, knack restrictions · Resolved: 2026-08-22

Full extraction for the app's "add talents to Disciplines" feature. Tier/pricing
mechanics live in Q001; this entry covers slots and acquisition paths:

- **Slots**: exactly one Talent Option per Circle, including First Circle
  (option slots total = current Circle). Choice may be deferred at creation;
  reaching a new Circle entitles purchase of the new Discipline Talent plus one
  option available at that Circle.
- **Pools**: keyed to status level; lower pools allowed, higher pools forbidden;
  cost follows the Circle the talent was *learned* at.
- **Discipline Talents**: fixed per Circle, "always available at the indicated
  Circle"; five at First Circle + one each thereafter; they alone set Minimum
  Rank Requirements (options play no role).
- **Learning outside advancement**: no general between-Circles talent-buying
  mechanic exists; only Versatility (tutor required), multi-Discipline
  initiation, and the *optional* Specific Training rule (later option fill =
  find adept who knows it; same time/effort as Versatility). Skills, by
  contrast, are learnable anytime (weeks of training + silver fees).
- **Free/racial**: Free Talents auto-advance with Circle (rank = Circle),
  don't count toward advancement, don't occupy option slots; magicians get two
  free Standard Matrices at First Circle; Karma Ritual is a universal rite
  described in each Discipline header, not a circle-listed talent nor an
  option-slot occupant; humans get Versatility Rank 0 and windlings Astral
  Sight Rank 0 as racial abilities (recorded separately, purchasable as Novice,
  never occupy option slots); Speak Language ×2 / Read/Write Language ×1 free
  starting **skill** ranks (not talents).
- **Companion**: Circles 9–15 descriptions add per-tier Warden/Master Talent
  Options lists before each Circle's entries. Knacks require the associated
  talent at a stated minimum *actual* rank (thread bonuses don't count);
  only Discipline-taught talents qualify (Versatility/racial talents excluded);
  max knacks per talent = unaugmented talent rank; cost = Novice talent of the
  required Rank (PG Talent Cost Table p. 450); training days = Rank
  requirement, ~50 sp/day typical.

Sources:
- text-RB-players-guide.txt:3941–3949 (p. 85 — Discipline Talents vs Talent Options, pools)
- text-RB-players-guide.txt:3273–3276 (p. 68 — First Circle option, deferrable)
- text-RB-players-guide.txt:18268–18280 (p. 454 — new Circle entitlement; Specific Training optional rule)
- text-RB-players-guide.txt:4027–4040 (p. 87 — one option per Circle sidebar)
- text-RB-players-guide.txt:18196–18202 (p. 453 — Minimum Rank Requirements exclude options)
- text-RB-players-guide.txt:18349–18353 (p. 456 — new-Discipline option slots from that Discipline)
- text-RB-players-guide.txt:18057–18135 (pp. 449–450 — improving ranks, conditions, Talent Cost Table)
- text-RB-players-guide.txt:18397–18425 (pp. 457–458 — Equivalent-Tier + option handling across Disciplines)
- text-RB-players-guide.txt:18495–18509 (p. 459 — Versatility relearning on new Discipline)
- text-talents-players.txt:696–699 (p. 177 — Versatility description: surcharge, limits, no Karma)
- text-RB-players-guide.txt:3970–3988 (p. 86 — Free Talents, matrices)
- text-RB-players-guide.txt:3903–3919 (p. 83 — Karma Ritual)
- text-RB-players-guide.txt:3268–3272 (racial abilities recorded separately)
- text-race-players.txt:26 (human Versatility Rank 0), :71 (windling Astral Sight Rank 0)
- text-discipline-players.txt:397–402 (Troubadour First Circle block incl. Entertainer free talent)
- text-RB-companions-guide.txt:393 (Circles 9–15 scope), :777–782 (per-tier options format), :804–829 (example)
- text-RB-companions-guide.txt:2753–2823 (pp. 75–77 — knack learning, minimum rank, cost, requirements/restrictions)
- text-RB-deeper-secrets.txt:22584 (tier band names corroborated)

### Q003 — Anticipate Spell (4E Companion knack): attribute, action, strain, effect, and per-success bonuses
Keywords: Anticipate Spell · Anticipate Blow · Mystic Defense · Spellcasting · knack · Perfect Anticipation · Rank+PER · Strain 2 · Simple action · Resolved: 2026-08-28

**Anticipate Spell is a knack of the Anticipate Blow talent (Earthdawn
Companion, p. 80), not a standalone Player's Guide talent.** Its stat block:
Step Rank+PER (attribute = **Perception**), Action **Simple**, Strain **2**,
Skill Use **No**, Restrictions None, requires Anticipate Blow at **Rank 5**.

Effect (verbatim structure): the adept must have a **higher Initiative result
than their target** and makes the test **against the target's Mystic Defense**.
**Each success adds +2 to the adept's Mystic Defense against that target until
the end of the round** — the Physical-Defense counterpart stays with Anticipate
Blow (PG p. 128, +2 Physical per success). The adept **also gains +2 per
success to the first Attack or Spellcasting test** they make against the
target, who may be the only target of the test. Per-round usage is limited to
**a number of times equal to their Anticipate Blow rank each round** (rank of
the parent talent, not of the knack), and **Anticipate Blow or any associated
knacks may not be used for other purposes that round**.

The dual-defence version (+2 per success to **both** Physical and Mystic
Defense + first Attack or Spellcasting test) is the higher-rank knack **Perfect
Anticipation** (Deeper Secrets p. 204: Anticipate Blow Rank 12 *and* Anticipate
Spell; once per round). So for authoring: Anticipate Spell = +2 Mystic Defense
per success, +2 per success to first Attack/Spellcasting test, usage cap keyed
to Anticipate Blow rank.

Sources:
- text-RB-companions-guide.txt:2947–2960 (p. 80 — Anticipate Spell knack: Talent Anticipate Blow, Req. Rank 5, Step Rank+PER, Action Simple, Strain 2, Skill Use No, full effect)
- text-RB-companions-guide.txt:16827 (p. 80 — index; page-break corroborated at :2973 "81Take the Hit")
- text-RB-players-guide.txt:5467–5484 (p. 128 — Anticipate Blow base talent for contrast: +2 Physical Defense per success, first Attack test only, Rank usage cap)
- text-RB-deeper-secrets.txt:8692–8705 (p. 204 — Perfect Anticipation: Req. Anticipate Blow Rank 12 + Anticipate Spell; +2/success Physical AND Mystic Defense + first Attack or Spellcasting test; once per round)
- rules/knacks.json:133–144 (repo entry — matches book text verbatim)
