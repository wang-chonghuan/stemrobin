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

ROOT = "/Users/yong/work/lemmadeck-ws/lemmadeck"
TOC = f"{ROOT}/ssot-resources/soviet10year-textbooks/toc"
OUT = os.path.join(os.path.dirname(__file__), "out")

BRANCH = {
    "early": ("math", "数学"),
    "algebra": ("math", "代数"),
    "analysis": ("math", "代数与分析初步"),
    "geometry": ("math", "几何"),
    "probability": ("math", "概率论与统计"),
    "physics": ("physics", "物理"),
}

def en_titles(path):
    """id -> english title for every entry/lesson/topic, plus book title."""
    en_path = path.replace("/zh.json", "/en.json")
    if not os.path.exists(en_path):
        return {}, None
    en = json.load(open(en_path))
    m = {}
    for entry in en["contents"]:
        m[entry["id"]] = entry["title"]
        for lesson in entry.get("lessons", []):
            m[lesson["id"]] = lesson["title"]
            for tp in lesson.get("topics") or []:
                m[tp["id"]] = tp["title"]
    return m, en["title"]

nodes = []
for path in sorted(glob.glob(f"{TOC}/*/zh.json")):
    book = json.load(open(path))
    en_map, en_book_title = en_titles(path)
    discipline, branch_zh = BRANCH[book["subject"]]
    book_ctx = {
        "book": book["book"],
        "bookTitle": book["title"],
        "bookTitleEn": en_book_title or book["title"],
        "discipline": discipline,
        "branch": book["subject"],
        "branchZh": branch_zh,
        "grade": book["grade"],
    }

    def add(node_id, title, kind, chapter, section, chapter_id=None):
        nodes.append({
            "id": node_id,
            "title": title,
            "titleEn": en_map.get(node_id, title),
            "kind": kind,
            "chapter": chapter,
            "chapterEn": en_map.get(chapter_id) if chapter_id else None,
            "section": section,
            **book_ctx,
        })

    for entry in book["contents"]:
        if entry["kind"] != "chapter":
            add(entry["id"], entry["title"], "exercises", None, None)
            continue
        ch, ch_id = entry["title"], entry["id"]
        for lesson in entry["lessons"]:
            if lesson["kind"] == "exercises":
                add(lesson["id"], lesson["title"], "exercises", ch, None, ch_id)
                continue
            topics = lesson.get("topics") or []
            if topics:
                for tp in topics:
                    add(tp["id"], tp["title"], "topic", ch, lesson["title"], ch_id)
            else:
                add(lesson["id"], lesson["title"], "section", ch, None, ch_id)

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
