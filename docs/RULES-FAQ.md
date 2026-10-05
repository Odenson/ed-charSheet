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
- text-RB-players-guide.txt:3126–3128 (p. 65 — Wound Threshold definition)
- text-RB-players-guide.txt:15404–15413 (p. 381 — Wounds: recovery reduction)
- text-RB-players-guide.txt:15414–15419 (p. 381 — Wound Penalties: cumulative –1 per Wound)
- text-RB-players-guide.txt:15330–15338 (p. 380 — Step 5: Check For Wounds in attack resolution)
- text-RB-players-guide.txt:15339–15351 (p. 380 — Step 6: Knockdown from Wounds)
- text-RB-players-guide.txt:15420–15429 (p. 382 — Healing Wounds)
- text-RB-players-guide.txt:15355–15372 (pp. 380–381 — Unconsciousness and Death)
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
