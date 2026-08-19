#!/usr/bin/env python3
# ============================================================================
# tools/archive/add-items.py — ARCHIVE-ONLY (plans/PLAN-STRUCTURED-COST-WEIGHT.md Phase C):
# the catalog is now the source of truth, and rules/items.json has migrated to
# the ed-items/3 schema (structured `ref.weight`, numeric `ref.cost`). This
# extractor's `norm_cost` / `norm_weight` emit the old string forms and would
# REINTRODUCE schema-invalid data if re-run against the live catalog. It is kept
# for reference only — do not run it on the current rules/items.json.
#
# (Originally: extend rules/items.json with the equipment chapter's
# remaining item tables from the rulebook extracts, preserving the existing
# ed-items/2 schema and the EFFECT-TAXONOMY v3 vocabulary.)
#
# Source: "rulebook extracts/text-RB-players-guide.txt" (Earthdawn 4E Player's
# Guide). The following tables are parsed live from the file:
#   - Melee Weapons Table (p.433)         -> kind "weapon"  (category melee)
#   - Missile Weapons Table (p.434)       -> kind "weapon"  (category missile)
#   - Throwing Weapons Table (p.435)      -> kind "weapon"  (category throwing)
#   - Common Magic Item Table (p.436)     -> kind "magic-item"
#   - Blood Charm Table (p.437)           -> kind "blood-charm"
#   - Healing Aid Table (p.438)           -> kind "healing-aid"
# Missile-table ammo rows (arrow/bolt/needle bundles, Quiver) become kind
# "ammunition". The Adventuring Equipment Table (p.438-439) is freeform prose
# (multi-line rows, reflowed with glued page numbers), so it is transcribed
# below as a structured constant rather than line-parsed; each row cites the
# source lines it came from.
#
# Faithfulness model:
#   - `ref` stats (cost / weight / availability / minima / ranges / EDN) come
#     from the tables and are DISPLAY-ONLY reference, like the existing armor &
#     shield entries.
#   - Mechanics live in `effects`, hand-curated from the item descriptions in
#     the same chapter (EFFECTS below). Numeric, always-relevant bonuses are
#     typed taxonomy modifiers; activated / one-shot / situational bonuses are
#     typed modifiers with condition "situational" + scope; non-numeric,
#     narrative or one-time properties are `note` effects. Weapon Damage Step
#     uses measure "step"; flat "+N to a test" bonuses use measure "result",
#     matching the existing talents.json convention.
#
# Idempotent: existing armor/shield entries are preserved untouched; re-running
# reports already-present names and changes nothing. Dry-run by default.
#
# Usage:
#   python3 tools/archive/add-items.py                 # dry-run report
#   python3 tools/archive/add-items.py --write         # merge into rules/items.json
#   python3 tools/archive/add-items.py --source <file> # point at a different extract
# ============================================================================

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "rulebook extracts" / "text-RB-players-guide.txt"
DEFAULT_ITEMS = ROOT / "rules" / "items.json"

# ---------------------------------------------------------------------------
# Taxonomy vocabularies (docs/EFFECT-TAXONOMY.md v3) — the validator's source
# of truth. Adding a word here is a taxonomy change (Tier 2); do not do it to
# make data fit.
# ---------------------------------------------------------------------------

EFFECT_TYPES = {
    "attribute-modifier",
    "defense-modifier",
    "characteristic-modifier",
    "armor-modifier",
    "attack-modifier",
    "test-modifier",
    "grant-ability",
    "grant-attack",
    "sense",
    "resource-modifier",
    "enable-option",
    "grant-karma-use",
    "note",
}
# Types that must carry operation/value/measure (numeric modifiers).
MODIFIER_TYPES = {
    "attribute-modifier",
    "defense-modifier",
    "characteristic-modifier",
    "armor-modifier",
    "attack-modifier",
    "test-modifier",
    "resource-modifier",
}
# Types that need a `target` but no value/operation.
TARGET_ONLY_TYPES = {"grant-attack", "sense", "enable-option", "grant-karma-use"}

TARGET_NAMES = {
    "attribute": {"Dexterity", "Strength", "Toughness", "Perception", "Willpower", "Charisma"},
    "defense": {"Physical", "Mystic", "Social"},
    "characteristic": {"WoundThreshold", "DeathRating", "UnconsciousnessRating",
                       "RecoveryTests", "Initiative", "Movement", "CarryingCapacity"},
    "armor": {"Physical", "Mystic"},  # no Social Armor
    "resource": {"Karma", "Legend", "Strain", "Recoveries"},
    "sense": {"HeatSight", "LowLightVision", "AstralSight"},
}
TEST_CORE_NAMES = {"Action", "Attack", "Damage", "Effect", "Initiative"}
# The taxonomy lets a test target be "a named ability". These are the named
# abilities / skill- or attribute-backed tests the equipment chapter needs.
EXTRA_TEST_NAMES = {
    "Astral Sensing", "Astral Sight", "Alchemy", "Wilderness Survival", "Perception",
    "Emotion Song", "Recovery", "Knockdown", "Spellcasting", "Strength", "Toughness",
}
# `attack-modifier` targets the generic attack-surface names; natural attacks
# (`grant-attack`) stay free-form (tail, horns, claws, ...).
ATTACK_MODIFIER_NAMES = {"Damage", "Attack"}
OPERATIONS = {"add", "subtract", "multiply", "divide", "set", "min", "max", "ref"}
MEASURES = {"value", "step", "result", "rating", "rank", "dice", "points", "yards", "count"}
SOURCES = {
    "race", "discipline", "talent", "skill", "knack", "item", "blood-magic",
    "spell", "thread", "trait", "condition", "horror",
}
CONDITIONS = {"always", "situational", "on-success"}
KINDS = {"armor", "shield", "weapon", "ammunition", "blood-charm", "healing-aid",
         "magic-item", "gear"}
KIND_ORDER = ["weapon", "ammunition", "blood-charm", "healing-aid", "magic-item", "gear"]

# ---------------------------------------------------------------------------
# Emission helpers — dicts are built in the exact key order the JSON uses.
# ---------------------------------------------------------------------------

def tm(target_domain, target_name, op, value, measure, condition, scope, summary,
       duration=None, stacking=None, gm=False, note=None, operation=None):
    """A numeric taxonomy modifier effect, in canonical field order."""
    d = {"type": "test-modifier", "target": {"domain": target_domain, "name": target_name}}
    d["operation"] = op
    d["value"] = value
    d["measure"] = measure
    d["condition"] = condition
    if scope:
        d["scope"] = scope
    if duration:
        d["duration"] = duration
    if stacking:
        d["stacking"] = stacking
    if gm:
        d["gmDiscretion"] = True
    d["source"] = "item"
    if note:
        d["note"] = note
    d["summary"] = summary
    return d


def mod(etype, target_domain, target_name, op, value, measure, condition, scope,
        summary, duration=None, stacking=None, gm=False):
    """A typed modifier (armor/defense/characteristic/test/...) in field order."""
    d = {"type": etype, "target": {"domain": target_domain, "name": target_name}}
    d["operation"] = op
    d["value"] = value
    d["measure"] = measure
    d["condition"] = condition
    if scope:
        d["scope"] = scope
    if duration:
        d["duration"] = duration
    if stacking:
        d["stacking"] = stacking
    if gm:
        d["gmDiscretion"] = True
    d["source"] = "item"
    d["summary"] = summary
    return d


def note(condition, summary, scope=None, gm=False):
    """A `note` effect (non-numeric / one-shot / activated property)."""
    d = {"type": "note", "condition": condition}
    if scope:
        d["scope"] = scope
    if gm:
        d["gmDiscretion"] = True
    d["source"] = "item"
    d["summary"] = summary
    return d


def sense(target_name, summary, condition="always", scope=None):
    d = {"type": "sense", "target": {"domain": "sense", "name": target_name},
         "condition": condition}
    if scope:
        d["scope"] = scope
    d["source"] = "item"
    d["summary"] = summary
    return d


def grant_ability(ability_name, summary, rank=0, note_text=None):
    d = {"type": "grant-ability", "target": {"domain": "ability", "name": ability_name},
         "operation": "set", "value": rank, "measure": "rank",
         "condition": "always"}
    d["source"] = "item"
    if note_text:
        d["note"] = note_text
    d["summary"] = summary
    return d

# ---------------------------------------------------------------------------
# Source parsing
# ---------------------------------------------------------------------------

PAGE_PREFIX = re.compile(r"^\d{3,4}(?=[A-Za-z])")
NUMTOK = re.compile(r"^(?:-|\d+(?:-\d+)?(?:\*\*?)?)$")
COST_RE = re.compile(r"^\d[\d,]*(?:-\d+)?(?:cp)?$")
WEIGHT_RE = re.compile(r"^\d+(?:-\d+)?(?:oz|lb)?\+?$")
AVAIL_RE = re.compile(r"^[A-Za-z]+(?: [A-Za-z]+)?$")
# A row whose cost is glued onto the tail of a reflowed name, e.g.
# "...large sack15 14 Average" -> name ends "...large sack", cost "15".
GLUED = re.compile(
    r"^(?P<name>.*?[^0-9 ])(?P<cost>\d[\d,]*)\s+(?P<weight>\S+)\s+"
    r"(?P<avail>[A-Za-z]+(?: [A-Za-z]+)?)$"
)
# Equipment-table group headers ("Chain:", "Artisan Tools:", ...).
GROUP_HEADER = re.compile(r"^([A-Za-z ]+):$")


def is_cost(tok):
    return bool(COST_RE.fullmatch(tok))


def is_weight(tok):
    return bool(WEIGHT_RE.fullmatch(tok)) or tok in {"NA", "Neg.", "Neg", "—"}


def is_avail(tok):
    return bool(AVAIL_RE.fullmatch(tok))


def norm_avail(tok):
    return tok[0].lower() + tok[1:] if tok else tok


def norm_cost(tok):
    """Silver as an int, cp as a string "N cp", ranges as a string."""
    if isinstance(tok, int):
        return tok
    if tok.endswith("cp"):
        return "%s cp" % tok[:-2]
    if "-" in tok or "," in tok:
        return tok
    return int(tok)


def norm_weight(tok):
    """Bare numbers are pounds; keep units / placeholders as-is."""
    if tok in {"NA", "Neg.", "Neg", "—"}:
        return tok
    m = re.fullmatch(r"(\d+)(?:-(\d+))?(oz|lb)?\+?", tok)
    if not m:
        return tok
    low, high, unit = m.group(1), m.group(2), m.group(3) or "lb"
    num = "%s-%s" % (low, high) if high else low
    return "%s %s" % (num, unit) if unit else num


def clean_line(line):
    line = line.strip()
    line = PAGE_PREFIX.sub("", line)
    line = line.replace("\u2019", "'")
    return line.strip()


def find_block(text, start_header, end_header):
    """Return the block starting at the table-shaped occurrence of start_header.

    The extract repeats some headers in prose (e.g. "Throwing Weapons Table."
    appears in a discussion) and again in an appendix; pick the occurrence whose
    early lines actually parse as table rows."""
    candidates = []
    start = 0
    while True:
        si = text.find(start_header, start)
        if si < 0:
            break
        ei = text.find(end_header, si)
        if ei >= 0:
            candidates.append((si, ei))
        start = si + 1
    for si, ei in candidates:
        block = text[si:ei]
        hits = 0
        for line in block.splitlines()[:12]:
            tokens = clean_line(line).split()
            if not tokens:
                continue
            if (parse_3col(tokens) is not None
                    or parse_weapon_row(tokens, 6) is not None
                    or parse_weapon_row(tokens, 8) is not None):
                hits += 1
        if hits >= 3:
            return block
    raise SystemExit("No table-shaped occurrence found for %r -> %r"
                     % (start_header, end_header))


def parse_3col(tokens):
    """name cost weight avail  (three numeric columns after the name).

    Availability may be one word ("Rare") or two ("Very Rare"); try the
    two-word reading first so the columns line up correctly."""
    if len(tokens) < 4:
        return None
    if len(tokens) >= 5:
        avail, weight, cost = tokens[-2], tokens[-3], tokens[-4]
        if is_avail(" ".join(tokens[-2:])) and is_weight(weight) and is_cost(cost):
            return {"name": " ".join(tokens[:-4]).strip(), "cost": cost,
                    "weight": weight, "availability": " ".join(tokens[-2:])}
    avail, weight, cost = tokens[-1], tokens[-2], tokens[-3]
    if not (is_avail(avail) and is_weight(weight) and is_cost(cost)):
        return None
    name = " ".join(tokens[:-3]).strip()
    if not name:
        return None
    return {"name": name, "cost": cost, "weight": weight, "availability": avail}


def parse_weapon_row(tokens, arity):
    """Weapon row: name + [dmg strmin size (sr lr)] cost weight avail.
    arity 6 = melee, 8 = missile/throwing. Returns None if not a weapon row."""
    if len(tokens) < arity + 1:
        return None
    avail, weight, cost = tokens[-1], tokens[-2], tokens[-3]
    if not (is_avail(avail) and is_weight(weight) and is_cost(cost)):
        return None
    cols = tokens[-arity:-3]
    if len(cols) != arity - 3 or not all(NUMTOK.fullmatch(c) for c in cols):
        return None
    name = " ".join(tokens[:-arity])
    if not name:
        return None
    return {"name": name, "cols": cols, "cost": cost, "weight": weight,
            "availability": avail}


def table_rows(block):
    """Yield cleaned, page-number-stripped non-empty lines from a block."""
    for line in block.splitlines():
        line = clean_line(line)
        if line:
            yield line


# ---------------------------------------------------------------------------
# Table definitions (live-parsed)
# ---------------------------------------------------------------------------

# kind -> (start_header, end_header) for the simple name/cost/weight/avail tables
SIMPLE_TABLES = {
    "magic-item": ("Common Magic Item Table", "Blood Charm Table"),
    "blood-charm": ("Blood Charm Table", "Healing Aid Table"),
    "healing-aid": ("Healing Aid Table", "Adventuring Equipment Table"),
}
WEAPON_TABLES = [
    ("Melee Weapons Table", "Missile Weapons Table", "melee", 6),
    ("Missile Weapons Table", "Throwing Weapons Table", "missile", 8),
    ("Throwing Weapons Table", "Armor Table", "throwing", 8),
]

# DEX minimums carried by the tables' footnotes, keyed by item name.
DEX_MIN = {
    "Flail": 7, "Quarterstaff": 7, "Sap": 7, "Whip": 7,          # melee **
    "Elven Warbow": 15, "Longbow": 13,                            # missile *
    "Bola": 9, "Net": 9, "Windling Net": 9,                       # throwing *
}
# Entangling weapons: (Entangling Difficulty, note text) — whip/bola from the
# descriptions (ED 9), nets ED 12 (Throwing Weapons, p. 391).
ENTANGLE = {
    "Whip": (9, "Entangling weapon: may entangle an opponent up to 3 yards away (Entangling Difficulty 9)."),
    "Bola": (9, "Entangling weapon: after inflicting damage, may also entangle the target (Entangling Difficulty 9)."),
    "Net": (12, "Entangling weapon (Entangling Difficulty 12)."),
    "Windling Net": (12, "Entangling weapon; captures creatures windling-size and smaller (Entangling Difficulty 12)."),
}

# ---------------------------------------------------------------------------
# Adventuring Equipment Table (p.438-439) — transcribed constant.
# The prose reflow (multi-line rows, cost glued to the name, group headers)
# makes line parsing unreliable; this is the faithful, auditable equivalent.
# Each entry: (name, cost, weight, availability). Source lines noted.
# ---------------------------------------------------------------------------
# noqa: E501
EQUIPMENT = [
    # 17650-17651
    ("Adventuring Kit", 15, "14", "average"),
    # 17652 "As above, with tent"
    ("Adventuring Kit (with tent)", 40, "34", "average"),
    # 17654
    ("Alchemist's Kit", 500, "15", "unusual"),
    # 17655
    ("Alchemist's Shop", 2000, "NA", "unusual"),
    # 17656-17661 Artisan Tools group
    ("Artisan Tools: Carving", 15, "3", "average"),
    ("Artisan Tools: Embroidery/Sewing", 25, "1", "average"),
    ("Artisan Tools: Forge", 100, "20", "unusual"),
    ("Artisan Tools: Painting", 45, "2", "average"),
    ("Artisan Tools: Sculpting", 30, "3", "average"),
    # 17662-17666
    ("Backpack", 5, "3", "average"),
    ("Bedroll", 5, "4", "average"),
    ("Belt Pouch", "8cp", "1", "everyday"),
    ("Blanket", "15cp", "2", "everyday"),
    ("Candle", "3cp", "4oz", "everyday"),
    # 17667-17669 Chain group
    ("Heavy Chain (10ft)", 50, "9", "average"),
    ("Light Chain (10ft)", 10, "6", "average"),
    # 17670
    ("Chalk (5 pieces)", "3cp", "4oz", "everyday"),
    # 17671-17672
    ("Climbing Kit", 36, "19", "average"),
    # 17673
    ("Craftsman Tools", 25, "5", "average"),
    # 17674
    ("Disguise Kit", 50, "6", "average"),
    # 17675-17676
    ("Fishing Kit", 20, "14", "average"),
    # 17677
    ("Fishing Net (30 sq ft)", 15, "10", "average"),
    # 17678
    ("Flint and Steel", 1, "8oz", "everyday"),
    # 17679
    ("Grappling Hook", 10, "5", "average"),
    # 17680-17681 Healing Kit group
    ("Healing Kit: Basic (3 applications)", 75, "5", "unusual"),
    ("Healing Kit: Refill (3 applications)", 50, "Neg.", "unusual"),
    # 17682
    ("Iron Pot", 20, "8", "average"),
    # 17683-17686 Lantern group
    ("Lantern: Hooded", 9, "3", "average"),
    ("Lantern: Bullseye", 27, "3", "average"),
    ("Lantern: Light Quartz", 85, "5", "unusual"),
    # 17687
    ("Map or Scroll Case", "8cp", "1", "average"),
    # 17689-17694 Musical Instrument group
    ("Musical Instrument: Drum", 7, "5", "average"),
    ("Musical Instrument: Flute", 2, "2", "average"),
    ("Musical Instrument: Horn", 70, "7", "average"),
    ("Musical Instrument: Lute", 25, "6", "unusual"),
    ("Musical Instrument: Whistle", "2cp", "1", "everyday"),
    # 17695
    ("Navigation Charts", 15, "2", "average"),
    # 17696
    ("Oil Flask", 6, "1", "everyday"),
    # 17697
    ("Paper/Parchment (sheet)", 1, "Neg.", "unusual"),
    # 17698-17699 Physician's Kit group
    ("Physician's Kit: Basic (3 applications)", 50, "3", "average"),
    ("Physician's Kit: Refill (3 applications)", 25, "1", "average"),
    # 17701
    ("Quill Pen", 1, "Neg.", "average"),
    # 17702
    ("Rope (per yard)", 3, "1", "average"),
    # 17703
    ("Sack", 2, "2", "everyday"),
    # 17704
    ("Tent", 30, "20", "average"),
    # 17705
    ("Thieves' Picks and Tools", 100, "1", "unusual"),
    # 17706
    ("Torch", "5cp", "1", "everyday"),
    # 17707
    ("Whetstone", "2cp", "1", "everyday"),
    # 17708
    ("Water or Wine Skin", 2, "4", "everyday"),
    # 17709
    ("Writing Ink (per vial)", 10, "8oz", "unusual"),
    # 17710-17712
    ("Writing Kit", 23, "2", "unusual"),
]

# ---------------------------------------------------------------------------
# Curated effects — hand-authored from the item descriptions in the chapter.
# Keys match the table names exactly. Item kinds with a mechanic that is
# always-on and numeric get typed modifiers; the rest are `note`/empty.
# ---------------------------------------------------------------------------

# Blood charms (Blood Charm Descriptions, p.416-418; EDN in the table).
BLOOD_CHARM_EFFECTS = {
    "Absorb Blow": [
        note("situational",
             "Absorbs the first 12 Damage Points inflicted on the character, then the charm is destroyed. Cannot be used if Surprised or Blindsided.",
             scope="on activation"),
        note("situational",
             "Implant causes 2 Blood Magic Damage that cannot be healed until the charm is used or destroyed."),
    ],
    "Astral-Sensitive Eye": [
        grant_ability("Astral Sight",
                      "Sees into astral space as if possessing the Astral Sight talent.",
                      note_text="as if possessing the talent"),
        mod("test-modifier", "test", "Astral Sensing", "add", 1, "result", "situational",
            "uses Perception step", "+1 to Astral Sensing tests (using Perception step)."),
        mod("test-modifier", "test", "Astral Sight", "add", 1, "result", "situational",
            "if the character knows the Astral Sight talent",
            "+1 to Astral Sight tests if the talent is known."),
        note("situational",
             "Takes 1 Strain each time the eye is used. Implant destroys the eye and causes 2 permanent damage that can never be healed; the charm can never be removed."),
    ],
    "Bone Charm": [
        mod("characteristic-modifier", "characteristic", "RecoveryTests", "add", 1, "count",
            "always", None, "+1 Recovery test."),
        note("situational",
             "Implant causes 1 Blood Magic Damage that cannot be healed while the charm is worn."),
    ],
    "Darksight Eye": [
        sense("LowLightVision", "Sees in the dark as if possessing Low Light Vision."),
        note("situational",
             "No benefit if the character already has Low Light Vision. Implant destroys the eye and causes 2 permanent damage that can never be healed; the charm can never be removed."),
    ],
    "Death Cheat": [
        mod("test-modifier", "test", "Recovery", "add", 6, "result", "situational",
            "upon the character's death",
            "Upon death, allows a Recovery test with a +6 bonus (or a bonus Step 6 Recovery test if none remain); if the result brings damage below Death Rating the character lives. Used once, then inert."),
        note("situational",
             "Implant causes 3 Blood Magic Damage that cannot be healed until the charm is used."),
    ],
    "Desperate Blow": [
        mod("test-modifier", "test", "Attack", "add", 6, "result", "situational",
            "on activation; chosen by the character", "+6 to an Attack test on activation."),
        mod("test-modifier", "test", "Damage", "add", 6, "result", "situational",
            "on activation; chosen by the character", "+6 to a Damage test on activation."),
        note("situational",
             "May be recharged after use (requires healing the implant damage first). Implant causes 3 Blood Magic Damage."),
    ],
    "Desperate Spell": [
        mod("test-modifier", "test", "Spellcasting", "add", 6, "result", "situational",
            "on activation; chosen by the character", "+6 to a Spellcasting test on activation."),
        mod("test-modifier", "test", "Effect", "add", 6, "result", "situational",
            "on activation; chosen by the character", "+6 to a spell Effect test on activation."),
        note("situational",
             "May be recharged after use (requires healing the implant damage first). Implant causes 3 Blood Magic Damage."),
    ],
    "Garlen Stone": [
        note("situational",
             "For 2 Strain, may spend one available Recovery test to heal a Wound instead of healing Damage Points. Cannot be used again until all Wounds and Damage are healed, and never twice in the same day.",
             scope="for 2 Strain"),
        note("situational",
             "Swallowing causes 4 permanent damage that can never be healed; the stone cannot be removed."),
    ],
    "Horn Needle": [
        mod("test-modifier", "test", "Toughness", "add", 3, "result", "situational",
            "Toughness-based tests to resist poison or disease",
            "+3 to Toughness-based tests while resisting poison or disease."),
        mod("defense-modifier", "defense", "Mystic", "add", 3, "rating", "situational",
            "when resisting poison or disease",
            "+3 Mystic Defense against poison and disease."),
        note("situational", "Costs 2 Strain per use. Implant causes 3 Blood Magic Damage."),
    ],
    "Horror Fend": [
        mod("defense-modifier", "defense", "Physical", "add", 3, "rating", "situational",
            "vs Horrors and Horror constructs; 1 Strain per round",
            "+3 Physical Defense against Horrors and Horror constructs."),
        mod("defense-modifier", "defense", "Mystic", "add", 3, "rating", "situational",
            "vs Horrors and Horror constructs; 1 Strain per round",
            "+3 Mystic Defense against Horrors and Horror constructs."),
        note("situational",
             "Costs 1 Strain per round while in use; the charm falls inert when not used and may be reattached (requires healing the implant damage first). Implant causes 3 Blood Magic Damage."),
    ],
    "Initiative Booster": [
        mod("test-modifier", "test", "Initiative", "add", 1, "result", "situational",
            "per point of Strain taken, declared before the test",
            "+1 to the Initiative test for each point of Strain taken (declared before the test)."),
        note("situational", "Implant causes 4 Blood Magic Damage."),
    ],
    "Strength Booster": [
        mod("test-modifier", "test", "Strength", "add", 1, "result", "situational",
            "per 2 Strain taken; not Damage tests",
            "+1 to Strength tests for every 2 Strain taken. Cannot augment Damage tests."),
        note("situational", "Implant causes 2 Blood Magic Damage."),
    ],
    "Targeting Eye": [
        mod("test-modifier", "test", "Attack", "add", 2, "result", "situational",
            "next ranged combat Attack test; 1 Strain",
            "+2 to the next ranged combat Attack test (1 Strain). May be used multiple times per round."),
        note("situational",
             "Implant destroys the eye and causes 2 permanent damage that can never be healed; the charm can never be removed."),
    ],
    "Wound Balance": [
        mod("test-modifier", "test", "Knockdown", "add", 3, "result", "situational",
            "Knockdown test; 1 Strain", "+3 to a Knockdown test (1 Strain)."),
        note("situational", "Implant causes 3 Blood Magic Damage."),
    ],
}

# Healing aids (Healing Aid Descriptions, p.423; EDN in the table).
HEALING_AID_EFFECTS = {
    "Booster Potion": [
        mod("test-modifier", "test", "Recovery", "add", 8, "result", "situational",
            "next Recovery test within 24 hours",
            "+8 to the next Recovery test made within 24 hours."),
    ],
    "Cure Disease Potion": [
        mod("test-modifier", "test", "Action", "add", 5, "result", "situational",
            "tests to resist disease, for 24 hours",
            "+5 to any tests made to resist the effects of a disease for 24 hours."),
        note("situational", "Grants a new Resistance test against a disease already contracted."),
    ],
    "Halt Illness Potion": [
        note("situational",
             "Stops a disease's progression for 8 hours; effects caused before ingestion remain in effect.",
             scope="8 hours"),
    ],
    "Healing Potion": [
        mod("test-modifier", "test", "Recovery", "add", 8, "result", "situational",
            "next Recovery test within 24 hours",
            "+8 to the next Recovery test made within 24 hours."),
        note("situational",
             "Automatically heals 1 Wound. If no Recovery tests remain, may make an immediate Step 8 Recovery test instead."),
    ],
    "Kelia's Antidote": [
        note("situational",
             "Neutralizes the effects of poison for 8 hours; effects caused before ingestion remain.",
             scope="8 hours"),
    ],
    "Kelix's Poultice": [
        mod("test-modifier", "test", "Action", "add", 5, "result", "situational",
            "tests to resist poison",
            "+5 to any tests made to resist the effects of poison."),
        note("situational",
             "Grants a new Resistance test. The bonus is +3 instead of +5 if no wound exists to apply the poultice to."),
    ],
    "Last Chance Salve": [
        note("situational",
             "Revives a character dead for no more hours than the higher of their Toughness or Willpower step: the character may take all remaining Recovery tests (or a bonus one if none remain); if damage drops below Death Rating the character returns to life. Multiple salves may be applied, but only one is effective in any hour.",
             scope="on a dead character"),
    ],
    "Salve of Closure": [
        note("situational",
             "Automatically heals any Wound it is applied to, costing one Recovery test (no effect if none remain).",
             scope="on application; costs 1 Recovery test"),
    ],
}

# Common magic items (Common Magic Item Descriptions, p.418-422).
MAGIC_ITEM_EFFECTS = {
    "Bedroll of Comfort": [note("situational",
                               "Magically changes temperature to keep the user comfortable while sleeping.")],
    "Boots, Dry": [note("situational", "Repels outside moisture to keep the wearer's feet dry.")],
    "Boots, Huntsman": [note("situational",
                             "Keeps the wearer's feet warm and dry and lets him walk an additional five miles each day.")],
    "Cleaning Broom": [note("situational",
                           "Captures all loose dust and dirt with which it comes in contact; a command word dumps the collected dust.")],
    "Cloak, Dwarf Winternight": [
        mod("armor-modifier", "armor", "Physical", "add", 2, "rating", "situational",
            "vs cold damage from spells, ice weapons, or other cold sources",
            "+2 Physical Armor against cold damage."),
        mod("armor-modifier", "armor", "Mystic", "add", 2, "rating", "situational",
            "vs cold damage from spells, ice weapons, or other cold sources",
            "+2 Mystic Armor against cold damage."),
    ],
    "Cloak, Everclean": [note("situational",
                             "Repels dirt and oils, staying clean for extended periods.")],
    "Cloak, Warm": [note("situational",
                        "Keeps the wearer warm when outdoor temperatures drop.")],
    "Divining Rod": [
        mod("test-modifier", "test", "Wilderness Survival", "add", 3, "result", "situational",
            "tests to locate water", "+3 to Wilderness Survival tests to locate water."),
    ],
    "Elfweave Robe": [note("situational",
                          "Fine, delicate garments that never seem to wear or grow old.")],
    "Fire Starter": [note("situational",
                         "Short wand that produces a small flame at one end on a spoken command word.")],
    "Firefly Chalk (per stick)": [note("situational",
                                       "Writes glowing script readable in all lighting conditions; more than five words provides low-light illumination.")],
    "Heat Stone": [note("situational", "Provides steady heat like a burning coal for about a year.")],
    "Hot Pot": [note("situational",
                    "Ceramic cooking pot woven with True Fire; heats without fire (command word), but temperature cannot be regulated.")],
    "Light Quartz, Small": [
        note("situational", "Magical light source, dimmed or turned on and off by command; the enchantment must be renewed annually."),
    ],
    "Light Quartz, Medium": [
        note("situational", "Magical light source, dimmed or turned on and off by command; the enchantment must be renewed annually."),
    ],
    "Light Quartz, Large": [
        note("situational", "Magical light source, dimmed or turned on and off by command; the enchantment must be renewed annually."),
    ],
    "Light Quartz Weapon": [
        note("situational", "Weapon with a light quartz crystal in the hilt, used as a light source (about half as effective as a standard light quartz); the enchantment must be renewed annually."),
    ],
    "Message Stone": [
        note("situational", "Captures sound within its crystalline structure and releases it on command."),
    ],
    "Message Stone (warded)": [
        note("situational", "As a message stone, with wards protecting the message against tampering."),
    ],
    "One-Size Hat": [note("situational",
                         "Minor magic makes the hat fit any head perfectly; any race, including obsidimen and t'skrang, can wear it.")],
    "Orichalcum Container": [
        note("situational", "Small container that holds up to twenty kernels of a True Element."),
    ],
    "Pot of Grumbah, Small": [
        note("situational", "Airtight and cold; triples the time the contents remain fresh before decaying."),
    ],
    "Pot of Grumbah, Large": [
        note("situational", "Airtight and cold; triples the time the contents remain fresh before decaying."),
    ],
    "Pure Water Pot": [
        note("situational", "Casts the Purify Water spell (Spellcasting/Effect Step 8/2D6) on any liquid placed in it."),
    ],
    "Quiet Fingers Gloves": [
        note("situational", "+1 to the Difficulty Number for Perception tests to detect the wearer while picking a lock or pocket; works only while actively using the hands."),
    ],
    "Quiet Pouch": [note("situational",
                        "Silencing illusions woven into the fabric prevent noise from emerging (e.g. the jingling of coins).")],
    "Season Lamp": [note("situational",
                        "Woven with True Air and fire; alternately warms or cools the room to a constant temperature regardless of the weather outside.")],
    "Traveler's Mug": [
        note("situational", "Fills once per day with cool fresh water on command."),
    ],
    "Upandal's Blessings": [
        note("situational", "On a failed Craftsman or Artisan test, may immediately erase the mistake and make a second test. Crafting magical items requires a Craftsman/Artisan test vs the item's Mystic Defense."),
    ],
    "Wind Instrument": [
        mod("test-modifier", "test", "Emotion Song", "add", 1, "result", "situational",
            "if the musician possesses the talent or skill", "+1 to Emotion Song tests."),
        mod("test-modifier", "test", "Action", "add", 1, "result", "situational",
            "tests to determine how well he plays the instrument",
            "+1 to other Action tests made to determine how well he plays."),
    ],
}

# Adventuring equipment (Equipment Descriptions, p.424-426).
GEAR_EFFECTS = {
    "Adventuring Kit": [
        note("always", "Backpack, bedroll, flint and steel, torch, waterskin, and large sack."),
    ],
    "Adventuring Kit (with tent)": [
        note("always", "Backpack, bedroll, flint and steel, torch, waterskin, large sack, and tent."),
    ],
    "Alchemist's Kit": [
        mod("test-modifier", "test", "Alchemy", "subtract", 3, "result", "situational",
            "Alchemy tests", "-3 to Alchemy tests."),
    ],
    "Alchemist's Shop": [
        note("always", "Complete alchemy lab (glassware, mortars, jars, burners, crucibles); not portable."),
    ],
    "Artisan Tools: Carving": [],
    "Artisan Tools: Embroidery/Sewing": [],
    "Artisan Tools: Forge": [],
    "Artisan Tools: Painting": [],
    "Artisan Tools: Sculpting": [],
    "Backpack": [note("always", "Standard backpack holds approximately 50 pounds of goods.")],
    "Bedroll": [],
    "Belt Pouch": [note("always", "Typically holds approximately 5 pounds of goods.")],
    "Blanket": [],
    "Candle": [note("always", "Illuminates a 3-yard radius.")],
    "Heavy Chain (10ft)": [
        note("always", "Binding/climbing chain; a bound character breaks free with a successful Strength (14) test. Obsidimen and trolls require the heavy version when climbing."),
    ],
    "Light Chain (10ft)": [
        note("always", "Binding/climbing chain; a bound character breaks free with a successful Strength (11) test."),
    ],
    "Chalk (5 pieces)": [],
    "Climbing Kit": [
        note("always", "Rope (20 ft), light chain (10 ft), 2 pitons, and a grappling hook."),
    ],
    "Craftsman Tools": [note("always", "Required to use the Craftsman skill.")],
    "Disguise Kit": [note("always", "Essential for using the Disguise skill.")],
    "Fishing Kit": [
        note("always", "10 fish hooks, fishing net, fishing rod, and bait jar; used with the Wilderness Survival skill."),
    ],
    "Fishing Net (30 sq ft)": [],
    "Flint and Steel": [],
    "Grappling Hook": [
        note("always", "May be thrown with a Throwing Weapons test (DN usually 7); requires the Called Shot combat option to hit the intended location."),
    ],
    "Healing Kit: Basic (3 applications)": [
        mod("test-modifier", "test", "Recovery", "add", 1, "result", "situational",
            "next Recovery test after at least 10 minutes of treatment",
            "+1 to the next Recovery test after at least ten minutes of treatment."),
        note("always", "Contains enough supplies for three applications."),
    ],
    "Healing Kit: Refill (3 applications)": [
        note("always", "Refill of three applications for a healing kit; requires the basic components to be useful."),
    ],
    "Iron Pot": [],
    "Lantern: Hooded": [note("always", "Illuminates a 10-yard-radius area.")],
    "Lantern: Bullseye": [
        note("always", "Focuses light into a 2-yard-wide beam that extends to 20 yards."),
    ],
    "Lantern: Light Quartz": [
        note("always", "Provides illumination equivalent to a hooded lantern."),
    ],
    "Map or Scroll Case": [],
    "Musical Instrument: Drum": [],
    "Musical Instrument: Flute": [],
    "Musical Instrument: Horn": [],
    "Musical Instrument: Lute": [],
    "Musical Instrument: Whistle": [],
    "Navigation Charts": [
        note("always", "Map and scroll case with a basic star chart; required to use the Navigation talent."),
    ],
    "Oil Flask": [note("always", "Holds enough oil to fuel a lantern for eight hours.")],
    "Paper/Parchment (sheet)": [],
    "Physician's Kit: Basic (3 applications)": [
        note("always", "Required to use the Physician skill; can be used three times before its consumable supplies are exhausted."),
    ],
    "Physician's Kit: Refill (3 applications)": [
        note("always", "Refill of three applications for a physician's kit; requires the tools from the basic kit to be useful."),
    ],
    "Quill Pen": [],
    "Rope (per yard)": [
        note("always", "Binding/climbing rope; a bound character breaks free with a successful Strength (8) test."),
    ],
    "Sack": [note("always", "Holds approximately 30 pounds of goods.")],
    "Tent": [],
    "Thieves' Picks and Tools": [
        note("always", "Required to use the Lock Picking skill."),
    ],
    "Torch": [
        note("always", "Illuminates a 10-yard radius; unlit may be used as an improvised club; a lit torch may set flammable targets alight."),
    ],
    "Whetstone": [],
    "Water or Wine Skin": [
        note("always", "A typical skin holds enough water for one day (the weight shown is for a full skin)."),
    ],
    "Writing Ink (per vial)": [
        note("always", "Each vial holds enough ink for eight to ten pages."),
    ],
    "Writing Kit": [
        note("always", "Quill pen, writing ink, 10 sheets of parchment or paper, 2 candles, and 10 pieces of chalk."),
    ],
}

# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------

def weapon_damage_effect(category, dmg):
    dmg = dmg.rstrip("*")
    if dmg in (None, "-"):
        return []
    if category == "melee":
        return [mod("attack-modifier", "attack", "Damage", "add", int(dmg), "step", "always",
                    None, "Melee damage: Strength step + %s." % dmg)]
    if category == "missile":
        return [mod("attack-modifier", "attack", "Damage", "add", int(dmg), "step", "always",
                    None, "Missile damage: Strength step + %s." % dmg)]
    return [mod("attack-modifier", "attack", "Damage", "add", int(dmg), "step", "always",
                None, "Thrown damage: Strength step + %s." % dmg)]


def strmin_value(tok):
    """STR Min token: strip footnote markers; keep ranges as strings."""
    tok = tok.rstrip("*")
    return int(tok) if tok.isdigit() else tok


def size_value(tok):
    tok = tok.rstrip("*")
    return int(tok) if tok.isdigit() else tok


def build_weapon_ref(category, row):
    """ref for a parsed weapon row (arity 6 melee or 8 missile/throwing)."""
    r = {"cost": norm_cost(row["cost"]),
         "weight": norm_weight(row["weight"]),
         "availability": norm_avail(row["availability"]),
         "category": category}
    name = row["name"]
    if category == "melee":
        dmg, strmin, size = row["cols"]
    else:
        dmg, strmin, size, sr, lr = row["cols"]
    if strmin not in ("-", ""):
        r["strMin"] = strmin_value(strmin)
    if name in DEX_MIN:
        r["dexMin"] = DEX_MIN[name]
    if size not in ("-", ""):
        r["size"] = size_value(size)
    if dmg != "-":
        r["damageStep"] = int(dmg.rstrip("*"))
    if category != "melee":
        r["shortRange"] = sr
        r["longRange"] = lr
    if name in ENTANGLE:
        r["entangle"] = {"difficulty": ENTANGLE[name][0]}
    return r


def parse_weapon_tables(text):
    items = {}
    for start, end, category, arity in WEAPON_TABLES:
        block = find_block(text, start, end)
        for line in table_rows(block):
            tokens = line.split()
            row = parse_weapon_row(tokens, arity)
            if row is None:
                # Missile-table ammo rows: "20 Arrows 25 4 Rare".
                ammo = parse_3col(tokens)
                if ammo:
                    items[ammo["name"]] = {
                        "kind": "ammunition",
                        "ref": {"cost": norm_cost(ammo["cost"]),
                                "weight": norm_weight(ammo["weight"]),
                                "availability": norm_avail(ammo["availability"])},
                        "effects": [],
                    }
                continue
            name = row["name"]
            if name == "Quiver":
                items[name] = {
                    "kind": "gear",
                    "ref": {"cost": norm_cost(row["cost"]),
                            "weight": norm_weight(row["weight"]),
                            "availability": norm_avail(row["availability"])},
                    "effects": [note("always", "Typical quiver holds 40 arrows or 30 bolts.")],
                }
                continue
            ref = build_weapon_ref(category, row)
            effects = weapon_damage_effect(category, row["cols"][0])
            if name in ENTANGLE:
                effects.append(note("situational", ENTANGLE[name][1]))
            items[name] = {"kind": "weapon", "ref": ref, "effects": effects}
    return items


def parse_simple_tables(text, effects_map, kind):
    items = {}
    start, end = SIMPLE_TABLES[kind]
    block = find_block(text, start, end)
    for line in table_rows(block):
        row = parse_3col(line.split())
        if row is None:
            continue
        name = row["name"]
        ref = {"cost": norm_cost(row["cost"]),
               "weight": norm_weight(row["weight"]),
               "availability": norm_avail(row["availability"])}
        if kind in ("blood-charm", "healing-aid"):
            ref["edn"] = int(EDN[row["name"]])
        items[name] = {"kind": kind, "ref": ref,
                       "effects": list(effects_map.get(name, []))}
    return items


def parse_equipment():
    items = {}
    for name, cost, weight, avail in EQUIPMENT:
        items[name] = {
            "kind": "gear",
            "ref": {"cost": norm_cost(cost), "weight": norm_weight(weight),
                    "availability": norm_avail(avail)},
            "effects": list(GEAR_EFFECTS.get(name, [])),
        }
    return items


# Alchemy-crafting EDNs from the Blood Charm and Healing Aid tables (the value
# in parentheses on each description line, e.g. "Absorb Blow (EDN 10)").
EDN = {
    "Absorb Blow": 10, "Astral-Sensitive Eye": 14, "Bone Charm": 11,
    "Darksight Eye": 9, "Death Cheat": 12, "Desperate Blow": 10,
    "Desperate Spell": 11, "Garlen Stone": 13, "Horn Needle": 12,
    "Horror Fend": 13, "Initiative Booster": 15, "Strength Booster": 11,
    "Targeting Eye": 12, "Wound Balance": 12,
    "Booster Potion": 7, "Cure Disease Potion": 11, "Halt Illness Potion": 8,
    "Healing Potion": 12, "Kelia's Antidote": 8, "Kelix's Poultice": 7,
    "Last Chance Salve": 13, "Salve of Closure": 10,
}


def parse_all(text):
    items = {}
    items.update(parse_weapon_tables(text))
    for kind in ("blood-charm", "healing-aid", "magic-item"):
        items.update(parse_simple_tables(text, {
            "blood-charm": BLOOD_CHARM_EFFECTS,
            "healing-aid": HEALING_AID_EFFECTS,
            "magic-item": MAGIC_ITEM_EFFECTS,
        }[kind], kind))
    items.update(parse_equipment())
    return items


# ---------------------------------------------------------------------------
# Taxonomy validation
# ---------------------------------------------------------------------------

def validate_effect(effect, item_name):
    etype = effect.get("type")
    if etype not in EFFECT_TYPES:
        raise ValueError("%s: unknown effect type %r" % (item_name, etype))
    if "summary" not in effect or not str(effect["summary"]).strip():
        raise ValueError("%s: effect missing a summary (%r)" % (item_name, etype))
    cond = effect.get("condition", "always")
    if cond not in CONDITIONS and not (isinstance(cond, dict) and "trigger" in cond):
        raise ValueError("%s: bad condition %r" % (item_name, cond))
    if effect.get("source", "item") not in SOURCES:
        raise ValueError("%s: bad source %r" % (item_name, effect.get("source")))
    if effect.get("gmDiscretion") not in (None, True, False):
        raise ValueError("%s: gmDiscretion must be boolean" % item_name)

    if etype in MODIFIER_TYPES:
        target = effect.get("target")
        if not target:
            raise ValueError("%s: %s needs a target" % (item_name, etype))
        if effect.get("operation") not in OPERATIONS:
            raise ValueError("%s: %s bad operation %r" % (item_name, etype, effect.get("operation")))
        if "value" not in effect:
            raise ValueError("%s: %s needs a value" % (item_name, etype))
        if effect.get("measure") not in MEASURES:
            raise ValueError("%s: %s bad measure %r" % (item_name, etype, effect.get("measure")))
    if etype in TARGET_ONLY_TYPES or etype == "grant-ability":
        if not effect.get("target"):
            raise ValueError("%s: %s needs a target" % (item_name, etype))

    target = effect.get("target")
    if target:
        domain = target.get("domain")
        if domain == "test":
            allowed = TEST_CORE_NAMES | EXTRA_TEST_NAMES
            if target.get("name") not in allowed:
                raise ValueError("%s: test target %r not in taxonomy" % (item_name, target.get("name")))
        elif domain in TARGET_NAMES:
            if target.get("name") not in TARGET_NAMES[domain]:
                raise ValueError("%s: %s target %r not in taxonomy"
                                 % (item_name, domain, target.get("name")))
        elif etype == "attack-modifier":
            if domain != "attack" or target.get("name") not in ATTACK_MODIFIER_NAMES:
                raise ValueError("%s: attack-modifier must target attack/Damage or attack/Attack"
                                 % item_name)
        elif domain in ("ability", "attack", "option"):
            pass  # free-form named ability / attack / option
        else:
            raise ValueError("%s: unknown target domain %r" % (item_name, domain))


def validate_items(items):
    seen = set()
    for name, entry in items.items():
        if name in seen:
            raise ValueError("duplicate item name: %r" % name)
        seen.add(name)
        if entry.get("kind") not in KINDS:
            raise ValueError("%s: unknown kind %r" % (name, entry.get("kind")))
        for e in entry.get("effects", []):
            validate_effect(e, name)
    return True


# ---------------------------------------------------------------------------
# Merge + emit
# ---------------------------------------------------------------------------

SOURCE_TEXT = (
    "Earthdawn 4E Player's Guide — the Weapons, Armor & Shields, Magical "
    "Equipment, and Adventuring Equipment tables (Weapons p.406-410; Armor and "
    "Shields p.411-415; Magical Equipment p.415-423; Adventuring Equipment "
    "p.423-426; tables on pp.433-439). The reference CATALOG: each entry's "
    "mechanics live in an `effects` array in the controlled taxonomy "
    "vocabulary, so the engine gathers them exactly as it does racial/"
    "discipline effects. A character owns items by name (data/character.json "
    "`items: [{ name, equipped }]`) — the numbers are reference, not "
    "per-character input."
)

# Schema tag and taxonomy reference for the emitted file (v2 = attack-modifier;
# v3 = `set`-as-base damage contract, see EFFECT-TAXONOMY.md §4.1).
SCHEMA = "ed-items/2"
TAXONOMY_REF = "docs/EFFECT-TAXONOMY.md (v3)"

NOTES_TEXT = {
    "armor": "Worn armor confers Physical/Mystic Armor (damage reducers) via `armor-modifier` effects, and its Initiative penalty via a `characteristic-modifier` on Initiative (measure: step). `living` marks elemental 'living' armor (the only kind an obsidiman may wear atop Natural Armor; PG p.48). `ref` holds display-only stats (cost/weight/availability).",
    "shield": "Shields do NOT add to Armor — they raise Physical/Mystic DEFENSE (`defense-modifier`) and carry an Initiative penalty. `shatterThreshold` is display-only reference.",
    "weapon": "Weapons carry an `attack-modifier` on the attack's Damage step (target `attack`/`Damage`, `operation: add`, measure: step). Every category — melee, missile, and thrown — adds its Damage Step to the Strength-step base (EFFECT-TAXONOMY v3 §4.1; the base is the engine default, not stored here). STR/DEX minima, size, ranges, and entangle details are display-only in `ref`. Ammo rows from the missile table are separate `ammunition` entries.",
    "blood-charm": "Blood charms are activated items: their bonuses are `situational` typed effects (with `scope`), the one-time implant Blood Magic Damage is a `note`, and the Alchemy-crafting EDN is display-only in `ref`.",
    "healing-aid": "Healing aids grant one-shot bonuses encoded as `situational` test modifiers; `edn` (Alchemy crafting difficulty) is display-only in `ref`.",
    "magic-item": "Common magic items: numeric, always-relevant mechanics are typed effects; one-shot, non-numeric, or activated properties are `note` effects.",
    "gear": "Adventuring gear is mostly display-only (`effects: []`); kits record their contents in a `note`, and items with a specific game rule (e.g. Healing Kit +1 Recovery, chain/rope break tests) carry that rule as an effect.",
}


def merge(existing_data, new_items):
    existing_items = dict(existing_data.get("items", {}))
    existing_names = set(existing_items)
    # Order of brand-new names follows KIND_ORDER, alphabetical within a kind.
    new_names = sorted(set(new_items) - existing_names)
    if new_names:
        by_kind = {}
        for name in new_names:
            by_kind.setdefault(new_items[name]["kind"], []).append(name)
        added = []
        for kind in KIND_ORDER:
            for name in sorted(by_kind.get(kind, []), key=str.lower):
                added.append(name)
        for name in added:
            existing_items[name] = new_items[name]
    else:
        added = []
    # Refresh every entry the parser produces (taxonomy/effect edits must
    # reapply on regenerate). Entries the parser does not produce — the
    # armour/shield tables — are preserved verbatim, in place.
    for name, entry in new_items.items():
        existing_items[name] = entry
    preserved = [n for n in existing_data.get("items", {}) if n not in new_items]

    notes = {}
    existing_notes = existing_data.get("notes", {}) or {}
    notes.update(existing_notes)
    for k, v in NOTES_TEXT.items():
        notes[k] = v

    merged = {}
    for k in existing_data:
        merged[k] = existing_data[k]
    merged["schema"] = SCHEMA
    merged["effectTaxonomy"] = TAXONOMY_REF
    merged["source"] = SOURCE_TEXT
    merged["notes"] = notes
    merged["items"] = existing_items
    return merged, added, preserved


def main():
    ap = argparse.ArgumentParser(description="Extend rules/items.json from the rulebook extracts.")
    ap.add_argument("--source", default=str(DEFAULT_SOURCE))
    ap.add_argument("--items", default=str(DEFAULT_ITEMS))
    ap.add_argument("--write", action="store_true", help="write rules/items.json (default: dry-run)")
    args = ap.parse_args()

    source_path = Path(args.source)
    if not source_path.exists():
        raise SystemExit("source not found: %s" % source_path)
    text = source_path.read_text(encoding="utf-8")

    new_items = parse_all(text)
    validate_items(new_items)

    items_path = Path(args.items)
    existing = json.loads(items_path.read_text(encoding="utf-8"))
    merged, added, preserved = merge(existing, new_items)

    print("Parsed %d new catalog entries from %s" % (len(new_items), source_path.name))
    counts = {}
    for name in new_items:
        counts[new_items[name]["kind"]] = counts.get(new_items[name]["kind"], 0) + 1
    for kind in KIND_ORDER:
        if kind in counts:
            print("  %-12s %3d" % (kind, counts[kind]))
    print("Entries preserved verbatim (armour/shields, not parser output): %d" % len(preserved))
    print("Entries refreshed from parser: %d" % (len(new_items) - len(added)))
    print("New entries added on write: %d" % len(added))
    if added:
        print("  " + ", ".join(added))

    if args.write:
        items_path.write_text(
            json.dumps(merged, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print("Wrote %s" % items_path)
    else:
        print("Dry-run only — pass --write to merge into %s" % items_path)


if __name__ == "__main__":
    main()
