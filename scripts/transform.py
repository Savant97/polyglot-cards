"""Generate 4 grammatical variants per seed phrase (negative, yes/no, wh, past).

Prompt v3. History of measured defects this prompt encodes:
- v1: wh-questions collapsed to generic frames ("What do you like?" for two
  different seeds) -> 4% duplicate rows and loss of the theme word.
- v2: fixed collapse (0% dup on 24 seeds) but wh-questions were monotone:
  8 of 12 started with "Why". v3 adds the variety rule below.

Usage:
  python scripts/transform.py --pilot     # 24 evenly spaced seeds, prints metrics
  python scripts/transform.py             # full run over data/seeds.csv, resumable

Output: data/variants.jsonl (one line per batch, resumable) and metrics on stdout.
Route: LiteLLM proxy at localhost:4000 (glm-5.1, thinking off).
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
MODEL = "glm-5.1"
BATCH = 8
WORKERS = 3

PROMPT = """You expand an English phrase deck for Spanish speakers.

For each input phrase, produce exactly 4 variants:
- negative: the negated form, same subject
- yesno: a yes/no question. KEEP THE ORIGINAL SUBJECT AND VERB. Only shift "I" to "you"
  (and "my" to "your") when the sentence is first person, because that is how the question
  is actually asked in conversation.
- wh: a wh- question that MUST still contain the content word of the original sentence
  (the noun, place or object). Ask about the subject, the place, the time or the manner,
  never about the object if that deletes the theme word. "I like Ghana." -> "Why do you
  like Ghana?" or "Where is Ghana?", NEVER "What do you like?".
- past: the same sentence in past simple, affirmative, same subject

WH-WORD VARIETY (hard rule)
- Across the batch, VARY the wh-word. Never use the same wh-word for more than 2 of the
  inputs in one batch. Pick the one the content naturally supports:
  places -> "Where", times/routines -> "When" or "How often", people -> "Who",
  manner/quality -> "How", objects with a kept theme word -> "What ... <theme>" or "Which",
  and "Why" only where a reason is genuinely the natural question.
- NATURALNESS OUTRANKS VARIETY: the question must be one a real person would actually
  ask in conversation. If no varied wh-word fits the sentence naturally, fall back to
  "Why" or "What" rather than produce an awkward question ("When does he have
  citizenship?" is a defect; "Why does he have citizenship?" is fine).

HARD RULES
- Never output the same Phrase for two different inputs. Generic frames are a defect.
- Keep the original vocabulary and theme in all 4 variants.

Every variant needs the same 4 fields as the input:
- Phrase: natural, spoken English.
- IPA: British RP, slashes included, matching the style of the input IPA.
- ES Pronunciation: phonetic respelling for a SPANISH reader (Spanish letter values, not
  English). Follow the input style exactly: lowercase, "th" -> "z" or "d", initial "h" ->
  "j", ending in a period or question mark.
- ES Translation: natural Latin American Spanish. Questions use inverted marks.

Return ONLY a JSON array:
[{"source": "<input phrase>", "variants": {"negative": {...}, "yesno": {...}, "wh": {...}, "past": {...}}}]

Input phrases:
"""

client = OpenAI(base_url="http://localhost:4000/v1", api_key="sk-1234")


def run_batch(idx_batch):
    idx, batch = idx_batch
    t0 = time.time()
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": PROMPT + json.dumps(batch, ensure_ascii=False, indent=1)}],
            temperature=0.3,
            extra_body={"enable_thinking": False},
        )
        text = resp.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json").strip()
        return idx, json.loads(text), time.time() - t0, None
    except Exception as e:  # parse errors and API errors both land in the retry queue
        return idx, [], time.time() - t0, f"{type(e).__name__}: {e}"


def wh_distribution(data):
    first = [x["variants"]["wh"]["Phrase"].split()[0].rstrip(",") for x in data if x.get("variants", {}).get("wh")]
    from collections import Counter
    return Counter(first)


def dup_rate(data):
    phrases = [v["Phrase"] for x in data for v in x["variants"].values()]
    uniq = len(set(p.strip().lower() for p in phrases))
    return len(phrases), uniq


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pilot", action="store_true", help="24 evenly spaced seeds, fresh run")
    args = ap.parse_args()

    rows = list(csv.DictReader((ROOT / "data" / "seeds.csv").open(encoding="utf-8")))
    if args.pilot:
        step = max(1, len(rows) // 24)
        rows = [rows[i * step] for i in range(24)]
        out_path = ROOT / "data" / "pilot-v3.jsonl"
        out_path.unlink(missing_ok=True)
    else:
        out_path = ROOT / "data" / "variants.jsonl"

    done = set()
    if out_path.exists():
        for line in out_path.open(encoding="utf-8"):
            done.add(json.loads(line)["batch"])

    batches = [(i, rows[i * BATCH:(i + 1) * BATCH]) for i in range((len(rows) + BATCH - 1) // BATCH)]
    todo = [b for b in batches if b[0] not in done]
    print(f"{len(rows)} seeds, {len(batches)} batches, {len(done)} already done, {len(todo)} to run")

    t0 = time.time()
    failures = []
    with out_path.open("a", encoding="utf-8") as f, ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for idx, data, dt, err in pool.map(run_batch, todo):
            if err:
                failures.append((idx, err))
                print(f"  batch {idx}: FAILED in {dt:.1f}s -> {err[:120]}")
                continue
            f.write(json.dumps({"batch": idx, "data": data}, ensure_ascii=False) + "\n")
            f.flush()
            print(f"  batch {idx}: {len(data)} phrases in {dt:.1f}s")
    print(f"total {time.time()-t0:.1f}s, failures: {len(failures)}")

    all_data = [d for line in out_path.open(encoding="utf-8") for d in json.loads(line)["data"]]
    total, uniq = dup_rate(all_data)
    print(f"\n{len(all_data)} seeds -> {total} rows, {uniq} unique ({100 - uniq * 100 // total}% duplicated)")
    print("wh-word distribution:", dict(wh_distribution(all_data).most_common()))
    if args.pilot:
        print("\nwh-questions:")
        for x in all_data:
            print(f"  {x['source']:40} -> {x['variants']['wh']['Phrase']}")


if __name__ == "__main__":
    main()
