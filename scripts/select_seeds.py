"""Pick the phrases worth transforming, preserving the deck's thematic coverage.

The file is grouped by theme (greetings, numbers, clothes, ...), and those blocks are
contiguous, so sampling the top-scoring rows inside contiguous blocks keeps every theme
represented instead of letting one dense theme win the whole budget.
"""
import csv
import re
import sys
from collections import Counter
from pathlib import Path

SRC = Path(__file__).parent.parent / "data" / "new_vocab.csv"
OUT = Path(__file__).parent.parent / "data" / "seeds.csv"
BUDGET = 500
BLOCKS = 50

WH = {"what", "where", "when", "who", "why", "how", "which", "whose"}
MODALS = {"do", "does", "did", "can", "could", "will", "would", "is", "are", "am", "was", "were"}
STOP = {"the", "a", "an", "i", "you", "he", "she", "it", "we", "they", "my", "your", "his",
        "her", "its", "our", "their", "to", "of", "in", "on", "at", "for", "and", "is",
        "are", "am", "this", "that", "these", "those", "me", "him", "us", "them"}

rows = list(csv.DictReader(SRC.open(encoding="utf-8")))
print(f"source rows: {len(rows)}")


def words(phrase):
    return re.findall(r"[a-z']+", phrase.lower())


def is_transformable(phrase):
    """Affirmative present-simple declaratives only: those are the 97% with no variety."""
    p = phrase.strip()
    if not p.endswith("."):
        return False
    w = words(p)
    if not (3 <= len(w) <= 8):
        return False
    if w[0] in WH or w[0] in MODALS:
        return False
    if "not" in w or "n't" in p.lower():
        return False
    # Needs a subject we can invert reliably.
    return w[0] in {"i", "you", "he", "she", "it", "we", "they", "the", "my", "his", "her", "our", "their", "this", "that"}


freq = Counter()
for r in rows:
    freq.update(w for w in words(r["Phrase"]) if w not in STOP)

candidates = [r for r in rows if is_transformable(r["Phrase"])]
print(f"transformable candidates: {len(candidates)} ({len(candidates)*100//len(rows)}%)")


def utility(row):
    """Favour phrases built from words that recur across the deck: the pattern transfers."""
    w = [x for x in words(row["Phrase"]) if x not in STOP]
    if not w:
        return 0
    return sum(freq[x] for x in w) / len(w)


# Contiguous blocks over the ORIGINAL order == thematic buckets.
seen = set()
selected = []
block_size = max(1, len(rows) // BLOCKS)
per_block = max(1, BUDGET // BLOCKS)
index_of = {id(r): i for i, r in enumerate(rows)}

for b in range(BLOCKS):
    lo, hi = b * block_size, (b + 1) * block_size if b < BLOCKS - 1 else len(rows)
    block = [r for r in candidates if lo <= index_of[id(r)] < hi]
    block.sort(key=utility, reverse=True)
    taken = 0
    for r in block:
        key = r["Phrase"].strip().lower()
        if key in seen:
            continue
        seen.add(key)
        selected.append(r)
        taken += 1
        if taken >= per_block:
            break

print(f"selected: {len(selected)} across {BLOCKS} thematic blocks")

with OUT.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["Phrase", "IPA", "ES Pronunciation", "ES Translation"])
    w.writeheader()
    w.writerows(selected)
print(f"wrote {OUT}")

print("\nsample:")
for r in selected[:5] + selected[len(selected)//2:len(selected)//2+5] + selected[-5:]:
    print("  ", r["Phrase"])
