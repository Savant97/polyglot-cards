"""Add Spanish glosses to the enchart VP chips (public/encharts.json, in place).

Only the VP column needs an LLM: who/why/when chips are a small fixed vocabulary
glossed as constants in the app. VPs are glossed in infinitive ("cross the
street" -> "cruzar la calle") because they follow "want to / have to / can".
"""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).parent.parent
PATH = ROOT / "public" / "encharts.json"
MODEL = "glm-5.1"
BATCH = 40

PROMPT = """Translate each English verb phrase to Latin American Spanish, infinitive form
(they complete "quiero ___ / tengo que ___"). Natural, short, no subject.

Return ONLY a JSON object mapping each input phrase to its translation:
{"cross the street": "cruzar la calle", ...}

Phrases:
"""

client = OpenAI(base_url="http://localhost:4000/v1", api_key="sk-1234")


def run(batch):
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": PROMPT + json.dumps(batch, ensure_ascii=False)}],
        temperature=0.2,
        extra_body={"enable_thinking": False},
    )
    text = resp.choices[0].message.content.strip()
    if text.startswith("```"):
        text = text.split("```")[1].lstrip("json").strip()
    return json.loads(text)


def main():
    grids = json.loads(PATH.read_text(encoding="utf-8"))
    vps = sorted({v for g in grids for v in g["vp"]})
    batches = [vps[i:i + BATCH] for i in range(0, len(vps), BATCH)]
    gloss = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        for res in pool.map(run, batches):
            gloss.update(res)

    missing = [v for v in vps if v not in gloss]
    for g in grids:
        g["vp_gloss"] = [gloss.get(v, "") for v in g["vp"]]

    PATH.write_text(json.dumps(grids, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(vps)} VPs glossed, {len(missing)} missing")
    for v in list(gloss)[:5]:
        print(f"  {v} -> {gloss[v]}")


if __name__ == "__main__":
    main()
