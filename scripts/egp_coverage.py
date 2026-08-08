"""Measure which A1/A2 constructions the deck actually exercises.

EGP is used as a coverage CHECKLIST (fluent settled decision #3), not an
expansion rule: deterministic regex detectors for the constructions that CAN
be detected by surface pattern, a ranked gap list at the end. Points that need
real parsing (articles, word order subtleties) are out of scope and said so.
"""
import csv
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent

IRREG_PAST = r"(went|saw|took|gave|made|found|got|said|told|came|knew|felt|kept|held|met|ran|sat|stood|heard|wrote|drove|ate|drank|flew|wore|broke|chose|spoke|sold|sent|spent|built|lost|paid|threw|grew|drew|fell|rode|rose|swam|sang|began|became|slept|woke|bought|brought|thought|taught|caught|left|did|had|was|were)"

DETECTORS = [
    ("present simple negative (don't/doesn't)", r"\b(don't|doesn't|do not|does not)\b"),
    ("yes/no question with do/does", r"^(do|does)\b.*\?"),
    ("wh-question", r"^(what|where|when|who|why|how|which|whose)\b.*\?"),
    ("past simple", r"(\bdid\b|\w\wed\b|\b" + IRREG_PAST + r"\b)"),
    ("present continuous (be + -ing)", r"\b(am|is|are|'m|'s|'re)\b\s+\w+ing\b"),
    ("past continuous (was/were + -ing)", r"\b(was|were)\s+\w+ing\b"),
    ("going-to future", r"\b(am|is|are|'m|'s|'re)\s+going to\s+\w+"),
    ("will future", r"\b(will|won't|'ll)\b"),
    ("modal: can/can't", r"\b(can|can't|cannot)\b"),
    ("modal: must/mustn't", r"\b(must|mustn't)\b"),
    ("modal: should", r"\b(should|shouldn't)\b"),
    ("modal: could/may/might", r"\b(could|may|might)\b"),
    ("would like / 'd like", r"\b(would like|'d like)\b"),
    ("there is/are", r"\bthere\s+(is|are|was|were)\b"),
    ("comparative", r"(\b\w+er than\b|\bmore \w+ than\b)"),
    ("superlative", r"(\bthe \w+est\b|\bthe most \w+\b)"),
    ("imperative (please/don't/let's)", r"^(please|don't|let's)\b"),
    ("have got", r"\b(have|has|'ve|'s)\s+got\b"),
    ("present perfect", r"\b(have|has|'ve|'s)\s+(been|done|seen|made|had|gone|taken|given|found|known|\w+ed)\b"),
    ("frequency adverb", r"\b(always|usually|often|sometimes|never|rarely)\b"),
    ("want/need/like/have + to-infinitive", r"\b(want|wants|need|needs|like|likes|love|loves|have|has|try|tries|hope|hopes)\s+to\s+\w+"),
    ("question tag", r",\s*(isn't|aren't|don't|doesn't|didn't|wasn't|weren't|won't|can't)\s+(it|you|he|she|we|they)\?"),
    ("possessive adjective", r"\b(my|your|his|her|our|their)\b"),
    ("object pronoun", r"\b(me|him|us|them)\b"),
    ("quantifier (some/any/much/many/a lot of)", r"\b(some|any|much|many|a lot of)\b"),
    ("conjunction because/but/so/or", r"\b(because|but|so|or)\b"),
    ("place preposition phrase", r"\b(in|on|at|under|behind|near|next to)\s+(the|a|an|my|your|his|her|our|their)\b"),
]


def main():
    rows = list(csv.DictReader((ROOT / "data" / "new_vocab_v2.csv").open(encoding="utf-8")))
    phrases = [r["Phrase"].strip() for r in rows]
    n = len(phrases)
    lowered = [p.lower() for p in phrases]

    results = []
    for name, pat in DETECTORS:
        rx = re.compile(pat, re.I)
        hits = sum(1 for p in lowered if rx.search(p))
        results.append((name, hits))

    print(f"deck: {n} rows — detectable A1/A2 construction coverage\n")
    print(f"{'construction':46} {'rows':>6} {'%':>6}")
    for name, hits in sorted(results, key=lambda x: -x[1]):
        print(f"{name:46} {hits:>6} {hits*100/n:>5.1f}%")

    print("\n== GAPS (under 0.5% of the deck) ==")
    for name, hits in sorted(results, key=lambda x: x[1]):
        if hits * 100 / n < 0.5:
            print(f"  {name:44} {hits:>5} rows ({hits*100/n:.2f}%)")

    print("\nNot detectable by surface regex (needs parsing, out of scope):")
    print("  articles a/an/the usage points, word order points, short answers,")
    print("  zero/first conditional, defining relative clauses.")


if __name__ == "__main__":
    main()
