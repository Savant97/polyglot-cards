"""Add an Island column to the deck: 50 contiguous thematic blocks, each labeled
by its two most distinctive content words.

The deck is thematically ordered, so contiguous blocks are themes. Variants sit
next to their seed after merge_deck.py, so blocks stay coherent in the v2 deck.
Labels are meant to be recognizable, not perfect; rename them in the CSV freely,
the app treats Island as an opaque string.
"""
import csv
import math
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "data" / "new_vocab_v2.csv"
BLOCKS = 50

STOP = set("""the a an i you he she it we they my your his her its our their me him us them
this that these those is are am was were be been do does did don doesn didn not no yes
to of in on at for and or but with from by as very so too also here there now then when
what where who why how which whose have has had can could will would should must may
like want need get got go goes going come came see saw look looks new old big small good
bad long short high low""".split())


def words(p):
    return [w for w in re.findall(r"[a-z']+", p.lower()) if w not in STOP and len(w) > 2]


def main():
    rows = list(csv.DictReader(SRC.open(encoding="utf-8")))
    n = len(rows)
    bounds = [(b * n // BLOCKS, (b + 1) * n // BLOCKS) for b in range(BLOCKS)]

    block_words = []
    for lo, hi in bounds:
        c = Counter()
        for r in rows[lo:hi]:
            c.update(set(words(r["Phrase"])))
        block_words.append(c)

    # Distinctiveness: frequent inside the block, rare across the other blocks.
    df = Counter()
    for c in block_words:
        df.update(c.keys())

    labels = []
    for c in block_words:
        scored = sorted(c, key=lambda w: c[w] * math.log(BLOCKS / df[w] + 1), reverse=True)
        labels.append(" / ".join(scored[:2]) or "misc")

    fields = list(rows[0].keys())
    if "Island" not in fields:
        fields.append("Island")
    for b, (lo, hi) in enumerate(bounds):
        label = f"{b + 1:02d} {labels[b]}"
        for r in rows[lo:hi]:
            r["Island"] = label

    with SRC.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print(f"{n} rows -> {BLOCKS} islands")
    for b in range(0, BLOCKS, 5):
        print(f"  {b + 1:02d} {labels[b]}")


if __name__ == "__main__":
    main()
