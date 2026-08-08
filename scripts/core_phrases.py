"""Fill the NGSL top-1000 gaps: 3 natural spoken phrases per missing word.

Method (the inverse of word x grammar):
- generation is vocab-CONSTRAINED (top-1000 forms + existing deck vocabulary),
  so gap-filling adds zero new rare-word debt;
- a deterministic vocab check drops phrases that break the constraint (no LLM
  judgement involved in a checkable rule);
- a cross-provider judge (gemini) drops unnatural phrases, one targeted regen
  round for words left with nothing.

Usage:
  python scripts/core_phrases.py            # full run, resumable
  python scripts/core_phrases.py --merge    # after a run: build islands + merge into deck

Output: data/core_phrases.jsonl (resumable), then rows appended to
data/new_vocab_v2.csv with "core" island labels.
"""
import argparse
import csv
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).parent.parent
FLUENT = Path("C:/Users/maide/Downloads/fluent-local/fluent")
GEN_MODEL = "glm-5.1"
JUDGE_MODEL = "gemini-3.1-flash"
WORDS_PER_CALL = 8
PHRASES_PER_WORD = 3
FIELDS = ["Phrase", "IPA", "ES Pronunciation", "ES Translation"]

client = OpenAI(base_url="http://localhost:4000/v1", api_key="sk-1234")

GEN_PROMPT = """You write phrases for an English deck for Spanish-speaking A2/B1 learners.

For each TARGET WORD, write exactly 3 different short sentences of natural SPOKEN English
(5-9 words) that a person would actually say in conversation today. Each sentence must
contain the target word. Use ONLY common everyday vocabulary around it (the 1,000 most
frequent English words); no rare words, no proper nouns, no idioms that don't translate.
Vary the frame across the 3 sentences (statement / question / negative are all welcome).

Every sentence needs 4 fields:
- Phrase: the sentence.
- IPA: British RP, slashes included.
- ES Pronunciation: phonetic respelling for a SPANISH reader (Spanish letter values,
  lowercase, "th" -> "z" or "d", initial "h" -> "j", same end punctuation as the Phrase).
- ES Translation: natural Latin American Spanish (questions with inverted marks).

Return ONLY a JSON array:
[{"word": "<target>", "phrases": [{"Phrase": "...", "IPA": "...", "ES Pronunciation": "...", "ES Translation": "..."}, ...]}]

Target words:
"""

JUDGE_PROMPT = """You are a strict English naturalness judge for a language-learning deck.

For each item, PASS only if the sentence is something a real English speaker would
plausibly say in everyday conversation, and it uses the target word correctly.
FAIL if it is stiff, bookish, ungrammatical, or an unnatural use of the target word.

Return ONLY a JSON array, same order:
[{"i": <index>, "verdict": "pass"|"fail", "reason": "<short, only when fail>"}]

Items:
"""


def call(model, prompt, payload, temperature=0.4):
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt + json.dumps(payload, ensure_ascii=False)}],
        temperature=temperature,
        extra_body={"enable_thinking": False},
    )
    text = resp.choices[0].message.content.strip()
    if text.startswith("```"):
        text = text.split("```")[1].lstrip("json").strip()
    return json.loads(text)


def ngsl_forms():
    """headword -> set(forms), in rank order."""
    lines = [l for l in (FLUENT / "slice/spines/NGSL_1.2_lemmatized_for_research.csv")
             .read_text(encoding="utf-8-sig").splitlines() if l and not l.startswith("#")]
    forms, order = {}, []
    for l in lines:
        parts = [p.strip().lower() for p in l.split(",") if p.strip()]
        if not parts:
            continue
        if parts[0] not in forms:
            forms[parts[0]] = set()
            order.append(parts[0])
        forms[parts[0]].update(parts)
    return forms, order


def deck_vocab():
    words = set()
    for r in csv.DictReader((ROOT / "data" / "new_vocab_v2.csv").open(encoding="utf-8")):
        words.update(re.findall(r"[a-z']+", r["Phrase"].lower()))
    return words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--merge", action="store_true")
    args = ap.parse_args()

    forms, order = ngsl_forms()
    deck = deck_vocab()
    top1000 = order[:1000]
    missing = [h for h in top1000 if not (forms[h] & deck)]
    allowed = deck | {f for h in order for f in forms[h]}  # full NGSL forms + deck
    print(f"missing top-1000 words: {len(missing)}")

    out_path = ROOT / "data" / "core_phrases.jsonl"

    if not args.merge:
        done = set()
        if out_path.exists():
            for line in out_path.open(encoding="utf-8"):
                done.add(json.loads(line)["batch"])
        batches = [(i, missing[i * WORDS_PER_CALL:(i + 1) * WORDS_PER_CALL])
                   for i in range((len(missing) + WORDS_PER_CALL - 1) // WORDS_PER_CALL)]
        todo = [b for b in batches if b[0] not in done]
        print(f"{len(batches)} batches, {len(done)} done, {len(todo)} to run")

        t0 = time.time()
        with out_path.open("a", encoding="utf-8") as f, ThreadPoolExecutor(max_workers=3) as pool:
            def run(ib):
                idx, words = ib
                try:
                    return idx, call(GEN_MODEL, GEN_PROMPT, words), None
                except Exception as e:
                    return idx, [], f"{type(e).__name__}: {e}"
            for idx, data, err in pool.map(run, todo):
                if err:
                    print(f"  batch {idx}: FAILED -> {err[:100]}")
                    continue
                f.write(json.dumps({"batch": idx, "data": data}, ensure_ascii=False) + "\n")
                f.flush()
                print(f"  batch {idx}: {len(data)} words")
        print(f"generation done in {time.time()-t0:.0f}s — now: vocab check + judge")

    # ---- vocab check (deterministic) + judge ----
    items = []  # flat: {word, phrase-record}
    for line in out_path.open(encoding="utf-8"):
        for w in json.loads(line)["data"]:
            for ph in w.get("phrases", []):
                if all(ph.get(k) for k in FIELDS):
                    items.append({"word": w["word"], **{k: ph[k] for k in FIELDS}})

    def violations(phrase):
        return [w for w in re.findall(r"[a-z']+", phrase.lower()) if w not in allowed]

    kept = [it for it in items if not violations(it["Phrase"])]
    dropped_vocab = len(items) - len(kept)
    print(f"{len(items)} phrases generated; {dropped_vocab} dropped by vocab constraint")

    judge_in = [{"i": i, "target": it["word"], "sentence": it["Phrase"]} for i, it in enumerate(kept)]
    verdicts = {}
    jb = [judge_in[i:i + 20] for i in range(0, len(judge_in), 20)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        for res in pool.map(lambda b: call(JUDGE_MODEL, JUDGE_PROMPT, b, 0.2), jb):
            for r in res:
                verdicts[r["i"]] = r["verdict"]
    survivors = [it for i, it in enumerate(kept) if verdicts.get(i) == "pass"]
    print(f"judge: {len(survivors)} pass / {len(kept) - len(survivors)} fail")

    by_word = {}
    for it in survivors:
        by_word.setdefault(it["word"], []).append(it)
    empty = [w for w in {it["word"] for it in items} if w not in by_word]
    print(f"words with zero surviving phrases: {len(empty)} {empty[:10]}")

    if not args.merge:
        print("\nreview done — run with --merge to build islands and merge into the deck")
        return

    # ---- islands + merge ----
    deck_rows = list(csv.DictReader((ROOT / "data" / "new_vocab_v2.csv").open(encoding="utf-8")))
    existing = {" ".join(r["Phrase"].strip().lower().split()) for r in deck_rows}
    words_sorted = sorted(by_word)
    GROUP = 25
    new_rows, dup = [], 0
    for gi in range(0, len(words_sorted), GROUP):
        group = words_sorted[gi:gi + GROUP]
        label = f"{51 + gi // GROUP:02d} core {group[0]}-{group[-1]}"
        for w in group:
            for it in by_word[w][:PHRASES_PER_WORD]:
                key = " ".join(it["Phrase"].strip().lower().split())
                if key in existing:
                    dup += 1
                    continue
                existing.add(key)
                new_rows.append({**{k: " ".join(str(it[k]).split()) for k in FIELDS}, "Island": label})

    fields = list(deck_rows[0].keys())
    with (ROOT / "data" / "new_vocab_v2.csv").open("w", encoding="utf-8", newline="") as f:
        wtr = csv.DictWriter(f, fieldnames=fields)
        wtr.writeheader()
        wtr.writerows(deck_rows + new_rows)
    print(f"merged {len(new_rows)} core rows ({dup} duplicates skipped) -> {len(deck_rows) + len(new_rows)} total")


if __name__ == "__main__":
    main()
