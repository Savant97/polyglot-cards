"""Judge every generated wh-question for naturalness, regenerate the rejects.

Judge is cross-provider (gemini) on purpose: glm generated the questions, and a
model judging its own output is lenient. Rejects get one targeted regeneration
with the judge's reason injected, then a re-judge; a regen that still fails
keeps the regenerated form but is counted and printed.

Patches data/variants.jsonl in place (wh variant only), so merge_deck.py can
re-run unchanged afterwards.
"""
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).parent.parent
JUDGE_MODEL = "gemini-3.1-flash"
GEN_MODEL = "glm-5.1"
JUDGE_BATCH = 20
GEN_BATCH = 8

client = OpenAI(base_url="http://localhost:4000/v1", api_key="sk-1234")

JUDGE_PROMPT = """You are a strict English naturalness judge for a language-learning deck.

For each item: given the source sentence and a wh-question derived from it, decide if the
question is something a real English speaker would naturally ask in conversation.

FAIL if any of these:
- ungrammatical or unidiomatic ("How is he very rich?")
- a question nobody would ask ("When does she have an idea?")
- the question dropped the source's subject or theme word and became generic
- awkward register or word order

PASS otherwise. Minor stiffness is fine; this is a study deck, not literature.

Return ONLY a JSON array, same order as input:
[{"i": <index>, "verdict": "pass"|"fail", "reason": "<short, only when fail>"}]

Items:
"""

REGEN_PROMPT = """You write wh-questions for an English study deck for Spanish speakers.

For each item you get a source sentence, a rejected wh-question, and why it was rejected.
Write a BETTER wh-question that:
- is natural spoken English a real person would ask
- keeps the theme/content word of the source sentence
- keeps the source subject unless first person ("I" -> "you")
- does not invent new content words
- varies the wh-word when the content supports it; "Why ...?" is always an acceptable fallback

Each result needs 4 fields:
- Phrase: the question
- IPA: British RP, slashes included
- ES Pronunciation: phonetic respelling for a SPANISH reader (lowercase, "th"->"z"/"d",
  initial "h"->"j", ends with question mark)
- ES Translation: natural Latin American Spanish, inverted marks

Return ONLY a JSON array, same order:
[{"i": <index>, "Phrase": "...", "IPA": "...", "ES Pronunciation": "...", "ES Translation": "..."}]

Items:
"""


def call(model, prompt, payload):
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt + json.dumps(payload, ensure_ascii=False, indent=1)}],
        temperature=0.2,
        extra_body={"enable_thinking": False},
    )
    text = resp.choices[0].message.content.strip()
    if text.startswith("```"):
        text = text.split("```")[1].lstrip("json").strip()
    return json.loads(text)


def judge(items):
    """items: [{i, source, wh}] -> {i: (verdict, reason)}"""
    batches = [items[j:j + JUDGE_BATCH] for j in range(0, len(items), JUDGE_BATCH)]
    out = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for res in pool.map(lambda b: call(JUDGE_MODEL, JUDGE_PROMPT, b), batches):
            for r in res:
                out[r["i"]] = (r["verdict"], r.get("reason", ""))
    return out


def main():
    path = ROOT / "data" / "variants.jsonl"
    lines = [json.loads(line) for line in path.open(encoding="utf-8")]
    entries = [(li, xi, x) for li, line in enumerate(lines) for xi, x in enumerate(line["data"])]

    items = [{"i": i, "source": x["source"], "wh": x["variants"]["wh"]["Phrase"]}
             for i, (_, _, x) in enumerate(entries)]
    print(f"judging {len(items)} wh-questions with {JUDGE_MODEL}...")
    t0 = time.time()
    verdicts = judge(items)
    fails = [i for i in verdicts if verdicts[i][0] == "fail"]
    print(f"round 1: {len(items) - len(fails)} pass, {len(fails)} fail ({time.time()-t0:.0f}s)")
    for i in fails[:10]:
        print(f"  FAIL {items[i]['wh']:50} <- {verdicts[i][1][:80]}")

    if not fails:
        print("nothing to regenerate")
        return

    # Targeted regeneration with the judge's reason.
    regen_in = [{"i": i, "source": items[i]["source"], "rejected": items[i]["wh"],
                 "reason": verdicts[i][1]} for i in fails]
    batches = [regen_in[j:j + GEN_BATCH] for j in range(0, len(regen_in), GEN_BATCH)]
    print(f"regenerating {len(fails)} with {GEN_MODEL}...")
    regen = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        for res in pool.map(lambda b: call(GEN_MODEL, REGEN_PROMPT, b), batches):
            for r in res:
                regen[r["i"]] = r

    # Re-judge the regenerated ones.
    rejudge_in = [{"i": i, "source": items[i]["source"], "wh": regen[i]["Phrase"]} for i in regen]
    verdicts2 = judge(rejudge_in)
    still_bad = [i for i in verdicts2 if verdicts2[i][0] == "fail"]
    print(f"round 2: {len(rejudge_in) - len(still_bad)} pass, {len(still_bad)} still fail (kept anyway):")
    for i in still_bad:
        print(f"  KEPT {regen[i]['Phrase']:50} <- {verdicts2[i][1][:80]}")

    # Patch the jsonl in place.
    for i, r in regen.items():
        li, xi, _ = entries[i]
        lines[li]["data"][xi]["variants"]["wh"] = {k: r[k] for k in
                                                   ["Phrase", "IPA", "ES Pronunciation", "ES Translation"]}
    with path.open("w", encoding="utf-8") as f:
        for line in lines:
            f.write(json.dumps(line, ensure_ascii=False) + "\n")
    print(f"patched {len(regen)} wh variants in {path.name}; re-run merge_deck.py")


if __name__ == "__main__":
    main()
