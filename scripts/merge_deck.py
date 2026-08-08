"""Merge generated variants into the deck: data/new_vocab.csv + data/variants.jsonl
-> data/new_vocab_v2.csv.

Each variant is inserted right after its seed row, so the deck's contiguous
thematic blocks survive. SRS history is safe across reimport: the app keys
cards by Phrase text, not by position (utils/srs.ts cardKey).

Dedupe: a variant is dropped if its Phrase already exists in the original deck
or was already emitted by an earlier seed (normalized lowercase).
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
FIELDS = ["Phrase", "IPA", "ES Pronunciation", "ES Translation"]
ORDER = ["negative", "yesno", "wh", "past"]


def norm(p):
    return " ".join(p.strip().lower().split())


def clean(v):
    """One row per variant; newlines inside a field would break the app's parser."""
    return {f: " ".join(str(v.get(f, "")).split()) for f in FIELDS}


def main():
    deck = list(csv.DictReader((ROOT / "data" / "new_vocab.csv").open(encoding="utf-8")))
    variants_by_seed = {}
    for line in (ROOT / "data" / "variants.jsonl").open(encoding="utf-8"):
        for item in json.loads(line)["data"]:
            variants_by_seed[norm(item["source"])] = item["variants"]
    print(f"deck: {len(deck)} rows, seeds with variants: {len(variants_by_seed)}")

    seen = {norm(r["Phrase"]) for r in deck}
    out, added, dropped_dup, dropped_bad = [], 0, 0, 0
    matched_seeds = set()

    for row in deck:
        out.append(row)
        key = norm(row["Phrase"])
        if key not in variants_by_seed or key in matched_seeds:
            continue
        matched_seeds.add(key)
        for kind in ORDER:
            v = variants_by_seed[key].get(kind)
            if not v:
                continue
            v = clean(v)
            if not all(v[f] for f in FIELDS):
                dropped_bad += 1
                continue
            k = norm(v["Phrase"])
            if k in seen:
                dropped_dup += 1
                continue
            seen.add(k)
            out.append(v)
            added += 1

    orphans = set(variants_by_seed) - matched_seeds
    if orphans:
        print(f"WARNING: {len(orphans)} seeds not found in deck (variants NOT merged):")
        for o in list(orphans)[:5]:
            print(f"  {o}")

    dst = ROOT / "data" / "new_vocab_v2.csv"
    with dst.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(out)

    print(f"added {added} variant rows (dropped: {dropped_dup} duplicates, {dropped_bad} incomplete)")
    print(f"wrote {dst} -> {len(out)} rows total")


if __name__ == "__main__":
    main()
