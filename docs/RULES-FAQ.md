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
