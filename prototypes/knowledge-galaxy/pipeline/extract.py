#!/usr/bin/env python3
"""Extract galaxy nodes from the toc zh.json files.

One node per addressable knowledge card, mirroring cardsOf() in
app/src/lib/textbooks.ts: a section's numbered topics are nodes; a section
without topics is itself a node. Exercise entries (kind=exercises) are kept
but flagged — they carry no semantic content and are excluded from embedding.
"""

import json
import glob
import os

ROOT = "/Users/yong/work/stemrobin-ws/stemrobin"
TOC = f"{ROOT}/ssot-resources/soviet10year-textbooks/toc"
OUT = os.path.join(os.path.dirname(__file__), "out")

BRANCH = {
    "early": ("math", "数学"),
    "algebra": ("math", "代数"),
    "analysis": ("math", "代数与分析初步"),
    "geometry": ("math", "几何"),
    "physics": ("physics", "物理"),
}

nodes = []
for path in sorted(glob.glob(f"{TOC}/*/zh.json")):
    book = json.load(open(path))
    discipline, branch_zh = BRANCH[book["subject"]]
    book_ctx = {
        "book": book["book"],
        "bookTitle": book["title"],
        "discipline": discipline,
        "branch": book["subject"],
        "branchZh": branch_zh,
        "grade": book["grade"],
    }

    def add(node_id, title, kind, chapter, section):
        nodes.append({
            "id": node_id,
            "title": title,
            "kind": kind,
            "chapter": chapter,
            "section": section,
            **book_ctx,
        })

    for entry in book["contents"]:
        if entry["kind"] != "chapter":
            add(entry["id"], entry["title"], "exercises", None, None)
            continue
        ch = entry["title"]
        for lesson in entry["lessons"]:
            if lesson["kind"] == "exercises":
                add(lesson["id"], lesson["title"], "exercises", ch, None)
                continue
            topics = lesson.get("topics") or []
            if topics:
                for tp in topics:
                    add(tp["id"], tp["title"], "topic", ch, lesson["title"])
            else:
                add(lesson["id"], lesson["title"], "section", ch, None)

os.makedirs(OUT, exist_ok=True)

content = [n for n in nodes if n["kind"] != "exercises"]
for n in content:
    parts = [p for p in (n["chapter"], n["section"]) if p]
    seen = []
    for p in parts:
        if p not in seen and p != n["title"]:
            seen.append(p)
    ctx = "，".join(seen)
    n["text"] = f'{n["branchZh"]}：{ctx}。知识点：{n["title"]}' if ctx else f'{n["branchZh"]}知识点：{n["title"]}'

with open(f"{OUT}/nodes.json", "w") as f:
    json.dump(nodes, f, ensure_ascii=False, indent=1)

from collections import Counter
c = Counter((n["discipline"], n["kind"]) for n in nodes)
print(f"total={len(nodes)} content={len(content)}")
for k, v in sorted(c.items()):
    print(k, v)
print("sample text:", content[500]["text"])
