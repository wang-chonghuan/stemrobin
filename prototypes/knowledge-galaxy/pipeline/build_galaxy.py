#!/usr/bin/env python3
"""Merge layout.json + hub names into web/galaxy.json for the prototype."""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
WEB = os.path.join(HERE, "..", "web")

# Hub names, reviewed against each cluster's nearest-to-centroid samples.
# NOTE: keyed by KMeans cluster index — any change to the embedding texts
# reshuffles the clusters, and both dicts must be re-reviewed against the
# embed_layout.py printout before rebuilding.
NAMES = {
    0: "空间平行关系", 1: "半导体与导电", 2: "函数与图象", 3: "数与式",
    4: "物质结构", 5: "振动与波", 6: "随机事件与概率", 7: "晶体与物态",
    8: "相对论", 9: "功与简单机械", 10: "三角函数", 11: "算术与分数",
    12: "力的初步", 13: "旋转体与球", 14: "数列与极限", 15: "电流与电路",
    16: "指数与对数函数", 17: "力与运动", 18: "对称与作图", 19: "几何光学",
    20: "随机变量与分布", 21: "三角形与多边形", 22: "二次方程", 23: "压强与浮力",
    24: "近似计算", 25: "热量与热传递", 26: "统计与组合", 27: "热力学与分子运动",
    28: "正负数运算", 29: "空间垂直关系", 30: "原子核与粒子", 31: "幂与指数",
    32: "磁场与电磁感应", 33: "电场与电容", 34: "向量", 35: "多面体与体积",
    36: "不等式与分式", 37: "交流电", 38: "运动学", 39: "物态变化",
    40: "等差与等比数列", 41: "对数与计算", 42: "光的波动与光谱", 43: "导数",
    44: "函数初步", 45: "机械能守恒", 46: "平面图形",
}

NAMES_EN = {
    0: "Parallel Lines & Planes", 1: "Conduction & Semiconductors",
    2: "Functions & Graphs", 3: "Numbers & Expressions", 4: "Structure of Matter",
    5: "Oscillations & Waves", 6: "Events & Probability",
    7: "Crystals & States of Matter", 8: "Relativity", 9: "Work & Simple Machines",
    10: "Trigonometric Functions", 11: "Arithmetic & Fractions",
    12: "Introduction to Forces", 13: "Solids of Revolution", 14: "Sequences & Limits",
    15: "Current & Circuits", 16: "Exponential & Log Functions", 17: "Force & Motion",
    18: "Symmetry & Constructions", 19: "Geometric Optics",
    20: "Random Variables & Distributions", 21: "Triangles & Polygons",
    22: "Quadratic Equations", 23: "Pressure & Buoyancy",
    24: "Approximate Computation", 25: "Heat & Heat Transfer",
    26: "Statistics & Combinatorics", 27: "Thermodynamics & Kinetic Theory",
    28: "Signed Numbers", 29: "Perpendiculars in Space", 30: "Nucleus & Particles",
    31: "Powers & Exponents", 32: "Magnetic Fields & Induction",
    33: "Electric Fields & Capacitance", 34: "Vectors", 35: "Polyhedra & Volume",
    36: "Inequalities & Rational Expressions", 37: "Alternating Current",
    38: "Kinematics", 39: "Phase Transitions", 40: "Progressions",
    41: "Logarithms & Computation", 42: "Wave Optics & Spectra", 43: "Derivatives",
    44: "Intro to Functions", 45: "Conservation of Energy", 46: "Plane Figures",
}

layout = json.load(open(f"{OUT}/layout.json"))
raw = {n["id"]: n for n in json.load(open(f"{OUT}/nodes.json"))}

hubs = [
    {"cluster": c["cluster"], "name": NAMES[c["cluster"]], "nameEn": NAMES_EN[c["cluster"]],
     "discipline": c["discipline"], "size": c["size"], "x": c["xy"][0], "y": c["xy"][1]}
    for c in layout["clusters"]
]

# Edges from the full centroid-similarity matrix: every hub keeps its top-3
# partners; then the strongest cross-discipline pairs are added on top so the
# math↔physics bridges (vectors↔mechanics, functions↔kinematics…) show up.
sim = layout["simMatrix"]
K = len(hubs)
disc = {h["cluster"]: h["discipline"] for h in hubs}
chosen = {}
for a in range(K):
    partners = sorted(range(K), key=lambda b: -sim[a][b])
    for b in [b for b in partners if b != a][:3]:
        chosen.setdefault((min(a, b), max(a, b)), sim[a][b])

cross = sorted(
    ((sim[a][b], a, b) for a in range(K) for b in range(a + 1, K) if disc[a] != disc[b]),
    reverse=True,
)[:6]
for s, a, b in cross:
    chosen.setdefault((a, b), s)

edges = [{"a": a, "b": b, "w": w} for (a, b), w in sorted(chosen.items(), key=lambda kv: -kv[1])]

# Content-free nodes (exercise sets, reviews, summaries, forewords) are dropped
# from the galaxy entirely — they took part in the embedding/clustering, but are
# neither stars nor labels.
import re
NO_CONTENT_ZH = re.compile(r"练习|复习题|习题|问题解答|小结|提要|引言|附录")
NO_CONTENT_EN = re.compile(r"exercise|review|problems|summary|introduction|appendix", re.I)

stars = []
dropped = 0
for n in layout["nodes"]:
    if NO_CONTENT_ZH.search(n["title"]) or NO_CONTENT_EN.search(n.get("titleEn") or ""):
        dropped += 1
        continue
    r = raw[n["id"]]
    stars.append({**n, "bookTitle": r["bookTitle"], "bookTitleEn": r.get("bookTitleEn", r["bookTitle"])})

galaxy = {"hubs": hubs, "edges": edges, "stars": stars}
APP_PUBLIC = os.path.join(HERE, "..", "..", "..", "app", "public")
for dest in (f"{WEB}/galaxy.json", os.path.join(APP_PUBLIC, "galaxy.json")):
    with open(dest, "w") as f:
        json.dump(galaxy, f, ensure_ascii=False)

cross_named = [(NAMES[e['a']], NAMES[e['b']], e['w']) for e in edges if disc[e['a']] != disc[e['b']]]
from collections import Counter
by_disc = Counter(s["discipline"] for s in stars)
print(f"hubs={len(hubs)} edges={len(edges)} stars={len(stars)} dropped={dropped} {dict(by_disc)}")
print("cross-discipline edges:", cross_named)
print("size:", os.path.getsize(f'{WEB}/galaxy.json') // 1024, "KB")
