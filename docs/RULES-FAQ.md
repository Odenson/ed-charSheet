# Earthdawn Rules FAQ

Answers to rules questions resolved against the local rulebook extracts
(`rulebook extracts/` — gitignored FASA Earthdawn Fourth Edition text).
Maintained by the **rule-agent** (`.claude/agents/rule-agent.md`; OpenCode copy in `.opencode/agent/`); questions
should be delegated there rather than grepping the books ad hoc.

## House rules for this file

- Every entry cites its sources as `file:line` into the extracts (+ printed
  page when visible). Answers are paraphrased; short verbatim quotes appear
  only where exact wording matters.
- **Update, don't duplicate** — extend an existing entry when a new question
  substantially overlaps it; append `(revised YYYY-MM-DD)` to its Resolved
  line.
- Entries carry a `Context:` (the feature slug or `ad hoc`) and, where the
  owner ruled on a gap or conflict, a `Decision:` line kept separate from the
  book-derived answer. Format: `.agents/rule-agent.md`.
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

### Q004 — Which talents govern the magic "Weaving" knacks? (catalog parent-name normalisation)
Keywords: knack, parent, governing talent, thread weaving, thread smithing, nethermancy, elementalism, thief weaving, scout weaving, magic knack, craft poison, create orichalcum, detect spirit, detect true element, handle elements, harvest true element, design enchanting pattern, talent only · Resolved: 2026-08-30

Ruling for the "add a knack" feature's catalog normalisation
(PLAN-ADD-KNACKS §7.1a): five knack parent names in `rules/knacks.json` are
colloquial shorthand rather than catalog talent keys. All five resolve to an
existing `Thread Weaving (<Discipline>)` talent, and that is the canonical
governing talent — **not Spellcasting**:

- `Thief Weaving` → **`Thread Weaving (Thief)`**
- `Scout Weaving` → **`Thread Weaving (Scout)`**
- `Thread Smithing` → **`Thread Weaving (Weaponsmith)`**
- `Nethermancy` → **`Thread Weaving (Nethermancer)`** (not Spellcasting)
- `Elementalism` → **`Thread Weaving (Elementalist)`** (not Spellcasting)

The `X Weaving` naming convention makes Thread Weaving high-confidence, and the
owner confirmed it (2026-08-30) over Spellcasting — the magician disciplines'
weaving talents are Thread Weaving. Only Discipline-taught talents qualify as a
knack parent (Q002); owning only the same-named skill never does. The rename is
applied in `rules/knacks.json`; a guard test asserts no parent name is orphaned.

Sources:
- rules/knacks.json (renamed parent keys — owner sign-off 2026-08-30)
- rules/talents.json (all five `Thread Weaving (…)` target keys exist)
- Owner answer, 2026-08-30: Thread Weaving correct, keep data.

### Q005 — Are knack restrictions enforced, or GM-adjudicated? (structured `restrictions`, ed-knacks/2)
Keywords: knack, restriction, discipline, circle, spellcasting, nethermancer, elementalist, wizard, illusionist, weaponsmith, attribute, race, ability, ed-knacks/2, RESTRICTION-TAXONOMY · Resolved: 2026-08-31

Ruling for the knack restrictions reform (PLAN-KNACK-RESTRICTIONS): the `restrictions`
field on every knack in `rules/knacks.json` is now a **structured object**
(schema bumped to `ed-knacks/2`; vocabulary defined in `docs/RESTRICTION-TAXONOMY.md`
v1), not a free-text string. The engine enforces the **`discipline`** type; the other
types (`attribute`, `race`, `ability`, `note`) are structured for future enforcement
and currently render as "GM adjudicates".

Enforced today:
- A `discipline` restriction is an OR-list of `{name, circle?}` entries (a bare
  `name` string is shorthand). A knack is learnable iff the character's own
  discipline-name set intersects an entry **and**, when that entry carries a
  `circle`, the character's discipline is at that circle or higher. A character
  therefore only sees Spellcasting knacks belonging to their own magician
  disciplines (e.g. a Nethermancer sees Nethermancer Spellcasting knacks, never
  Elementalist/Wizard/Illusionist ones).

Not enforced (GM adjudicates):
- `attributes` (e.g. `Strength of Bronze` → `{attribute:{name:"Strength",value:14}, race:["Dwarf"]}`),
  `race`, `ability` (e.g. `Tail Weapon` → `{ability:[{name:"Tail Combat"}]}`), and a
  `note` fallback (e.g. `"Any Discipline"`).

Two restriction types on the same knack combine with AND; the `discipline` entries
are an OR-list. An empty object `{}` means no restriction.

Sources:
- docs/RESTRICTION-TAXONOMY.md (v1) — the vocabulary contract
- rules/knacks.json (`restrictionTaxonomy: "docs/RESTRICTION-TAXONOMY.md (v1)"`)
- engine/knack-options.js (`learnableKnacks` discipline gate)
- Owner answers, 2026-08-31: fully structure all 16 compounds; new taxonomy doc; bump to ed-knacks/2.

### Q006 — Command Nightflyer talent: step, action, strain, skill use, attribute, target, duration, command count, limitations
Keywords: Command Nightflyer · nightflyer owl bat krilworm nocturnal flying command conversation · Resolved: 2026-08-31

Command Nightflyer (Nethermancer novice talent option) is confirmed as follows
from the Players Guide. **Step:** Rank + WIL. **Action:** Sustained. **Strain:** 1.
**Skill Use:** No. **Attribute:** Willpower (WIL). **Test target:** the creature's
**Mystic Defense**. A successful test lets the adept converse with the nocturnal,
flying creature (owls, bats, krilworms) in its "tongue" for **Rank minutes**; the
adept may also give it **simple commands equal to the number of successes** scored,
which are obeyed during that time (and commands continue to be obeyed after the
talent ends, though reusing the talent is required if the action's result needs
another conversation). **Limitations:** the creature's survival instincts cannot be
overridden, nor can it be ordered to behave against its basic nature (e.g. "a bat
could not be forced to scout around during daylight hours when it would normally be
resting"). Both `text-talents-players.txt` and `text-RB-players-guide.txt` give
identical wording. Note: the guide's index places the talent on printed **p. 135**.

Sources:
- rulebook extracts/text-talents-players.txt:161-164
- rulebook extracts/text-RB-players-guide.txt:5770-5782 (p. 135 per index at text-RB-players-guide.txt:20064)
- rulebook extracts/text-discipline-players.txt:222 (novice Nethermancer talent option)

### Q007 — Advancing through Discipline Circles: when, requirements, cost, and Legend Points
Keywords: discipline circle advancement, advance to next circle, higher circle, minimum rank requirement, discipline talents rank, talent options no role, initiate, tutor, master, train 40 hours, three-week period, circle training cost table, silver pieces, paying trainer, learn new discipline, reaching next circle, purchase discipline talent one option, personal legend, defeat a horror, current legend points, total legend points, spend legend points, circle-based attribute improvement · Resolved: 2026-08-31

A character advances to the next Circle of a Discipline in exactly one way: reach
the minimum ability requirement of the current Circle, then be trained/initiated
by a higher-Circle member of the same Discipline (PG p. 452, "Advancing
Discipline Circles"). Two conditions must be met to be eligible (p. 452):
(1) the adept must have raised **all of his Discipline Talents to a rank equal
to the Circle he wants to attain** — e.g. to train for Fifth Circle he must know
all First–Fourth Circle Discipline Talents at minimum Rank 5, and **Talent
Options are not used and play no role** in advancement; and (2) he must train
with a higher-Circle member of his Discipline. (Optional rule "Using All Talents
To Advance," p. 453: instead, know N talents at a minimum rank with one from the
current Circle, per the Optional Advancement Table.)

Training: the character seeks out a higher-Circle member of the same Discipline,
negotiates payment, and trains **40 hours within a three-week period**; if not
completed in that window he loses the benefits and starts over (may need to
re-pay or find a new teacher) (p. 454). The **Circle Training Cost Table** gives
typical trainer fees **in silver pieces** (Circle 2 → 200 sp up to Circle 15 →
20,000 sp), negotiable by the GM (pp. 454–455). The trainer must be of a **higher
Circle than the student** (p. 81).

Reaching the new Circle (p. 454): the character advances after meeting the rank
requirement and completing training; this entitles him to **purchase the new
Circle's Discipline Talent and one of its Talent Options**, and he gains any
characteristic/Discipline Ability improvements. On advancing, the adept also
gains automatic bonuses to some Discipline-listed abilities (p. 86), which "come
with the character's Circle—he does not need to spend Legend Points to advance"
them (p. 86).

**Legend Points and advancement**: there is **no Legend Point cost for the Circle
advancement itself** — the cost is the trainer's silver fee and the LP you spend
*separately* to buy the new talent ranks. LP are deducted only from the **Current
Legend Points** tally; **Total Legend Points** never decrease and feed Legendary
Status (pp. 446–447). Buying the new talent's Rank 1 (and raising other talent
ranks) is normal talent purchasing: full LP cost from the Talent Cost Table,
8 hours meditation per rank, one rank per day, sufficient Current LP (p. 449).
Spending LP to raise talent ranks is what *eventually* qualifies an adept to
advance (p. 53). Optional rule "Circle-Based Attribute Improvement" (pp. 448–449):
tie one Attribute +1 per new Circle either free (no LP) or paid (normal LP, one
per Circle, cannot carry over) — independent of the rank/training requirement.
Thread-rank bonuses to talents do **not** count toward the advancement rank
requirement (p. 231).

**Not covered in the local extracts**: no extract requires "defeating a Horror,"
an "achieving personal legend," or a formal in-game declaration/GM approval of
advancement beyond the two conditions + training above. Those notions do not
appear in the Player's Guide, GM's Guide, or Companion extracts as Circle-
advancement requirements. (The GM Guide does note lower-Circle characters advance
more quickly; p. 109.)

Sources:
- text-RB-players-guide.txt:18183–18202 (p. 452 — one way to advance; two conditions; minimum Discipline Talent rank; options no role)
- text-RB-players-guide.txt:18204–18241 (p. 453 — Optional Rule "Using All Talents To Advance" + table; Legend Award guidance for Circles 11+)
- text-RB-players-guide.txt:18242–18267 (p. 454 — Training Requirements: 40 hours in 3 weeks, restart on lapse, fee negotiation)
- text-RB-players-guide.txt:18268–18280 (p. 454 — Reaching The Next Circle; entitlements; Specific Training optional rule)
- text-RB-players-guide.txt:18281–18299 (pp. 454–455 — Circle Training Cost Table, silver-piece fees)
- text-RB-players-guide.txt:3792–3807 (p. 81 — Training for Circle Advancement; trainer must be higher Circle)
- text-RB-players-guide.txt:3966–3972, 4013–4035 (p. 86 — Circle-granted ability/Defense bonuses; free from LP spending)
- text-RB-players-guide.txt:17932–17950, 17972–17982 (pp. 446–447 — Current vs Total Legend Points; spending)
- text-RB-players-guide.txt:18036–18078 (p. 449 — Improving Talent Ranks: LP cost, meditation, conditions)
- text-RB-players-guide.txt:18042–18056 (pp. 448–449 — Circle-Based Attribute Improvement optional rule)
- text-RB-players-guide.txt:9631–9636 (p. 231 — thread-rank bonuses do not count toward Circle advancement)
- text-RB-players-guide.txt:2086–2091 (p. 53 — spending LP on ranks allows Circle advancement)
- text-RB-gamemasters-guide.txt:4918–4921 (p. 109 — lower-Circle characters advance more quickly)

### Q008 — Arrow of Night: full spell mechanics (circle, step, damage bonus, Mystic Armor penalty, strain, duration, threading)

Keywords: Arrow of Night, nethermancer, third circle, missile damage, mystic armor penalty, strain, spellcasting test, weaving, darkness arrow, black missile, quiver of night, quiver of black missiles · Resolved: 2026-09-01

Arrow of Night is a **Nethermancer** spell, **not** an Elementalist spell. It is a
Third Circle spell that enchants a physical missile (arrow, crossbow bolt, sling
stone, or blowpipe dart) with a sheath of astral darkness. The missile must be
fired within one round of casting or the enchantment is lost.

**Core mechanics:**

| Field | Value |
|---|---|
| Circle | Third |
| Caster | Nethermancer only |
| Threads required | 0 |
| Weaving Difficulty | 7 / 12 |
| Casting Step | 6 (Spellcasting test) |
| Range | Touch (the caster touches the arrowhead) |
| Duration | 2 rounds |
| Effect | +6 bonus to the missile's Damage test; target suffers −2 penalty to Mystic Armor until the end of the next round (only if the target takes damage from the spell) |
| Strain | 1 (paid by the character who fires the enchanted missile) |

**How it works in play:** The caster wraps their hand around the arrowhead and
makes a Spellcasting (6) test. On success, darkness wraps the arrow, granting +6
to the missile's Damage test. If the target is damaged, they suffer a −2 penalty
to Mystic Armor until the end of the next round. The arrow is consumed — it
crumbles to dust the round after it strikes.

**Success levels:** Increase Duration (+2 rounds per success level).

**Extra threads** (for Thread Weaving, even though base threads = 0):
- Increase Effect (+2 Damage bonus)
- Increase Effect (−2 additional Mystic Armor penalty)
- Additional Target (+Rank number of additional missiles/targets)

**Spell Knacks (Deeper Secrets):**
- **Black Missile** (Circle 3 knack): When casting Arrow of Night, places glyph on
  the missile; target suffers −4 Mystic Armor (instead of −2) until end of next
  round. Requires Patterncraft rank 5, Nethermancer Circle 5, 1 Strain.
- **Quiver of Night** (Circle 3 knack): Enchants Patterncraft rank missiles at
  once (batch enchantment). Requires Patterncraft rank 5, Nethermancer Circle 5, 2 Strain.
- **Quiver of Black Missiles** (Circle 3 knack): Combines both — batch-enchants
  Patterncraft rank missiles with glyph; target suffers −4 Mystic Armor. Requires
  Patterncraft rank 8, both Black Missile and Quiver of Night knacks, Nethermancer
  Circle 8, 3 Strain.

**Flagging user note against source:**
- "Conjures a missile/arrow" — **not supported.** The spell does *not* conjure a
  projectile. It enchants an existing physical missile that the caster already has.
  The caster must provide their own arrow, bolt, stone, or dart.
- "−2 to Mystic Armor for 1 round" — **partially confirmed, partially corrected.**
  The source says the penalty lasts "until the end of the next round" (not simply
  "1 round"). In Earthdawn round counting this is functionally equivalent in most
  cases, but the phrasing is "until the end of the next round," which is the
  canonical wording for the app's effect description.
- "Damage bonus from higher circle" — the base spell gives +6 to the missile Damage
  test. Extra threads increase this by +2 per thread spent. There is no automatic
  per-circle scaling; the bonus is fixed at +6 unless extra threads are woven.

Sources:
- text-spell-players.txt:2838–2861 (p. 324–325 — full spell stat block and description)
- text-player-guide-nethermancer-spells.txt:326–345 (p. 324–326 — same text, chapter slice)
- text-spell-table-all.txt:342 (one-line spell summary table)
- text-RB-deeper-secrets.txt:16539–16564 (pp. 403–404 — Black Missile, Quiver of Night, Quiver of Black Missiles spell knacks)
- narative_spells_by_circle.txt:405 (Arrow of Night listed as Third Circle Nethermancer spell)

### Q009 — Bonus to a Damage test: Step modifier or flat result add?
Keywords: bonus to a test, Damage test bonus, step modifier, flat add, Aggressive Attack, Arrow of Night, +6 bonus, +2 bonus damage, test result modifier · Resolved: 2026-09-01

**General rule:** The Player's Guide states: "Test results may be modified by a bonus or a penalty, indicated in the rules where appropriate. As a general rule, the modifier is applied to the Step number of the test before the dice are rolled." (p. 34, lines 1952–1954). The book immediately follows this with an explicit example: "a character using the Aggressive Attack combat option adds +3 to his Attack and Damage Steps—increasing a Step 10 (2D8) to a Step 13 (D10+D12)." (p. 34, lines 1955–1957). This establishes that the default meaning of "bonus to a test" is a Step modifier.

**Critical Hits confirm the pattern:** The Critical Hits sidebar (p. 378, lines 15273–15276) states that extra successes on attack tests "add +2 bonus damage," and the worked example clarifies: "each extra success adds +2 damage, so Silar's crossbow goes from Step 10 to Step 14 damage." Here "+2 damage" unambiguously means +2 to the Damage Step. Similarly, the Success Levels example (p. 34, lines 1998–2001) says "each extra success adds +2 Steps to her Damage test."

**Application to Arrow of Night:** Arrow of Night's base effect is "+6 bonus to a missile's Damage test" (p. 325, line 13300). Its Extra Thread says "Increase Effect (+2 Damage)" (p. 326, line 13307). Under the general rule, the +6 should be applied to the missile's Damage Step (Strength Step + weapon Damage Step) before dice are rolled.

**However, there is an ambiguity.** Several other spells explicitly say "Increase Effect (+X Damage Step)" when they mean a Step modifier (e.g., Winter Touch at p. 310, line 13234; Bramble Wall at p. 294, line 11933; Earth Staff "Increase Weapon Damage (+2 Steps)" at p. 288, line 11666). Arrow of Night's "+2 Damage" and Astral Weapon's "+2 Damage" (p. 338, line 13892) omit the word "Step," while Iron Hand's "+3 bonus to close combat Damage tests" (p. 345, line 14022) and Rampage's "+3 bonus to close combat Attack and Damage tests" (p. 357, line 14525) use the same phrasing as Arrow of Night. The books do not resolve whether the omission of "Step" is intentional (indicating a flat result add) or merely informal shorthand (with the general rule still applying).

**Best-supported interpretation:** Arrow of Night's +6 (and the Extra Thread's +2) modify the missile's Damage Step, not the rolled result. The general rule at p. 34 is explicit, the Critical Hit and Success Level examples consistently treat "+X damage" as Step modifiers, and the Aggressive Attack description uses the same "bonus to Damage tests" phrasing that Arrow of Night uses. The absence of "Step" in some extra-thread lines is more likely informal than dispositive. **This is flagged as an area where the books are internally inconsistent in their phrasing, and a definitive answer requires a ruling.**

**Mystic Armor penalty wording (from Q008, confirmed):** "If the target suffers damage from the spell, they suffer a -2 penalty to their Mystic Armor until the end of the next round." (p. 326, lines 13301–13302). Conditional on taking damage; duration is "until the end of the next round," not "1 round."

Sources:
- text-RB-players-guide.txt:1952–1958 (p. 34 — general rule: "modifier is applied to the Step number" + Aggressive Attack example)
- text-RB-players-guide.txt:1996–2001 (p. 34 — Success Levels example: "+2 Steps to her Damage test")
- text-RB-players-guide.txt:15270–15276 (p. 378 — Critical Hits: "+2 bonus damage" → Step 10 → Step 14)
- text-RB-players-guide.txt:15449–15458 (p. 382 — Aggressive Attack: "+3 bonus to close combat Attack and Damage tests")
- text-RB-players-guide.txt:13295–13308 (pp. 325–326 — Arrow of Night: "+6 bonus to a missile's Damage test"; Extra Thread "+2 Damage")
- text-RB-players-guide.txt:14018–14029 (p. 345 — Iron Hand: "+3 bonus to close combat Damage tests")
- text-RB-players-guide.txt:13234 (p. 310 — Winter Touch Extra Thread: "Increase Effect (+2 Damage Step)" — explicit Step wording)
- text-RB-players-guide.txt:11933 (p. 294 — Bramble Wall Extra Thread: "Increase Effect (+2 Damage Steps)" — explicit Steps wording)
- text-RB-players-guide.txt:11666 (p. 288 — Earth Staff Extra Thread: "Increase Weapon Damage (+2 Steps)" — explicit Steps wording)
- text-RB-players-guide.txt:13892 (p. 338 — Astral Weapon Extra Thread: "Increase Effect (+2 Damage)" — no Step)
- text-RB-companions-guide.txt:7968 (p. 214 — Lightning Mace Thread Rank Six: "+6 bonus to a Damage test")

### Q010 — Wounds: rules on inflicting, tracking, penalties on actions, recovery, and death
Keywords: wounds, wound threshold, wound penalty, cumulative, –1 per wound, recovery test, damage, blood wound, knockdown, unconsciousness, death rating, physician, treat wound, healing wound, single attack, armor, impairs, actions, tests, bloodied, badly wounded, critically wounded, wound levels, wound stacking, track wounds, recovery reduction · Resolved: 2026-09-02

**What is a Wound?**
A Wound is triggered when a *single attack* deals damage equal to or exceeding the character's Wound Threshold. It is not cumulative damage across attacks — only a single hit matters. ("Any single attack that inflicts a number of Damage Points at least equal to a character's Wound Threshold also inflicts a Wound." — p. 65)

**Wounds reduce recovery.**
"When a character makes a Recovery test, the test result is reduced by the number of Wounds he has. Regardless of modifiers, the minimum damage a character recovers from a Recovery test is 1." (p. 381)

**Wound Penalties on all tests (cumulative –1 per Wound).**
"For each Wound, a character suffers a cumulative –1 penalty to all tests. For example, if a character has 2 Wounds, he suffers a –2 penalty; if he has 4 Wounds, he suffers a –4 penalty. This penalty does not apply to Recovery tests — those are already affected as described above." (p. 381)

**Knockdown from Wounds.**
If the damage that causes the Wound exceeds the Wound Threshold by 5 or more, the character must make a Knockdown (Strength) test against DN equal to the excess. Failure = knocked down. (p. 380)

**No named wound levels in 4E.**
Earthdawn 4th Edition does not use named wound levels (bloodied / badly wounded / critically wounded / dead). It is a flat cumulative –1 per Wound, with no breakpoints or tiered effects. Death is checked against the Death Rating, not the number of Wounds.

**Healing Wounds.**
One Wound heals per day, under two conditions: (1) the character has zero Current Damage (including Strain, but not Blood Magic damage), and (2) the character uses a Recovery test after a full night's rest. (p. 382)

**Treatment (Physician skill).**
A physician can treat individual Wounds by spending time (half an hour per wound). Successful treatment does not heal the Wound, but removes its penalty to Recovery tests, thereby speeding recovery. (p. 253)

**Blood Wounds.**
Blood Wounds "are otherwise treated as normal Wounds, affecting the character's Action tests and ability to heal damage" (p. 240). They cannot be healed normally — they require special methods (healing potion with a Recovery test, year-and-a-day duration, etc.).

**Stacking with damage?**
Wounds and Damage Points are separate tracked quantities. Wounds do not "stack with" Damage — they are a *consequence* of Damage (single-attack ≥ Wound Threshold). Damage itself causes no direct penalties until it reaches the Unconsciousness Rating. Wounds then impose their cumulative –1 penalty and recovery reduction independently.

Sources:
- (line refs corrected 2026-11-15; earlier ones were stale; file is rulebook extracts/rulebook extracts/text-RB-players-guide.txt) see also Q031
- text-RB-players-guide.txt:2061–2063 (p. 65 — Wound Threshold definition)
- text-RB-players-guide.txt:14339–14348 (p. 381 — Wounds: recovery reduction)
- text-RB-players-guide.txt:14349–14354 (p. 381 — Wound Penalties: cumulative –1 per Wound)
- text-RB-players-guide.txt:14265–14273 (p. 379/380 — Step 5: Check For Wounds)
- text-RB-players-guide.txt:14274–14286 (p. 380 — Step 6: Knockdown)
- text-RB-players-guide.txt:14355–14364 (p. 382 — Healing Wounds)
- text-RB-players-guide.txt:14290–14307 (p. 380 — Unconsciousness and Death)
- text-RB-players-guide.txt:8336–8351 (p. 253 — Physician: treating Wounds)
- text-RB-players-guide.txt:9964–9975 (p. 240 — Blood Wounds treated as normal Wounds)

### Q011 — Spellcasting test difficulty when casting on another target (Mystic Defense or fixed?)
Keywords: Casting Difficulty, Spellcasting test, target number, Mystic Defense, TMD, fixed difficulty, multiple targets, highest Mystic Defense, cover, disbelieve, dull-witted MD 2 · Resolved: 2026-10-02 · Context: spell-target-effect-outcome

Spellcasting is a test against the spell's **Casting Difficulty**, "often" the target's Mystic Defense (abbreviated TMD) but sometimes a fixed value or another calculation; each spell's Casting line says which. Dull-witted creatures and most non-magical objects have MD 2; most living creatures base MD on Perception; magic items vary. Multiple-target spells use the highest Mystic Defense of all targets (designated when the test is made) unless the spell says otherwise. Targets get Cover bonuses to MD. A target who disbelieves a non-illusion has MD 2 for counting successes. Lowest Difficulty Number is always 2.

Sources:
- manual/text-player-guide-spell-concepts.txt:46–51 (p. 248)
- manual/text-player-guide-spell-concepts.txt:416–431 (p. 257)
- manual/text-player-guide-spell-concepts.txt:899–902 (p. 268 — Casting line: TMD, fixed, or other)
- manual/text-player-guide-spell-concepts.txt:326–327 (p. 254 — Cover)
- manual/text-player-guide-spell-concepts.txt:852–855 (p. 267 — disbelieving non-illusion)
- manual/text-player-guide-game-concepts.txt:88–89 (p. 33 — min DN 2)

### Q012 — Success levels / extra successes on a Spellcasting test
Keywords: success level, extra success, five points over, additional successes, Success Levels line, Increase Duration · Resolved: 2026-10-02 · Context: spell-target-effect-outcome

Equalling the Difficulty Number is one success; each full 5 points the result exceeds it adds one extra success. Each spell's "Success Levels" line gives what each extra success buys (extra Effect Steps, longer duration, more targets...), applied per extra success (e.g. "+2 Rounds" with two extras = +4 Rounds).

Sources:
- manual/text-player-guide-game-concepts.txt:107–115 (p. 34)
- manual/text-player-guide-spell-concepts.txt:977–983 (p. 270)
- manual/text-player-guide-spell-concepts.txt:432–436 (p. 257)

### Q013 — What a failed Spellcasting test does (effect, threads, Karma)
Keywords: spell fails, failed cast, threads lost, Karma, Spellcasting failure, matrix · Resolved: 2026-10-02 · Context: spell-target-effect-outcome

Result below the Difficulty Number = "the spell fails"; effect is only determined after a successful cast. **Not covered:** the extracts do not say what happens to woven threads or the matrix on a failed cast, nor give a Spellcasting-specific Karma rule (the talent entry lists Strain 0 and no Karma line; the general Karma rule is "unless noted otherwise, +1 Karma die per Karma Point on a talent"). The only thread-loss rule: woven threads are lost if weaving breaks off for a round or more, or the spell is not cast in the round after weaving completes. Failed Thread Weaving tests only waste time. Needs an owner decision.

Sources:
- manual/text-player-guide-spell-concepts.txt:433–436 (p. 257)
- manual/text-player-guide-spell-concepts.txt:135–141 (p. 250)
- text-talents-players.txt:551–554 (Spellcasting talent)
- manual/text-player-guide-game-concepts.txt:269–273 (Karma)
- Searched: manual/text-player-guide-spell-concepts.txt, text-talents-players.txt, manual/text-player-guide-game-concepts.txt

Decision: 2026-10-02 — Owner ruling: a missed cast on another target reports "Miss vs <target number> — no effect" and the outcome text makes no claim about woven threads or Karma; existing app thread behavior is unchanged and out of scope for the spell-target-effect-outcome feature. (house rule)

### Q014 — Spell Effect test vs the target; armor/resistance
Keywords: Effect test, Effect Step, WIL+5, Willforce, damage Step, Physical Armor, Mystic Armor, resisted by · Resolved: 2026-10-02 · Context: spell-target-effect-outcome

After a successful cast, rolled-effect spells call for an Effect test, usually caster's Willpower Step plus the stated bonus (some use the target's Willpower; Willforce may substitute, chosen per Effect test). Damage spells often use the Effect Step as the Damage Step, and the Effect line names the armor that resists it, Physical or Mystic; so the target subtracts that armor type from the damage. Fixed-effect spells list their specifics instead. Non-damage Effect-test spells: their description defines what the result means (not generalised in the extracts). Disbelieved illusions have no effect; a non-illusion target who opens themselves up loses active defenses.

Sources:
- manual/text-player-guide-spell-concepts.txt:437–446 (p. 257)
- manual/text-player-guide-spell-concepts.txt:930–937 (p. 269)
- text-talents-players.txt:721–724 (Willforce)
- manual/text-player-guide-spell-concepts.txt:848–855 (p. 267)

### Q015 — Spell Duration: units, and self vs other target
Keywords: duration, rounds, minutes, hours, Rank+, variable duration, combat spell, self range, touch · Resolved: 2026-10-02 · Context: spell-target-effect-outcome

Duration is how long the effect lasts: rounds, minutes, hours or other increments; "Rank" means the casting magician's Spellcasting rank (Rank+10 minutes at rank 5 = 15 min). Most combat spells last less than a round (end once they affect the target). Variable durations are rolled with the listed Action Dice. Success levels may extend it. The extracts give no separate rule for self vs other targets; duration is stated per spell and measured the same way (Range "self" merely restricts targets to the caster).

Sources:
- manual/text-player-guide-spell-concepts.txt:447–454 (p. 257)
- manual/text-player-guide-spell-concepts.txt:924–929 (p. 269)
- manual/text-player-guide-spell-concepts.txt:903–907 (p. 268 — Range self/touch)

### Q016 — Extra (Additional) Threads: stacking, combining options, cap, "Rank" modifiers, and combining with Success Levels
Keywords: extra threads, additional threads, additional thread limit table, stacking, same effect, different effects, Rank modifier, success levels together, enhanced matrix, Versatility · Resolved: 2026-10-02 · Context: spell-extra-weave-and-extra-cast

Extra threads are declared up front, not earned: the caster decides whether to weave additional threads, how many, and what each does BEFORE any Thread Weaving test; all threads (base + additional) must be woven before casting. Each additional thread gets its own effect: the caster may pick a different option per thread or the same option for every thread (so stacking is allowed, e.g. two threads = +4 Damage Steps, or +10 yd range and +2 Steps). Cap: the Additional Thread Limit Table by Circle in the casting Discipline: Circles 1-4 = 1, 5-8 = 2, 9-12 = 3, 13-15 = 4. A human with Thread Weaving only via Versatility has no Circle and cannot weave additional threads. If an extra-thread option uses "Rank" as a modifier, each additional thread gives a bonus up to the caster's Spellcasting rank (Air Armor example: rank 5 = up to 5 extra targets). A zero-thread spell in an Enhanced Matrix may take extra threads, but the effect must be chosen when the spell is placed in the matrix. Spells with 0 base threads still have a Weaving difficulty for weaving extra threads. Success Levels (per extra Spellcasting success, see Q012) and Extra Threads are separate mechanisms in separate spell lines, each described in its own rules paragraph; nothing in the extracts forbids using both on one cast, and they naturally combine (threads are paid before casting, success levels come from the Spellcasting result). Note the book does not describe extra threads as "successes beyond required": normal thread-weaving rules apply, and the extracts do not say what an individual failed additional-thread test does beyond the general weaving rules.

Sources:
- manual/text-player-guide-spell-concepts.txt:392–415 (p. 256-257 — Additional Threads, limit table, Versatility)
- manual/text-player-guide-spell-concepts.txt:984–1004 (pp. 270-271 — Extra Threads, Earth Darts example, Rank modifier)
- manual/text-player-guide-spell-concepts.txt:1005–1009 (p. 271 — Air Armor example)
- manual/text-player-guide-spell-concepts.txt:888–898 (p. 268 — 0-thread spells still have Weaving difficulty)
- manual/text-player-guide-spell-concepts.txt:977–983 (p. 270 — Success Levels)

Decision: 2026-10-02 — Owner ruling: the app keeps its weave-then-pick extra-thread flow (extra threads chosen after weaving), deliberately differing from the book's declare-up-front rule; and both Extra Thread options and Success Level options apply together to the same cast. (house rule)

### Q017 — Death's Head (Nethermancer Circle 2): full stat block, success levels, extra threads, Frighten interaction
Keywords: Death's Head, Nethermancer, Frighten, Simple action, gore-spattered skull, Increase Effect, +2 bonus to Frighten, Rank+5 rounds · Resolved: 2026-10-03 · Context: deaths-head-spell-fix

Printed block (PG p. 323): Threads 0; Weaving 6 / 11; Casting TMD; Range Self; Duration Rank+5 rounds; Effect "Use Frighten as Simple Action". The caster touches his face and makes a Spellcasting test against his own Mystic Defense; if successful he may use Frighten as a Simple action for the spell's duration. Success Levels: Increase Duration (+2 rounds). Extra Threads: Increase Effect (+2 bonus to Frighten) — the only extra-thread option (no damage/range/target options). The Effect line is NOT "+N to Frighten"; the +2 bonus to Frighten tests appears only as the extra-thread option, and the book does not say per-thread beyond the general extra-thread rules (Q016). Frighten talent itself: Step Rank+WIL, Action Standard, Strain 0 (PG talent text); the spell changes its action to Simple. Other spells use the same "Increase Effect (+N bonus)" wording (e.g. text-RB-players-guide.txt:10143, 10186, 10233, 10293, 10359, 10475: "+2 bonus"/"+1 bonus"); Nightcaster-line Circle spells nearby use "Increase Effect (+1 additional Success to Frighten tests)" (line 12405). Most others use "+2 Effect Step".

Sources:
- text-RB-players-guide.txt:12137-12153 (p. 323 — Death's Head)
- text-RB-players-guide.txt:5251-5260 (Frighten talent)
- text-RB-players-guide.txt:12405 (Increase Effect, +1 additional Success to Frighten)
- text-spell-table-all.txt:326

### Q018 — Action types (Standard/Simple/Free/Sustained/NA): definitions, per-round limits, hierarchy, and abilities that change another talent's action type
Keywords: action type, Standard action, Simple action, Free action, Sustained action, NA, per round limit, change action, "as a Simple action instead of a Standard action", Death's Head, Beguiling Blade, Swift Link, Frighten · Resolved: 2026-10-03 · Context: taxonomy-on-action-type

Five types (PG p. 122): Standard, Simple, Free, Sustained, NA. Standard: one per combat round (talents may explicitly allow several tests inside one use); covers most combat/Interaction talents and any magic use (weaving, casting); may instead be spent to move up to double Movement Rate. Simple: little effort, no normal limit (GM may cap), usually independent of other actions (speaking, moving, gesturing); each talent still once per round unless noted. Free: unlimited, usually part of/reaction to another action (enhancing damage, defensive); normally the only type usable off one's own turn; most usable multiple times per round. Sustained: takes more than one round, uses Standard actions over consecutive rounds/minutes/hours; only Sustained if a Standard action is needed several times before the talent takes effect. NA: always-on, no Action. Combat summary (p. 373): one Standard action and any number of Simple actions per round; Sustained over several turns; Free "when the ability allows it". Talents that do not need a Standard action are "often considered Simple Actions" (e.g. Anticipate Blow, Astral Sight, Battle Shout, Second Attack) (p. 375).
Hierarchy: NO printed speed/substitution ordering between types (no statement that a Simple can be taken in place of a Standard or vice versa). The only substitutions are explicit per-ability changes, below. The talent's printed Action applies "every time it is used" (p. 122, line 4193).
Frighten: Step Rank+WIL, Action Standard, Strain 0, Skill Use No (confirmed, see Q017).
Death's Head (PG p. 323): "he may use the Frighten talent as a Simple action for the duration of the spell" -> applies to every use of Frighten while the spell lasts (Duration Rank+5 rounds); no per-use limit stated beyond the general once-per-round-per-talent rule (Q017).
Other abilities changing a talent's action type (extracts): Beguiling Blade (Companion, Free-action talent): make Conceal Object tests "as a Simple action, instead of a Standard action" (companions-guide:1735-1741); Swift Link [Augment], Thought Link knack, Rank 11, Strain 2: uses Thought Link (incl. knacks) as a Simple action (deeper-secrets:13724-13728); dragon power Dispel Magic (Simple) works like the Dispel Magic talent "but does not require a Standard action" (gamemasters-guide:17099-17103; creature power, not PC). Threaded-item powers granting an ability at a set action type (grant, not a change): companions-guide:6895, 7006, 7047, 7122, 7126, 7483, 7666, 7767, 7804, 7816, 7822, 7866, 8984; gamemasters-guide:9447, 9479, 9705. Not exhaustively verified beyond regex searches for "as a Simple/Free action" phrasing.

Sources:
- text-RB-players-guide.txt:4188-4233 (pp. 122-123 — Action types)
- text-RB-players-guide.txt:13988-14013 (p. 373 — Actions, Standard Actions)
- text-RB-players-guide.txt:14029-14036 (p. 374 — Sustained)
- text-RB-players-guide.txt:14057-14082 (p. 375 — Simple, Free)
- text-RB-players-guide.txt:5251-5260 (Frighten); 12137-12153 (p. 323 — Death's Head)
- text-RB-companions-guide.txt:1735-1741 (Beguiling Blade)
- text-RB-deeper-secrets.txt:13724-13728 (Swift Link)
- text-RB-gamemasters-guide.txt:17099-17103 (dragon Dispel Magic)

Decision: 2026-10-03 — The books print no ordering between action types; for the app, when several active effects set different actions on the same talent, the fastest wins (Free > Simple > Standard). Only Free/Simple/Standard are valid values for the new `action-modifier` effect. (house rule)

### Q019 — Night's Edge (Nethermancer Circle 2): full stat block, D4 bonus die scope, weapon ownership/type, Mystic Defense penalty
Keywords: Night's Edge, Nights Edge, Night's Blade, nethermancer, second circle, D4 bonus die, cold damage, weapon enchant, Mystic Defense penalty, -2 Mystic Defense, touch, Rank+5 rounds, Step 3 · Resolved: 2026-10-04 · Context: spell-nights-edge

Stat block (PG p. 324): Threads 0; Weaving Difficulty 6 / 11; Casting TMD (target's Mystic Defense); Range Touch; Duration Rank+5 rounds; Effect line "Adds Step 3/D4 cold damage to weapon/Physical and reduces target's Mystic Defense by 2." Element tag Water-Cold. Success Levels: Increase Duration (+2 rounds). Extra Threads: Increase Effect (+2 Damage Step), Increase Range (+10 yards), Additional Target (+Rank).
Description: the magician exhales into a clenched fist and makes a Spellcasting test against the target's Mystic Defense; on success freezing fog envelops the weapon. "The wielder adds a D4 Bonus Die to the weapon's Damage test and any target that takes damage from the weapon suffers a -2 penalty to their Mystic Defense until the end of the next round." Works on weapons of any material.
Scope: the text says the D4 Bonus Die is added to "the weapon's Damage test" and runs for Rank+5 rounds; it does NOT say "first only" nor "every", so per-hit repetition is implied by the duration but not stated. Ownership of the weapon and melee vs missile are NOT stated (only "weapon", touch range, "wielder"; "any material"). Compare Arrow of Night, which is explicitly missile-only (Q008). Treat as owner decision.
Mystic Defense penalty: applies to "any target that takes damage from the weapon" (no limit by which defense/armor was used; Physical vs Mystic not distinguished), -2 until the end of the next round. Effect line's "/Physical" means the extra damage is Physical (reduced by Physical Armor is not stated). Deeper Secrets knack Night's Blade (Circle 2 knack; Patterncraft rank 5, Nethermancer Circle 5, Strain 1): glyph transfers to the weapon, penalty becomes -4 Mystic Defense until end of next round.

Sources:
- text-spell-players.txt:2745-2764
- manual/text-player-guide-nethermancer-spells.txt:255-270 (p. 324)
- text-spell-table-all.txt:327
- text-RB-deeper-secrets.txt:17260-17269 (Night's Blade knack)

### Q020 — Does a Bonus Die (e.g. Night's Edge D4) explode on max roll, and is it rolled separately from step dice / Karma die?
Keywords: Bonus Die, bonus dice, explode, explosion, exploding, maximum roll, reroll, D4 bonus die, Night's Edge, Karma die, Damage test, step dice · Resolved: 2026-10-04 · Context: spell-nights-edge

Yes to explosion: the core rule is that rolling the maximum on ANY die gives an extra die of the same type (a "bonus die"), added to the total, and this repeats as long as the maximum keeps coming up. So a D4 Bonus Die from a spell, being a die rolled on the test, follows the same logic: a 4 earns another D4, and so on. The book states this only generically; no text specifically says "the spell's Bonus Die explodes" (inference, moderate confidence).
Separate die: the spell text says the wielder "adds a D4 Bonus Die to the weapon's Damage test", i.e. an additional die on top of the Damage test (Strength + weapon Damage Step dice). The PG says Bonus Dice apply to all tests including Damage tests, and Karma dice are likewise added as their own die (Karma is not re-rolled on the Damage test unless a talent allows it). Nothing says the D4 merges with the step dice; it is an additional die. Also, the PG's Fiery Weapon-style wording ("D6 Bonus Die to the fiery weapon's Damage test", PG line 10168) uses the same phrasing.
Note the term overload: the PG's "Bonus Dice" heading (p. 32) defines explosion rerolls as bonus dice; spells then use "Bonus Die" for an added die. The extracts do not explicitly reconcile the two uses. Treat explosion of spell-added dice as the natural reading; owner may confirm.

Sources:
- text-RB-players-guide.txt:847-858 (p. 32, Bonus Dice: max roll -> roll another die of same type, repeats)
- text-RB-players-guide.txt:14230-14232 (Bonus Dice apply to all tests including Damage tests; Karma die may be added to damage test)
- text-RB-players-guide.txt:4130-4145 (p. 121, Karma Die added to test result; multiple Karma Dice possible on one test)
- text-RB-players-guide.txt:12164 (Night's Edge text), 10168 (Fiery weapon wording)

### Q021 — Spellcasting difficulty when the target is willing or is the caster (TMD spells, e.g. Touch weapon enchant)
Keywords: willing target, self target, caster as target, own weapon, ally, Mystic Defense, TMD, Casting Difficulty, lower Mystic Defense, forgo defense, Touch range, Night's Edge · Resolved: 2026-10-04 · Context: spell-nights-edge

NOT COVERED as a special case. The extracts contain no rule letting a willing target (or the caster) lower, drop or waive Mystic Defense, and no rule setting a different difficulty for self-targeted TMD spells. The only general rule is that Casting is the target's Mystic Defense "for many spells", a fixed value, or another calculation, per spell. Range "Touch" explicitly "could be the caster", and "self" range spells only work on the caster, but no difficulty exception is attached to either. Targets using "willing" are mentioned only in individual spell descriptions (binding, Battle Fury, etc.), each with its own Casting line; none waives the test. The Spellcasting test is still made ("a successful Spellcasting test means the caster has touched the target"). Read literally, a TMD spell on oneself or an ally is tested against that person's normal Mystic Defense (minimum 2), but the book never states this for willing targets. Mystic Defense of an object (e.g. an unenchanted non-magical weapon) is 2; whether a weapon-targeted vs wielder-targeted Night's Edge uses the weapon's or the wielder's MD is not stated. Combat options "raising or lowering defense ratings" are mentioned only generically (line 13933) with no willing-target lowering rule. Needs an owner decision.
Files searched: text-RB-players-guide.txt, manual/text-player-guide-spell-concepts.txt.

Sources:
- text-RB-players-guide.txt:10004-10007 (Casting line: TMD, fixed, or other)
- text-RB-players-guide.txt:10008-10014 (Range: self = caster only; Touch "could be the caster"; Spellcasting success = touched)
- manual/text-player-guide-spell-concepts.txt:416-431 (p. 257 — DN usually target's MD; dull-witted/non-magical objects MD 2; magic items by potency)
- text-RB-players-guide.txt:13930-13933 (combat options raising/lowering defense, generic only)

Follow-up (2026-10-04, Mystic Defense of weapons): the extracts give no stat for a weapon's Mystic Defense. Only general text: "Dull-witted creatures and most inanimate non-magical objects have a Mystic Defense of 2. Magical items generally have a Mystic Defense based on the potency of the object" (no table or formula for potency). Other texts refer to "the weapon's Mystic Defense" without a number.
Follow-up sources:
- text-RB-players-guide.txt:9538-9541 (p. 257 — non-magical objects MD 2; magical items by potency); same text manual/text-player-guide-spell-concepts.txt:423-425
- text-RB-players-guide.txt:13390-13391 (a spell test "against the weapon's Mystic Defense", no value given)
- text-RB-companions-guide.txt:2687-2689 (Weapon Breaker: "the weapon's Mystic Defense", no value given)

Decision: 2026-10-04 — owner: (1) Night's Edge is cast on the weapon, so its Spellcasting difficulty is the weapon's Mystic Defense. (house rule)
Decision: 2026-10-04 — owner: (2) A willing target may lower their own Mystic Defense to 2 for a spell cast on them. Rules classification only; not applied by any feature yet. (house rule)

### Q022 — Obsidiman racial Natural Armor (Physical/Mystic) and the "Obsidiman Skin" armor item
Keywords: obsidiman, obsidimen, natural armor, racial ability, obsidiman skin, living armor, physical armor 3, mystic armor, armor table, Wound Threshold · Resolved: 2026-10-04 · Context: TAXONOMY-AUDIT T-018

Racial Natural Armor: obsidiman skin has Physical Armor Rating 3; no Mystic Armor is stated for the racial ability. Obsidimen can wear only other "living" armor, whose protection adds to Natural Armor. Separately, obsidimen get +3 Wound Threshold. The racial value is 3, not 2.
Armor item "Obsidiman Skin" (made from a slain obsidiman) is a distinct, purchasable armor on the Armor Table: Physical 3, Mystic 1, Initiative Penalty 0, cost 100, weight 20, Rare. Its text says obsidimen attack anyone wearing it on sight and dwarfs/trolls worsen Attitude by two degrees. The text does not say whether it counts as "living" armor for obsidimen. A items.json entry with Physical add 2 contradicts the book on both the racial ability (3) and the item (3); Mystic 1 matches the item only.

Sources:
- text-RB-players-guide.txt:1453-1459 (obsidiman racial abilities: Wound Threshold +3, Natural Armor Physical 3)
- text-RB-players-guide.txt:15622-15627 (Obsidiman Skin armor description)
- text-RB-players-guide.txt:16484-16500 (p. 435 — Armor Table: Obsidiman Skin 3 / 1 / 0 / 100 / 20 / Rare)
- player-tables-narrative.txt:1031 (same stats in prose)
- text-race-players.txt:35 (same racial text)

### Q023 — Warrior Circle 7 extra Recovery test per day; Bone Charm Recovery bonus and Death/Unconsciousness effects
Keywords: warrior, recovery test, additional recovery, seventh circle, circle 7, recovery bonus, bone charm, blood charm, blood magic damage, death rating, unconsciousness rating, ork · Resolved: 2026-10-05 · Context: TAXONOMY-AUDIT T-003

(1) Yes. Warrior Seventh Circle: "Recovery: The adept gains an additional Recovery test." Rules text defines Recovery bonuses as permanently increasing the number of Recovery tests per day. Companion Guide variants say "an additional Recovery test per day".
(2) The Bone Charm (common version) causes 1 Blood Magic Damage on implanting and "grants a +1 bonus to his Recovery tests". That is a +1 bonus to the Recovery test result, NOT +1 Recovery test per day. Death/Unconsciousness -1: the book does not state this for the charm. Blood Magic Damage is recorded separately; only permanent Blood Magic Damage is recorded as a reduction of Death and Unconsciousness Ratings. Charm damage is stated to be unhealable until the item is used or removed (not permanent), so a -1 Death/Unconsciousness rating effect is not directly supported; the book is silent/ambiguous on whether it lowers the ratings. Owner decision needed.

Sources:
- text-discipline-players.txt:453 (Warrior Circle 7 Recovery)
- text-RB-players-guide.txt:2955-2956 (Recovery bonuses = tests per day)
- text-RB-players-guide.txt:15727-15732 (Bone Charm: 1 Blood Magic Damage, +1 bonus to Recovery tests)
- text-RB-players-guide.txt:8886-8897 (Blood Magic Damage tracked separately; permanent = reduction of Death/Unconsciousness Ratings)
- text-RB-players-guide.txt:8933-8936 (blood charm damage cannot be healed until item used or removed)
- text-RB-companions-guide.txt:5706-5714 (Bone Charm enchanting stats; no effect change)

### Q024 — Aspect of the Fog Ghost (N2) and Aspect of the Casual Murderer (N7): do the bonuses apply to the target character or a separate spirit entity?
Keywords: aspect of the fog ghost, aspect of the casual murderer, summon fog ghost, nethermancer, binding spell, bound spirit, willing target, +3 attack damage physical defense, +5 attack damage, spirit merges, sustained effect · Resolved: 2026-10-05 · Context: spells.json aspect spells

(1) Fog Ghost (Nethermancer 2nd Circle): Threads 1; Weaving 6/11; Casting TMD; Range 10 yards; Duration Rank rounds; Effect "+3 to close combat Attack and Damage tests, +3 to Physical Defense". It is a "Binding" spell: the caster binds a maleficent spirit to a WILLING target within the fog. Spellcasting test vs the target's Mystic Defense; if successful "the target gains +3 to close combat Attack and Damage tests, and Physical Defense for the duration". The spirit urges the target to attack the nearest non-spirit/non-undead each round; resisting needs a Willpower test vs the spirit's Social Defense 12. Resisting, or attacking spirits/undead, ends the spell and the spirit departs; this spell and Summon Fog Ghost cannot be cast for a full day. Only one active casting at a time (including Summon Fog Ghost); may share a matrix with Summon Fog Ghost. Success Levels: +2 rounds duration. Extra Threads: +1 bonus, +10 yards range.
(2) The bonuses go to the TARGET character, not a separate entity: the text says "the target gains". The separate fog-ghost entity is the different spell Summon Fog Ghost (named in the text, not detailed here). No separate attacking spirit is described for Aspect.
(3) Casual Murderer (Nethermancer 7th Circle): Threads 1; Weaving 11/16; TMD; Touch; Duration Rank+5 rounds; Effect line "+5 to Attack and Damage tests". The spirit "materializes over the target and merges with him"; the target "gains a +5 bonus to close combat Attack and Damage tests against opponents who are Blindsided, Knocked Down or Surprised". So it is on the target character, but is close combat only and conditional on those opponent states (the one-line Effect omits that; the body governs). Not attacking such a foe when able ends the spell; causing no damage or ending prematurely inflicts a Wound on the target and bars recasting for a day. One active casting at a time. Success Levels: +2 rounds. Extra Threads: +1 bonus.
Ambiguity: the Fog Ghost body says "to Attack and Damage tests... and Physical Defense" without conditions; the Fog Ghost Physical Defense bonus is unconditional for the duration. Casual Murderer's summary line vs body differ in scope (see above). Whether the +3 Physical Defense also holds against spirits/undead is unstated. The app modeling these as folded effects on the target matches the book; conditions (Casual Murderer's opponent states, the compulsion, the end-and-lockout triggers) are not modeled by a flat bonus.

Sources:
- text-spell-players.txt:2674-2698 (Fog Ghost); text-RB-players-guide.txt:12100-12121 (p. 322-323)
- text-spell-players.txt:3419-3442 (Casual Murderer); text-RB-players-guide.txt:12659-12679 (p. 336-337)
- text-spell-table-all.txt:324, 414 (summary rows)

### Q025 — Unarmed Combat: attack/damage flow, Defense, success levels, armor, weapons/shield, knacks, strain, Karma
Keywords: unarmed combat, unarmed attack, unarmed damage, fists, punch, kick, bare hands, Strength step damage, no weapon, Physical Defense, extra success +2 damage, armor, Karma on damage, Body Blade, Claw Shape, Shield Bash, Hammer Punch, tail attack, grapple, attached weapon, gauntlet · Resolved: 2026-10-05 · Context: unarmed-combat

(1) Unarmed Combat is a talent (Step Rank+DEX, Standard action, Strain 0, Skill Use Yes at Novice). Unless noted otherwise, the Damage test uses the Strength Step only: no base weapon step (no "fists" step; effectively +0). Contrast weapons, which add their Damage Step to Strength Step. Tail Attack (t'skrang) likewise: Damage test uses Strength Step.
(2) The Attack test is vs the target's Physical Defense. No "no weapon in hand" condition is stated. Attached weapons (gauntlet, boot spike, tail weapon) are used with Unarmed Combat and still count as weapons. Unarmed attacks are one of two close-combat types (reach usually 2 yards).
(3) Yes: the general Attack rule gives "+2 bonus damage for each extra success" on an Attack test vs Physical Defense (not specific to weapons; extra success = each 5 over the Difficulty Number). This is +2 Damage STEPS per extra success (a Step modifier applied before the dice are rolled), NOT +2 flat points added to the Damage result (revised 2026-10-05): the PG worked example takes Silar's crossbow from Step 10 to Step 14 with two extra successes, and the Success Levels example says "each extra success adds +2 Steps to her Damage test, for a total bonus of +4" (PG:931-936, p. 34). See also Q009. Armor-hardening effects (Hardened Armor, dragon Armored Scales) reduce this to +1 Step per extra success (GM:10161-10163, 17093-17096).
(4) No unarmed-specific armor rule. The general rule applies: subtract Physical Armor from the Damage test result unless a spell/power says otherwise; Wound if single-attack damage >= Wound Threshold. Not covered: any special armored/unarmored treatment.
(5) Weapon/shield in hand: no general prohibition stated. Only Hammer Punch (Companion-era knack, Rank 5, Strain 1, +2 Damage, two-handed) bars using off-hand/other limbs for attacks or a shield. Shield Bash is a separate talent (Rank+STR, Simple, Strain 1) used after a successful attack with Melee Weapons "or a similar talent or skill" for the Damage test; target makes Knockdown vs damage dealt; incompatible with Second Weapon. Not stated whether Unarmed Combat counts as "similar". Unarmed Damage-modifying options present: Body Blade knack (Companion; Unarmed Combat Rank 5; Rank+STR; Free; Strain 1; replaces unarmed damage step for one attack); Claw Shape talent (Step Rank+STR+3, Simple, Strain 0; used for Damage in unarmed combat; can be enhanced by Down Strike); Hammer Punch (+2); Crack the World (Focused Strike, +2 per success, vs Mystic Defense); spell Blazing Fists of Rage (+3 unarmed Damage; benefits Claw Shape/Swift Kick, not tail weapons); special maneuvers Aim to Injure, Armor Cutter, Exploit Armor Flaw, Grab and Strike, Eye Gouge, Mighty Throw; Phantom Strike (reach). Replacement effects: only one talent substituting Strength Step for Damage may be used.
(6) Unarmed Combat talent Strain 0; no attack Strain. Talents may spend 1 Karma Point for a Karma Die on the talent test (the Attack test); that Karma does not carry to the Damage test. Karma on the Damage test needs an ability granting it: some Disciplines have Karma-for-damage lines (Cat's Grace: "any unarmed Damage test"; Earth Skin-era Warrior line: "any Damage test made in close combat"). Unarmed Combat's own entry has no Karma line. If used as a skill, no Karma. Ambiguity: whether Strength-only Damage test may take Karma without such a grant is not stated.

Sources:
- text-talents-players.txt:691-694; text-RB-players-guide.txt:6383-6390 (p. 177)
- text-RB-players-guide.txt:14534-14538 (Tail Attack); 14727-14741, 14768-14786 (Close combat, grappling, p. 391-392); 15328-15333 (Attached Weapons)
- text-RB-players-guide.txt:14199-14229 (success levels +2 damage, Damage test, armor; p. 378-379); 14262-14269; 922-936 (Success Levels rule + "+2 Steps" example, p. 34); text-RB-gamemasters-guide.txt:10161-10163, 17093-17096 (Hardened Armor / Armored Scales: +2 reduced to +1 per extra success)
- text-RB-players-guide.txt:5945-5952 (Shield Bash, p. 166); 4656-4668 (Claw Shape); 4111-4144 (replacement effects, talents and Karma, p. 120-121); 3190-3192; 3906-3907
- text-RB-companions-guide.txt:4244-4262 (Body Blade, Eye Gouge)
- text-RB-deeper-secrets.txt:14119-14159 (Hammer Punch, Mighty Throw, Phantom Strike); 10782-10798 (Crack the World); 836-844 (Blazing Fists of Rage)

Addendum (2026-10-05) — every discipline Circle "Karma:" grant on Damage tests (PG = text-RB-players-guide.txt; CG = text-RB-companions-guide.txt):
- Archer C5: "Damage tests made with ranged weapons" (PG:3112)
- Beastmaster C5: "any unarmed Damage test" (PG:3192)
- Cavalryman C5: "any Damage tests made while mounted" (PG:3263); Cavalryman C11 (Warden): "Damage tests made by their mount" (CG:981)
- Sky Raider C5: "Damage tests made with melee or throwing weapons at or above the character's one-handed Size limit" (PG:3628)
- Swordmaster C5: "Damage tests made with a melee weapon" (PG:3699)
- Warrior C5: "any Damage test made in close combat" (PG:3906)
- Weaponsmith C5: "Damage tests he makes with a weapon he crafted" (PG:3973)
- Thief C11 (Warden): "Damage tests made against targets suffering a penalty to their Physical Defense" (CG:1371)
No others in PG/CG/Deeper Secrets/GM Guide. Karma on Damage is granted only by these discipline lines; the general Talents-and-Karma rule (PG:4128-4132) puts Karma on the talent's own test only.

### Q026 — Worn weapon-like item (gauntlet, brass knuckles, spiked glove) boosting unarmed Damage Step; is Damage Step 0 valid for a weapon?
Keywords: gauntlet, brass knuckles, spiked glove, cestus, attached weapon, unarmed Damage Step bonus, Damage Step 0, zero damage step, improvised weapon, custom item · Resolved: 2026-10-05 · Context: custom-item-builder

(1) Not covered as a stat block: no gauntlet, brass knuckles or spiked glove weapon entry with a Damage Step exists in the extracts (grep of all extracts for gauntlet/knuckle/spiked glove/cestus: only the Attached Weapons rule, Gauntlet as a Circle restriction, and the magic Gauntlets of Graaneel, a shield/armor thread item with no unarmed damage bonus). The only rule: weapons attached to the body (a gauntlet, spiked boot, t'skrang tail weapon) are used with Unarmed Combat, still count as weapons, and can be targeted by Disarm, Riposte, or weapon-enhancing spells. How such a weapon's Damage Step is applied is not stated; treat a gauntlet with +1 as an owner house item. (Q025 notes unarmed Damage otherwise uses Strength Step only.)
(2) Damage Step 0: not covered. No text states 0 as a valid or invalid weapon Damage Step. Improvised melee weapons have a GM-set Damage Step with a -2 Attack penalty (no floor stated); unarmed damage is Strength Step with no weapon step (Q025).

Sources:
- text-RB-players-guide.txt:15328-15333 (Attached Weapons, p. 406 per index line 18896)
- text-RB-players-guide.txt:14762-14767 (Improvised Melee Weapons, p. 392)
- text-RB-companions-guide.txt:7595-7606 (Gauntlets of Graaneel, p. 203-204)

Decision: 2026-10-05 — (R3) An unarmed-category weapon's Damage Step is additive to the Strength Step, matching ordinary weapons (house rule). (R4) A weapon Damage Step of 0 is accepted and stored (app convention; homebrew).

### Q027 — Situation Modifiers (Blindsided, Cover, Darkness/Blindness, Harried, Impaired Movement, Knocked Down, Range, Surprised): values, scope, stacking
Keywords: situation modifiers, blindsided, surprised, partial cover, full cover, darkness, blindness, dazzled, harried, overwhelmed, impaired movement, knocked down, range short long, defense modifier, social defense, sight-based, stacking · Resolved: 2026-10-05 (revised 2026-10-05) · Context: situational-chips-global

Table (PG p. 388): Blindsided Defense -2; Cover Partial Defense +2, Full NA; Darkness Partial -2 / Full -4 (Action test; Blindness and Dazzled share this row); Harried -2 tests / -2 Defense; Impaired Movement Light -2 / Heavy -4 (tests); Knocked Down -3 tests / -3 Defense; Range Short none / Long -2; Surprised no tests allowed / -3 Defense. Defense column "also applies to Social Defense, at the gamemaster's discretion".
- Blindsided: -2 Physical and Mystic Defense "against the attack" (per attack, not a timed state); GM may apply to Social. Attacker must see the target. A fully Surprised character takes the Surprised penalty instead.
- Surprised: no actions during the round; -3 Physical and Mystic Defense that same round; ends at end of the combat round. Numeric -3 Defense, plus "no tests".
- Cover: applies against any attack; Partial +2 Physical and Mystic Defense (the example only adds it to Physical); Full: cannot be attacked without special abilities/talents. Stacking Partial+Full not addressed.
- Darkness: -2 (partial) / -4 (full) to "sight-based tests" (text), "sight-based Action tests" in spell texts. Low-Light Vision ignores partial, treats full as partial; Heat Sight ignores both. Blindness = full darkness penalty (unless some vision remains); Dazzled = partial. Not covered: Initiative, Recovery, Knockdown, Karma-die count specifics.
- Range: Short none; Long -2 to Attack and Damage tests (example: Step 13 -> 11; damage Step 10 -> 8). No other bands in this section.
- Range scope detail (re-checked 2026-10-05): the table row "Range - Long" shows only –2 under the single "Action Test Modifier" column and does not name Attack or Damage (14591-14592); the prose at 14668-14672 is what names both: "Long: The character suffers a –2 penalty to his Attack and Damage tests." Short: "no modifiers ... tests as normal" (14670-14671). Worked example (14673-14678): Silar, crossbow, 60 yd = long; Missile Weapons Step 13 -> 11, crossbow damage Step 10 -> 8. Other extracts: Companion Long Shot talent (text-RB-companions-guide.txt:3587-3589) extends Short Range to max Long Range "suffering no distance penalty to their Attack test" (names Attack only; does not contradict). GM guide only lists short/long range distances for bows (e.g. 9113, 9126) and +25% range (8495); no differing modifier found.
- Impaired Movement (GM discretion): Light -5 Movement Rate or -2 to movement-based tests; Heavy -10 MR or -4 to movement-based tests (the Dexterity test to avoid tripping is exempt). MR never below 1.
- Stacking: Harried -2 tests and Physical/Mystic Defense; Overwhelmed: each additional harried effect after the first gives a further -1 to tests and Defense. Attackers from behind a Harried character also get Blindsided. No general stacking cap or prohibition is stated for different situations; modifiers are otherwise applied by the Step rule (modifier to Step before roll, min Step 1; GM may instead modify results).
- Which tests: Harried "-2 penalty to his tests"; Knocked Down "-3 penalty to his tests" (example includes next Initiative test) until he stands (Standard action); cannot move, crawl MR 2, no combat options except Jump Up. Table column is headed "Action Test Modifier" but the text says "tests" generally. Wounds, by contrast, are explicitly "all tests" (see Q010).
- Scope refinement (revised 2026-10-05): the table's "Action Test Modifier" header (text-RB-players-guide.txt:14579-14581) is the only place "Action" appears; the Harried and Knocked Down rows are -2 / -3 with no restriction, and the prose says "tests" without qualifier (14623, 14650), so the book reads as every test. Knocked Down's example explicitly includes the Initiative test (14661). Harried's example names only Attack tests (14628) but is illustrative. Recovery, Knockdown tests, spellcasting and skills are not named for either condition; no exclusion is stated. Note the Harried/Knocked Down rows are not "sight-based" or "movement-based" scoped, unlike Darkness (14596, 14601) and Impaired Movement (14641, 14645). Step vs result: the general rule is the modifier applies to the Step before rolling, min Step 1 (886-889), and Harried is the book's own example: "subtracts -2 from his test Steps" (892-893). GM may instead apply one-time modifiers to the result after rolling (894-896); min result on any test is 1 (885). Sub-Step-3 tests: total bonus dice before subtracting the modifier (883-884). Defense penalties are to the Defense rating, not Step. Remaining ambiguity: whether non-Action tests (Recovery, Knockdown) take it is by inference only.

Sources:
- text-RB-players-guide.txt:14539-14595 (pp. 386-388 — intro, Blindsided, Cover, Darkness partial, table)
- text-RB-players-guide.txt:14596-14618 (p. 388 — Darkness, Blindness, Dazzled)
- text-RB-players-guide.txt:14619-14634 (p. 388 — Harried, Overwhelmed)
- text-RB-players-guide.txt:14635-14672 (pp. 389-390 — Impaired Movement, Knocked Down, Range)
- text-RB-players-guide.txt:14679-14693 (p. 390 — Surprised)
- text-RB-players-guide.txt:886-893 (p. 31ff — Step modifiers, Harried example)
- text-RB-players-guide.txt:14578-14595, 14667-14678 (pp. 388, 390 — table rows; Range prose and Silar example)
- text-RB-companions-guide.txt:3580-3589 (Long Shot)

Decision: 2026-10-05 — (a) Surprised: follow the book; encode -3 Physical and Mystic Defence, "no actions" stays a note (house rule). (b) Impaired Movement: a scoped per-roll toggle for movement-based tests; the Movement Rate reduction stays a display note (house rule). (c) Darkness/Range scoped penalties are offered as per-roll toggles on non-combat rolls; which tests are sight-based is left to the player per roll (house rule). (d) Multiple simultaneous situational Defence/test modifiers stack additively, no cap (house rule).

### Q028 — Shadow Meld (Nethermancer Circle 1): full stat block, effects, Success Levels, Extra Threads, Extended Shadow Meld knack
Keywords: Shadow Meld, Nethermancer, Stealthy Stride, +4 bonus, shadows, invisible, default skill, light, Extended Shadow Meld, until dawn, Increase Duration, Increase Effect · Resolved: 2026-10-05 · Context: update-shadow-meld

Stat block (PG p. 321): Circle 1, Nethermancer; Threads 1; Weaving 5/10; Casting TMD; Range Touch; Duration Rank minutes; Effect "+ 4 to Stealthy Stride tests". Text: Spellcasting test vs the target's Mystic Defense; on success the target gains +4 to all Stealthy Stride tests "while near shadows" for the duration and may use Stealthy Stride as a default skill if lacking it. The target can still be seen normally in light, but light does not end the spell; stepping back into shadow makes the target near-invisible again. Success Levels: Increase Duration (+2 minutes). Extra Threads: Increase Duration (+2 minutes), Increase Effect (+2 bonus). The extracts give no penalty to observers' Perception/detection tests and no numeric light thresholds beyond "near shadows". The effect is a "bonus" (not explicitly "steps"; the spell table says "+ 4 to Stealthy Stride tests"). Per Q012/Q016, each extra success = +2 minutes; each extra thread = +2 minutes OR +2 to the bonus (options per thread, stackable). Deeper Secrets knack Extended Shadow Meld (Circle 1; requires Patterncraft rank 5, Shadow Meld; restricted to Nethermancer Circle 5; Strain 2; Blood Magic): duration is until dawn and can't be increased. Not in the Companion; no other Deeper Secrets spell entry. The spell table matches the PG.

Sources:
- text-RB-players-guide.txt:12036-12049 (p. 321); text-spell-players.txt:2580-2597; manual/text-player-guide-nethermancer-spells.txt:133
- text-spell-table-all.txt:308
- text-RB-deeper-secrets.txt:17418-17427 (p. 425, Extended Shadow Meld)
- Searched with no Shadow Meld hits: text-RB-companions-guide.txt, text-spell-deeperSecrets.txt

### Q029 — Optional rule "Using All Talents To Advance": full text, Optional Advancement Table, what it replaces, multi-Discipline handling
Keywords: using all talents to advance, optional advancement table, optional rule circle advancement, min # of talents, min talent rank, single talent from circle, new circle, talent options count, legend award circles 11-15, half third legend award, homebrew circle advancement, multi-discipline advancement, equivalent talent circle, new discipline talent cost · Resolved: 2026-11-14 · Context: homebrew-circle-adv

NOTE: Q007's line numbers for this region (18183-18299) are stale; the real lines are 17118-17234 in text-RB-players-guide.txt (the extract was restored/re-flowed). Page numbers in Q007 are right.

**Verbatim rule text (PG p. 453, lines 17139-17156):**
"Using All Talents To Advance — Optional Rule: Instead of being required to know all his Discipline Talents at a rank equal to the next Circle, a character can know a certain number of talents available to his Discipline at a minimum rank (either Discipline Talents or Talent Options), and one of those talents must be from his current Circle. The requirements are summarized on the Optional Advancement Table."
Example (Mica, Swordmaster, to Third Circle): "...must know 6 talents at Rank 3, and that one of those 6 talents must be one of the talents he learned at Second Circle. ... all of his First Circle talents to Rank 3, both of his Second Circle talents are only at Rank 2. He needs to raise his rank in either Second Circle talent to Rank 3 to be eligible to advance to Third Circle."
Legend guidance: "When using this optional rule, the recommended Legend Awards on the Legend Award Table in the Gamemaster's Guide, p.120 are too high to produce a stable Circle advancement from Circle 11 on. Only award half of what is recommended in Circles 11 and 12, and only award a third of what is recommended in Circles 13 through 15."

**Optional Advancement Table (p. 453, lines 17157-17176)** — columns: New Circle | Min. # of Talents | Min. Talent Rank | Single Talent from Circle. It is keyed ONLY by the new Circle being attained; there is NO column or row for number of Disciplines.
| New Circle | Min # Talents | Min Rank | Single Talent from Circle |
| 2 | 5 | 2 | 1 |
| 3 | 6 | 3 | 2 |
| 4 | 7 | 4 | 3 |
| 5 | 8 | 5 | 4 |
| 6 | 9 | 6 | 5 |
| 7 | 10 | 7 | 6 |
| 8 | 11 | 8 | 7 |
| 9 | 12 | 9 | 8 |
| 10 | 13 | 10 | 9 |
| 11 | 14 | 11 | 10 |
| 12 | 15 | 11 | 11 |
| 13 | 16 | 12 | 12 |
| 14 | 17 | 12 | 13 |
| 15 | 18 | 13 | 14 |
The 4th column's header reads "Single Talent from Circle"; its value is always New Circle minus 1, i.e. the adept's current Circle (matches the rule text "one of those talents must be from his current Circle" and the example: Third Circle target -> "2", a talent learned at Second Circle). So: at least one counted talent must be a talent gained at the Circle you are leaving.

**What it replaces:** only the "Minimum Talent Requirements" gate (standard rule, p. 452, lines 17127-17137: all Discipline Talents of lower Circles at rank = target Circle; Talent Options play no role). The optional rule text says "Instead of being required to know all his Discipline Talents at a rank equal to the next Circle". Under it Talent Options DO count ("either Discipline Talents or Talent Options"). Nothing in the rule touches the other condition (train with a higher-Circle member of the Discipline, p. 452 lines 17129-17130), the 40 hours in a three-week period, the restart on lapse, the negotiated fee / Circle Training Cost Table, or "Reaching the Next Circle" (buy the new Discipline Talent and one Talent Option) (p. 454, lines 17177-17208, 17216-17234). Those are stated separately and the optional rule does not mention them, so they stand unchanged. Optional rule "Specific Training for Talent Options" (p. 454, 17209-17215) is a separate option.

**Multiple Disciplines:** the optional rule text and table say nothing about multi-Discipline characters; they speak of "talents available to his Discipline" and "his current Circle" (singular Discipline). Read literally and per Q007's per-Discipline framing, advancement is evaluated per Discipline: count talents available to that Discipline, with one from that Discipline's current Circle. The book does not say whether talents from OTHER Disciplines (other than shared ones, below) count toward the N talents; this is not covered. What the multi-Discipline section does say (p. 457, lines 17345-17350): Discipline Talents available through several Disciplines "count as Discipline Talents for all applicable Disciplines and are used to qualify for advancement in all applicable Disciplines"; Disciplinary variants such as Thread Weaving count as different talents per Discipline. A Talent Option that is also a Discipline Talent of a new Discipline becomes a Discipline Talent for it once the character qualifies by Circle (17355-17360). Versatility talents (and Versatility itself) do not count toward advancement (p. 6410-6415 of the extract; PG text at line 6410-6415). Thread-rank bonuses do not count (see Q007).

**Interactions:** Legend costs: none altered by the optional rule; talent LP costs are unchanged (first Discipline per Talent Cost Table; additional Disciplines per the Equivalent Talent Circle Table, which is based on the number of Disciplines and the Circle of each, pp. 457-458, lines 17326-17344, 17361-17394). New-Discipline Rank 1 cost uses the lowest Circle among current Disciplines (17281-17283); fee for a new Discipline is 100 sp per Circle achieved in other Disciplines per talent (17261-17264). The only Legend-related change in the optional rule is the reduced Legend Awards for Circles 11-15 above. The Circle number used for derived values is not addressed by this rule; it is just the Circle attained (and Discipline ability/Defense/Durability bonuses come with Circle, p. 86; across multiple Disciplines Durability uses the highest rating per Circle and Defense bonuses do not stack, p. 458, 17408-17423).
Status flag: the table is an advancement GATE; whether the app's current advancement logic implements it was not checked (no app files read).

Sources:
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17118-17137 (p. 452 — standard advancement conditions)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17138-17176 (p. 453 — optional rule text, Mica example, Legend Award guidance, Optional Advancement Table)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17177-17234 (p. 454 — training, reaching next Circle, specific training option, Circle Training Cost Table)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17235-17423 (pp. 455-458 — Learning New Disciplines, advancing in a new Discipline, tables, Durability, Defense)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:6410-6415 (Versatility talents do not count toward advancement)

### Q030 — Optional "Using All Talents To Advance": do free/automatic talents count toward the N talents; and what does "one of those talents must be from his current Circle" mean (exact Circle? Talent Options?)
Keywords: using all talents to advance, free talents count, durability, karma ritual, call missile, air sailing, standard matrix, single talent from circle, current circle, talent option counts, learned at circle, mica example, swordmaster, optional advancement table · Resolved: 2026-11-14 · Context: homebrew-circle-adv

**(1) Free talents.** The Free Talents rule says a free talent "does not count for the purposes of qualifying for the next Circle, but in all other respects behaves as a talent" (PG p. ~86, line 2908). That sentence is general and not tied to the standard gate; the optional rule does not override it (it only swaps the "all Discipline Talents" requirement for "N talents ... (either Discipline Talents or Talent Options)", lines 17139-17144). So free talents (Call Missile, Air Sailing, Standard Matrix, etc.) are excluded from the N under both gates; this is the book's text, though the optional rule itself never mentions them (mild inference: it is silent, the Free Talents rule is categorical). Durability and Karma Ritual are not talents at all: Durability is a Discipline attribute listed at First Circle (text-discipline-players.txt:332), Karma Ritual is a Discipline-header rite. They are never in the Discipline Talents / Talent Options lists, so cannot be counted. The standard gate (p. 452, 17131-17137) counts only Discipline Talents; Talent Options play no role.
Mica example consistency: Swordmaster First Circle Discipline Talents are 5 (Avoid Blow, Maneuver, Melee Weapons, Taunt, Thread Weaving) (text-discipline-players.txt:333); Second Circle adds First Impression (:336). Third Circle needs 6 talents at Rank 3 (table 17164). The example says all First Circle talents are at Rank 3 (5) and "both" Second Circle talents are at Rank 2 (17148-17151); one more at Rank 3 makes 6. This is consistent with counting only Discipline Talents + Options and no free/Durability/Karma Ritual; Swordmaster has no free talent. The example does not by itself test whether free talents would count (Swordmaster has none), so it neither supports nor contradicts the exclusion.

**(2) "From his current Circle".** The table column is "Single Talent from Circle", always New Circle minus 1 (Third -> 2). The example reads it as "one of the talents he learned at Second Circle" (17147-17148), i.e. a talent gained AT that Circle, not "at or above" (a character cannot hold talents from above his current Circle anyway, so "at or higher" never arises in practice; the book does not discuss it). Talent Options: yes, an option counts. Reaching a Circle entitles the adept to "the Discipline Talent and one of the Talent Options available at the new Circle" (17205-17206), and the example speaks of "both of his Second Circle talents" - the Discipline Talent (First Impression) plus the Novice Talent Option taken at Second Circle (Mica "can now learn ... First Impression or one of his Novice Talent Options", 17124-17125). So either Second Circle talent satisfies the single-talent condition. The book does not say explicitly how to treat an option learned later (e.g. under Specific Training / Versatility) with respect to which Circle it is "from"; the natural reading is the Circle at which the option slot was taken (not covered beyond that).

Sources:
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:2905-2915 (free talents do not count toward next Circle; Air Sailor example)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17127-17137 (p. 452, standard gate)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17139-17151 (p. 453, optional rule and Mica example)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17157-17176 (p. 453, Optional Advancement Table)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17203-17208 (p. 454, Reaching the Next Circle)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17123-17126 (p. 452, Mica reaches Second Circle)
- rulebook extracts/rulebook extracts/text-discipline-players.txt:328-339 (Swordmaster talents by Circle)

### Q031 — Damage/health mechanics for the Health card: Wound, Knockdown, Unconsciousness/Death, Recovery test, healing Wounds
Keywords: health, damage, wound threshold, knockdown, knockdown test, difficulty, unconscious, unconsciousness rating, death rating, recovery test, recovery step, toughness step, recoveries per day, heal, healing wounds, one wound per day, full night's rest, current damage, strain · Resolved: 2026-11-15 · Context: update-health-overview

(1) Wound: if the damage from a *single attack* (after armor) equals or exceeds the Wound Threshold, the character takes one Wound (one per attack, not multiple). The Wound is recorded even if the hit also renders him unconscious or dead.
(2) Knockdown: if damage exceeds the Wound Threshold by five or more, the player makes a Strength test against Difficulty = damage minus Wound Threshold (example: WT 8, 15 damage -> Knockdown (7)). Failure = knocked down. Other effects (Attacking to Knockdown, dismount) can force a Knockdown test regardless.
(3) Unconscious when Current Damage >= Unconsciousness Rating but < Death Rating; dead (barring Life Check, Last Chance Salve etc.) when Current Damage >= Death Rating. Unconsciousness Rating = 2 x Toughness value; Death Rating = Unconsciousness Rating + Toughness Step (+ Circle for adepts; highest Circle if multi-Discipline). Unconscious characters can only make Recovery tests and count as Blindsided and Knocked Down; they wake when Current Damage drops below the Unconsciousness Rating.
(4) Recovery test: a Toughness Step test; result is typically subtracted from Current Damage. Number of tests per day is determined by Toughness (talents/spells may add extras; unused tests do not carry over). Conditions: on waking from a full night's rest an injured character must make one; at least 1 hour between tests; one minute of no physical activity/damage; wait 1 hour after combat (exception: unconscious characters, who may test 1 minute after falling unconscious, or immediately if revived by another's Standard action). Wounds reduce the result by the number of Wounds (minimum 1 recovered). Wound penalties (-1 per Wound to all tests) do not apply to Recovery tests. Healing without a Recovery test is possible only via "certain talents and spells, or the use of healing aids" (not detailed in this section); the book gives no other natural healing of damage.
(5) Healing Wounds: one Wound per day, only if the character has zero Current Damage (even 1 point, including Strain but excluding Blood Magic damage, blocks it) and uses a Recovery test after a full night's rest. Curses preventing the morning Recovery test block it; some healing aids, spells, abilities also heal Wounds. See also Q010.
App comparison: owner-stated app rules (1 Wound when hit >= WT; Knockdown when hit >= WT+5, Difficulty = damage - WT) match the book.

Sources:
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:14265-14273 (p. 379/380, Check For Wounds)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:14274-14289 (p. 380, Knockdown)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:14290-14307 (p. 380, Unconsciousness and Death)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:14312-14338 (pp. 380-381, Recovering From Damage, Regaining Consciousness)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:14339-14354 (p. 381, Wounds)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:14355-14364 (p. 382, Healing Wounds)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:2050-2067 (p. 65, Health Ratings formulas)

### Q032 — Ork racial ability Gahad: what it is, what a "gahad trigger" is, mechanical effect, who decides, how many triggers, can they change
Keywords: gahad, ork, trigger, impulse, heartburn, hangover, swallowing, Willpower (6), resist, +1 bonus, Action test, Effect test, revenge, GM discretion, personal trigger, edit trigger · Resolved: 2026-11-15 · Context: edit-gahad-trigger

(1) Gahad is largely a roleplaying concept: a physical sensation like intense heartburn, triggered by certain circumstances, driving the ork to eradicate the triggering situation or take revenge on the perpetrator. Each ork has unique triggers and feels it to varying degrees. A "gahad trigger" is an optional-rules construct: groups wanting game rules have the player describe impulses that always trigger gahad, in short sentences, with optional limits/exceptions (example: "Grisalk's gahad is triggered when his mother is insulted, except by someone in the family"). When triggered the player chooses to give in or resist (Willpower (6) test, successes required scaled to trigger severity, e.g. 1 vs 3+). Resisting ("swallowing") causes a hangover: starts within an hour, lasts 1 hour per success required, character is Harried (p. 388). Giving in (or failing to resist): driven to end the stimulus or take revenge for as long as the hangover would have lasted; +1 bonus to any Action or Effect test made towards ending the stimulus or taking revenge. The book says "bonus" without stating Step vs result add. The GM decides use/application: "always at the discretion of the gamemaster"; not meant as a +1 on every flimsy excuse; violent reaction not required, any forceful decisive action may satisfy it.
(2) "A couple of impulses" (plural, several short triggers) is the book's guidance; no hard cap stated. The player describes/specifies the triggers (and limits); the GM adjudicates whether a given situation applies and the bonuses/penalties. The book says nothing on whether triggers may later be changed (not covered); the app treating them as player-editable text is consistent with the player authoring them but is not book-backed.
(3) App comparison (rules/races.json:88-92): "+1 to Action or Effect tests aimed at ending the trigger or taking revenge, situational, GM discretion, Willpower (6) resist, hangover = Harried" matches the book. Minor notes: the effect is modeled as test-modifier target "Action" only (book says Action or Effect), measure "result" is an app interpretation (book just says "+1 bonus"), and the app summary says "gives in to (or fails to resist)" which matches. Not flagged as APP-DIFFERS beyond the result-vs-step nuance.

Sources:
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:1471-1475 (p. ~49, ork intro)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:1494-1537 (pp. 49-50, Gahad racial ability)
- rulebook extracts/rulebook extracts/QAs_Races.txt:176-210 (Q&A restatement)
- rulebook extracts/rulebook extracts/text-RB-companions-guide.txt:15662 (mention of a victim's gahad being triggered; no rule)

Decision: 2026-11-15 — No house rule needed; a gahad trigger may be edited at any time, left to the user's control. The edit-gahad-trigger feature supports a single trigger as a deliberate scope simplification (the book says "a couple of impulses"). (homebrew)

### Q033 — Rolling a talent knack: step source, Karma, Strain, "Step: N/A" knacks, parent-talent bonuses
Keywords: knack, talent knack, knack roll, knack step, Rank+attribute, replaces Action Step, Strain replaces, Karma on knack, knack karma, Step N/A, no test, Standard Effects, combining knacks, governing talent, knack rank, one knack per use, roll button, log, Discord · Resolved: 2026-11-15 · Context: roll-knacks

(1) Step/Action/Strain printed on a knack "replace the Action Step, action type, or Strain cost of the associated talent when the knack is used". Knacks have no rank of their own ("knacks are not improved"); a knack "usually uses the associated talent for any required tests", and "all knacks are still considered the governing talent" (a Destructive Shout test is still a Battle Shout test; for a knack learned via several talents, it is used with the talent it was learned through). Printed formulas are "Rank+ATTR" (e.g. Rank+PER, Rank+DEX): Rank = the parent talent's rank; the attribute is the knack's own and may differ from the parent's. Exception: knacks learnable as skills use the skill rank for the Step. Only one knack may be used per use of a talent. When combining explicitly allowed knacks: lowest Action Step, greatest action time, total Strain of all knacks.
(2) Karma: not stated per knack anywhere in the extracts (knack stat blocks have no Karma line; "Karma" does not occur in the knack chapter). Because a knack test is the governing talent's test, the talent Karma rules apply (not book-explicit): one Karma Point per use of a talent, talents not part of the Discipline (Versatility, racial, item-granted) get no Karma, and always-active/unrolled talents get none. Skill-learned knacks: skills, not talents, so no talent Karma (inference; PG Karma text is about talents). Treat as CONFLICT/gap -> owner decision if a ruling is needed.
(3) Strain: the knack's printed Strain replaces the parent talent's Strain (not added), except combined knacks, which add up.
(4) "Step: N/A" knacks (e.g. Roll With the Punches, Absorb Spell): they have no Action test; they are used *instead of* making the parent talent's test and instead reduce the successes of an incoming attack/spell by one (not below two). Not rolled. [Special Maneuver] knacks print no Step/Action/Strain; used with the listed test by spending extra successes; cannot be used on unsuccessful tests and do not count toward the knack limit. Crafting knacks also print Step N/A (per rules/knacks.json notes; not re-read in the book).
(5) Parent-talent bonuses: not explicitly addressed. Since the test is the governing talent's, talent-level bonuses plausibly carry (not book-explicit); "Standard Effects" knacks also add the talent's standard effect, others only the knack's effect.

Sources:
- text-RB-companions-guide.txt:2757-2760 (p. 75/76 — knacks use associated talent for tests; not improved)
- text-RB-companions-guide.txt:2791-2794 (p. 76 — one knack per talent use; knacks per talent = unaugmented rank)
- text-RB-companions-guide.txt:2805-2815 (p. 77 — knack still considered governing talent)
- text-RB-companions-guide.txt:2808-2813 (p. 77 — knacks as skills use skill rank for Step)
- text-RB-companions-guide.txt:2824-2825 (p. 77 — Step, Action, Strain replace talent's)
- text-RB-companions-guide.txt:2830-2837, 2838-2846 (p. 77-78 — Standard Effects, Combining, Special Maneuvers)
- text-RB-companions-guide.txt:3034-3041 (p. 83 — Roll With the Punches, Step N/A)
- text-RB-players-guide.txt:4141-4157 (p. 121 — Karma on talents; unrolled talents, non-Discipline talents)
- rulebook extracts/manual/text-player-guide-game-concepts.txt:264-273 (p. 37 — Karma basics)
- rules/knacks.json:5-12, 21 (repo: steps, N/A, no karma field)

### Q034 — Strain on talent/knack use: when paid, armor/Wounds, Karma interaction, skills, variable Strain, Half-Magic/Versatility
Keywords: strain, strain damage, talent strain, knack strain, auto-apply strain, roll button, damage to health, armor, wounds, miss, failed test, Claw Frenzy, variable strain, 1 per attack, skill strain, Half-Magic, Versatility, Karma, Battle Rites · Resolved: 2026-11-15 · Context: roll-knacks

(1) Strain is the number of Damage Points the adept takes "each time he uses the talent"; it is paid per use (per attack for multi-attack talents), not conditional on success. Claw Frenzy: Strain is taken per attack declared up front, and "if any attacks miss ... the adept still takes the full amount of Strain". The book has no explicit "failed test still costs Strain" sentence for single-test talents; the per-use wording and the Claw Frenzy case imply it (inference). Also: an Action is required "every time it is used, which normally means every time a test is made".
(2) Always full, unmodified damage, "no armor provides protection"; may be taken multiple times from one talent per round; "Unless specified, Strain never causes Wounds". It is plain Current Damage (counts toward Unconscious/Death ratings and blocks Wound healing, see Q031). Strain damage from blood magic is healed like other damage.
(3) Spending Karma costs no Strain; the Karma die just adds to the result. Karma Points are separate. Exception: Battle Rites (Circle 5 talent) spends Karma to reduce a chosen talent's Strain by 1 once per round during the encounter.
(4) Skills: skill text says "Strain:" is as for talents (p.119); General/Knowledge/Artisan skill entries print Strain 0. Whether the skill version of a talent never costs Strain is NOT stated in the extracts (app skills.json note asserts it; only language skills explicitly "do not cause Strain"). Talents with Strain 0 cost nothing. NA-action talents (always active) are not rolled.
(5) Knack Strain: see Q033(3).
(6) Variable Strain printed as "1 (see text)" (e.g. Claw Frenzy: 1 per attack declared), "1 per round the thread is held", per Astral Sight test etc. — the text of that talent governs. App formats: rules/talents.json "strain" is numeric only (0/1/2; some talents e.g. Claw Frenzy have no strain field); rules/skills.json numeric 0 for all; rules/knacks.json strings "0","1","2","3","N/A", null, "1 per minute", "1 per attack", "1+ (see below)", "0+ (see text)", "2+ (Special)", "1 Blood Magic Damage".
(7) Half-Magic: no Strain mentioned in Half-Magic text (Karma allowed). Versatility/racial/item-granted talents: no Karma, but nothing removes their printed Strain (not explicit; inference).

Sources:
- text-RB-players-guide.txt:4234-4243 (p. 123, Strain)
- text-RB-players-guide.txt:4188-4194 (p. 123, Action every use)
- text-RB-players-guide.txt:4643-4655 (p. 134, Claw Frenzy)
- text-RB-players-guide.txt:4130-4157 (p. 121, Karma)
- text-RB-players-guide.txt:3900-3905 (Battle Rites)
- text-RB-players-guide.txt:6617-6621 (skills Strain as per talents), 7298-7301, 7349-7352 (language skills no Strain)
- text-RB-players-guide.txt:2769-2775 (p. 81-82, Half-Magic tests)
- text-RB-players-guide.txt:6391-6401 (Versatility talent), 4155-4157

### Q035 — Legend Point / training cost to learn a Fourth Circle talent from a character's SECOND Discipline; does it differ from first Discipline; does current Circle matter
Keywords: second discipline, additional discipline, multi-discipline, fourth circle talent, circle 4 talent, equivalent talent circle table, talent cost table, new discipline talent cost table, rank 1 cost, legend cost, training time, 40 hours, circle training cost, journeyman column, tier shift · Resolved: 2026-11-21 · Context: ad hoc

Yes, it differs. First-Discipline talents use the Talent Cost Table by the talent's own Circle band (1-4 Novice, 5-8 Journeyman...). Talents from additional Disciplines are priced via the Equivalent Talent Circle Table, keyed by how many Disciplines the character has and the Circle range: for a SECOND Discipline, Circles 1-4 are bought as Circle 5-8 (Journeyman column), 5-8 as 9-12 (Warden), 9-15 as 13-15 (Master). So a Circle-4 talent in a second Discipline costs Journeyman prices: Rank 1 = 200 LP, then 300 (R2), 500 (R3), 800 (R4), 1,300 (R5), 2,100 (R6)... each rank bought in order. For a third Discipline the same range is 1-4 -> 9-12 (Warden: Rank 1 = 300); fourth+ -> 13-15 (Master: 500).
Current Circle matters: the book's example shifts ALL of a Discipline's talents when its Circle changes ("when he reaches Fifth Circle, those talents will be bought as if they were Circle 9-12"), so the band follows the second Discipline's current Circle, not only the Circle a talent was learned at (reading of the example; the table header says only "Discipline Circle Range"). Order of learning Disciplines (second vs third) also matters. Talents available in several Disciplines are bought at the lowest cost, in the cheapest Discipline.
The separate New Discipline Talent Cost Table (500 LP etc.) applies only to the Rank 1 buy of First Circle talents when first joining a Discipline (keyed by lowest current Circle), not to a Circle-4 talent.
Other costs: raising a rank = 8 hours uninterrupted meditation, rested and undamaged, one Rank per talent per day, max two talents per day. Gaining Circle 4 itself in that Discipline: a higher-Circle member of that Discipline as teacher, 40 hours within three weeks, fee per Circle Training Cost Table (Circle-4 instructor avg 500 sp; guideline only, instructor circle column), and prerequisite talent ranks. Learning a new Discipline costs 40 hours/talent and 100 sp x other Circles per talent but that is the initiation only. Buying the Circle's talent at the new Circle is stated as entitlement ("purchase the Discipline Talent and one Talent Option"); the book does not restate which table prices that Rank 1 buy, so using the Equivalent Talent Circle Table is by the p.457 rule that all additional-Discipline talents use it (inference).

Sources:
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17319-17344 (p. 457 - Advancing in a New Discipline, Mica example)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17384-17394 (p. 458 - Equivalent Talent Circle Table)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17049-17070 (p. 450 - Talent Cost Table)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:16992-17020 (pp. 449-450 - rank-increase conditions, how to read the table)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17177-17234 (p. 454 - training requirements, Reaching the Next Circle, Circle Training Cost Table)
- rulebook extracts/rulebook extracts/text-RB-players-guide.txt:17278-17283, 17361-17372 (p. 456-457 - New Discipline Talent Cost Table)
- text-RB-players-guide.txt:14359 (Strain blocks Wound healing)
- rules/talents.json:31,94,174 (numeric strain), rules/skills.json:7, rules/knacks.json:1751 etc.

### Q036 — Free Talents: advancement, rank, counting toward Circle/option slots, second Discipline, Karma/Strain, Standard->Enhanced Matrix, same-name stacking
Keywords: free talent, free talents, rank equals circle, Call Missile, Danger Sense, Air Sailing, Navigation, Standard Matrix, Enhanced Matrix upgrade, Fifth Circle, nethermancer, second discipline free talent, additional discipline, karma on free talent, strain, increasing free talent ranks, same talent two ranks, versatility, display free talents · Resolved: 2026-11-21 · Context: display-free-talents

(1) A Discipline's free talent is given on gaining a Circle and "advances with the character's Circle"; no Legend Points are spent on its rank. The example: Air Sailing at "a Rank equal to his Circle". Standard Matrices likewise: Rank "advances with the character's Circle". Standard rule: no way to buy it up with LP. OPTIONAL Companion rule "Increasing Free Talent Ranks": ranks ABOVE Circle may be bought at Novice-tier cost (3rd Circle buying rank 4 = 500 LP... text example: "a Third Circle character buying an extra rank ... 500 Legend Points"), with refund/credit/lost options when Circle catches up. So rank = Circle unless that optional rule is in play.
(2) Free talents do not count for qualifying for the next Circle ("in all other respects behaves as a talent"). Option slots: not occupied (see Q002); a Wizard may still spend his First Circle Talent Option on a THIRD standard matrix, bought with LP.
(3) Book text says nothing explicit about free talents in a second Discipline. Related: PG p.457 prices additional-Discipline talents via the Equivalent Talent Circle Table and says Discipline Talents known via multiple Disciplines count for all; durability/defense/Karma bonuses use highest across Disciplines. The Mica example learns only the four non-known First Circle (Discipline) talents on joining; no free talent is mentioned. NOT COVERED whether a second Discipline's free talents are granted or what Circle rank follows (Discipline Circle vs overall). Owner decision needed.
(4) Yes to Karma: the free-talent rule explicitly includes "the ability to spend Karma on tests for that talent" and weaving threads. Strain follows the talent's own entry (Call Missile Strain 1, Danger Sense Strain 1, Standard/Enhanced Matrix Strain 0, Action NA). Karma exclusions: always-active/unrolled talents (e.g. matrices, NA) "do not benefit from the use of Karma"; only one Karma Point per talent even across Disciplines; Karma not allowed on talents outside the Discipline (racial, Versatility, item-granted).
(5) Magicians (Elementalist, Illusionist, Nethermancer, Wizard) get two free Standard Matrices at First Circle; each matrix is a separate talent with its own Rank, improved independently (talent description), though the free ones follow Circle. Nethermancer Fifth Circle text: "One of the adept's free Standard Matrix talents is upgraded to an Enhanced Matrix." The book does not say which one, nor what rank the Enhanced Matrix takes (presumably Circle by the free-talent rule: inference) nor whether the Standard Matrix remains. Enhanced Matrix: rank = max spell circle, holds spell plus one pre-woven thread. Same Fifth Circle line is printed for Elementalist, Illusionist, Wizard.
(6) Duplicate names: for Discipline Talents learned through several Disciplines, one talent counts for all (PG p.457). Talent Options in several Disciplines are handled separately, using the Discipline's cost. Versatility duplicate: "the character essentially knows the same talent at two different Ranks ... may use either". Free-talent-vs-option/other-Discipline same-name: NOT COVERED (no stacking or highest-rank rule stated); one Karma Point per talent regardless of Disciplines.
App: rules/disciplines.json freeTalents lists Archer Call Missile, Nethermancer 2x Standard Matrix, Thief Danger Sense; the Circle 5 matrix upgrade is only a `note` effect (disciplines.json:127), not structured. engine/advancement.js excludes free talents from the gate, consistent with the book. No APP-DIFFERS found; note Air Sailor/Troubadour/etc. free talents not yet in file (only 3 Disciplines present).

Sources:
- text-RB-players-guide.txt:2905-2927 (p. 85-86 Free Talents, Spell Matrices, Tomas example)
- text-RB-players-guide.txt:9578-9583 (casting from matrix: two free Standard Matrices)
- text-RB-players-guide.txt:3466-3490 (Nethermancer First and Fifth Circle; also :3313-3331, :3390-3408, :4029-4046)
- text-RB-players-guide.txt:4140-4157 (p. 121 Karma limits)
- text-talents-players.txt:126-129, 186-189, 279, 584 (Call Missile, Danger Sense, Enhanced/Standard Matrix)
- text-RB-players-guide.txt:17319-17359, 17424-17444 (pp. 457-459 multi-Discipline)
- text-RB-companions-guide.txt:16690-16716 (p. 435 Increasing Free Talent Ranks optional rule)
- rules/disciplines.json:26,98,127,169; engine/advancement.js:11-13,119-135

Decision: 2026-11-21 — Owner rulings (house rule), display-free-talents:
- Item 1: the optional "Increasing Free Talent Ranks" rule (Companion p.435) is out of scope for the app; free-talent rank = Circle.
- Item 3 (second Discipline): every Discipline the character has grants its free talents; rank = that Discipline's own Circle.
- Item 5 (matrices): display two Standard Matrix rows, read-only; the Nethermancer Circle 5 Enhanced Matrix upgrade stays a note only, with no Enhanced Matrix row.
- Item 6 (same name): separate rows per Discipline; a stored same-name talent in the same Discipline suppresses that Discipline's free row; the Combat picker dedupes by name using the highest rank.

### Q037 — Call Missile talent: step, action, Strain, skill use, effect, range/limits, tier, knacks
Keywords: Call Missile, call missile, archer free talent, thrown weapons, missiles return, Perception, Simple action, strain 1, skill use no, Call Any Missile, Catch Missile, thief journeyman option, 20 yards · Resolved: 2026-11-21 · Context: display-free-talents

Step Rank + PER (Perception); Action Simple; Strain 1; Skill Use: No. The adept makes a Call Missile test (no target/difficulty stated in the base entry; no versus test) and the result sets how many unbroken missiles or thrown weapons he fired/threw fly back to him into quiver/container/hand. Affects all his own missiles/thrown weapons within Rank x 20 yards, with a relatively straight unblocked path; extracts missiles from bodies; secured or "locked away" objects (roped, behind closed door) cannot be retrieved. Tier: it is the Archer's Free Talent at First Circle (see Q036); the Thief lists it as a Journeyman Talent Option. Companion knack Call Any Missile (Rank 6, Step Rank+CHA, Simple, Strain 1, no skill use): any thrown/fired objects, and may be used versus a target's Mystic Defense to steal unsecured missiles (1 throwing weapon or 3 missiles per success). Deeper Secrets knack Catch Missile (Rank 11, Archer Circle 11, Free, Strain 3, once per round): test vs the higher of the Attack test result and the projectile's Mystic Defense.

Sources:
- text-RB-players-guide.txt:4622-4633; text-talents-players.txt:126-129
- text-RB-players-guide.txt:3088-3089 (p. 91 Archer First Circle free talent); :3761 (Journeyman option list, Thief per text-discipline-players.txt:377)
- text-RB-companions-guide.txt:3168-3182 (p. 86 Call Any Missile)
- text-RB-deeper-secrets.txt:9464-9476 (p. 224 Catch Missile)

### Q038 — Initiating a new Discipline (multi-Disciplining): what is learned, LP cost row/column, silver fee, prerequisites, known talents, Talent Option, Thread Weaving, Durability
Keywords: new discipline, additional discipline, learn new discipline, initiation, initiate, multi-discipline, multi-disciplining, first circle talents rank 1, new discipline talent cost table, lowest circle, second third fourth discipline, silver fee, 100 silver, 40 hours per talent, 80 hours per month, tutor, fifth circle adept, gamemaster discretion, talent option later, thread weaving separate, durability highest, defense bonus no stack, karma ritual, Mica, Air Sailor, Elementalist · Resolved: 2026-11-21 · Context: start-new-discipline

(1) Initiate learns ALL First Circle Discipline Talents he does not yet know, each at Rank 1, bought simultaneously (needs enough Current LP for all at once). The First Circle Talent Option "can be learned at a later time", so it is NOT required at initiation. Mica's examples end "a First Circle Air Sailor" / "joins the Elementalist Discipline as a First Circle magician", so the new Discipline starts at Circle 1.
(2) Price is per talent from the New Discipline Talent Cost Table, row = lowest Circle among his CURRENT Disciplines (the book says "current"; Mica's lowest "actually, his only" Circle is 3), column = ordinal of the new Discipline (second/third/fourth+). Examples consistent with the pre-addition reading: Mica Circle 3 -> second = 500; Mica Swordmaster 6 / Air Sailor 4 -> lowest 4, third = 500. Table (row lowest Circle: 2nd / 3rd / 4th+): 1: 1,300/2,100/3,400; 2: 800/1,300/2,100; 3: 500/800/1,300; 4: 300/500/800; 5+: 200/300/500. Every First Circle DT bought is priced at that Rank 1 price each. The Talent Option's price is "based on the Discipline they are being purchased for" (i.e. that Discipline's own pricing); the book gives no explicit table for the later Option buy (see Q035 inference).
(3) Fee: 100 sp per Circle the student has achieved in other Disciplines, charged per talent to learn. Both examples show Circles are SUMMED across other Disciplines, not highest: Mica Circle 3 -> 300 sp/talent x3 = 900; Mica Circle 6 + Circle 4 -> 4,000 sp for 4 talents (1,000 each). Since the Option is deferred, it is not in the initiation talent count (talents "he needs to learn" = unknown First Circle DTs). Masters may charge more/less, plus favors/blood oaths.
(4) Prerequisites: study with a tutor, an adept of the new Discipline of Fifth or higher Circle; 40 hours per talent within a week (Mica: 120 h for 3 talents); with 2+ talents at least 80 hours/month or training fails and he must start over; GM discretion over whether the combination is allowed, masters may demand deeds; GM should negotiate rather than flatly deny. No minimum Circle in the current Discipline, no race restriction, and no LP minimum beyond paying the total are stated. Not covered: a minimum Circle in current Discipline (silent).
(5) Known talents are skipped: only unknown First Circle DTs are learned (Mica already has Avoid Blow and Melee Weapons; Awareness). Shared DTs: bought at lowest cost across Disciplines, count for all (Avoid Blow stays priced as Swordmaster). A Talent Option known that is a DT of the new Discipline becomes a DT of the new Discipline "as soon as the character qualifies to learn it" (i.e. Circle gate in the new Discipline), then uses the new Discipline's cost and FREES the option slot (Mica/Wound Balance: Swordmaster option, becomes Air Sailor DT at Circle 4, new Second Circle option allowed). Until then it stays an option of the old Discipline. (Wound Balance example does not say whether initiation counts as already knowing it; it is an option of Circle 2 vs Air Sailor at Circle 4, so it only converts once the new Discipline's Circle reaches the talent's Circle.) Karma Ritual and Durability are not talents (see 7). Versatility talents are treated as unknown and relearned at Rank 1 (human).
(6) New Discipline's Option slots must be chosen from that Discipline's own Talent Options (First Circle = Novice pool per Q002); the slot may be left open and chosen later (p. 456).
(7) Thread Weaving (Elementalism, etc.): talents with a per-Discipline variation count as DIFFERENT talents and must be learned separately (Mica learns Elementalism (Thread Weaving) anew; cost by order of Disciplines). Karma Ritual is not in Mica's First Circle lists (Elementalist list: Elementalism, Patterncraft, Spellcasting, Wood Skin + Awareness); per Q002 it is a universal rite not a circle talent, so none is bought. The book does not state outright that Karma Ritual is shared; this is inference from the lists. Karma uses of the same kind from multiple Disciplines give only one Karma Point.
(8) Durability: highest rating at each Circle applies; on completing initiation he gains the new Discipline's Circle-1 Durability if higher (example Wizard 5 + Sky Raider +7 vs +3: +4 more). Defense bonuses do not stack; only the highest bonus per type applies. Free talents: Q036 (owner decision: every Discipline grants its own free talents at its own Circle). Half-magic: not covered in the initiation text.

Sources:
- text-RB-players-guide.txt:17235-17293 (pp. 455-456 — tutor, fee, GM discretion, learn all First Circle DTs at Rank 1, Option later, 40/80 hours)
- text-RB-players-guide.txt:17294-17318 (p. 456 — Mica Air Sailor and Elementalist examples)
- text-RB-players-guide.txt:17345-17372 (p. 457 — shared talents, Thread Weaving separate, Options across Disciplines, New Discipline Talent Cost Table)
- text-RB-players-guide.txt:17397-17407 (p. 458 — Thread Weaving x3, Wound Balance example)
- text-RB-players-guide.txt:17408-17423, 17424-17429, 17430-17444 (pp. 458-459 — Durability, Defense, Karma, Versatility)
- docs/RULES-FAQ.md Q002, Q035, Q036 (option pools, free talents, Karma Ritual)
