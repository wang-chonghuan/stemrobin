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
    0: "平面图形", 1: "电磁现象", 2: "幂与指数", 3: "三角函数", 4: "压强与浮力",
    5: "算术与分数", 6: "半导体与导电", 7: "电磁波与无线电", 8: "对称与作图",
    9: "热力学与分子运动", 10: "空间直线与平面", 11: "方程组与不等式",
    12: "等差与等比数列", 13: "运动学", 14: "振动与交流", 15: "正负数运算",
    16: "原子核与粒子", 17: "指数与对数函数", 18: "向量", 19: "光的波动与光谱",
    20: "电场与电容", 21: "机械能守恒", 22: "四边形与面积", 23: "三角比",
    24: "数与式", 25: "数列与极限", 26: "晶体与物态", 27: "力与运动",
    28: "函数初步", 29: "多面体与体积", 30: "二次方程", 31: "导数",
    32: "多项式与因式分解", 33: "几何光学", 34: "物态变化", 35: "分式与有理式",
    36: "重力与万有引力", 37: "磁场与电磁感应", 38: "对数与计算",
    39: "热量与热传递", 40: "电流与电路", 41: "功与简单机械",
    42: "旋转体与球", 43: "小数与百分数",
}

NAMES_EN = {
    0: "Plane Figures", 1: "Electromagnetic Phenomena", 2: "Powers & Exponents",
    3: "Trigonometric Functions", 4: "Pressure & Buoyancy", 5: "Arithmetic & Fractions",
    6: "Conduction & Semiconductors", 7: "EM Waves & Radio", 8: "Symmetry & Constructions",
    9: "Thermodynamics & Kinetic Theory", 10: "Lines & Planes in Space",
    11: "Systems of Equations", 12: "Progressions", 13: "Kinematics",
    14: "Oscillations & AC", 15: "Signed Numbers", 16: "Nucleus & Particles",
    17: "Exponential & Log Functions", 18: "Vectors", 19: "Wave Optics & Spectra",
    20: "Electric Fields & Capacitance", 21: "Conservation of Energy",
    22: "Quadrilaterals & Area", 23: "Trigonometric Ratios", 24: "Numbers & Expressions",
    25: "Sequences & Limits", 26: "Crystals & States of Matter", 27: "Force & Motion",
    28: "Intro to Functions", 29: "Polyhedra & Volume", 30: "Quadratic Equations",
    31: "Derivatives", 32: "Polynomials & Factoring", 33: "Geometric Optics",
    34: "Phase Transitions", 35: "Rational Expressions", 36: "Gravity & Gravitation",
    37: "Magnetic Fields & Induction", 38: "Logarithms & Computation",
    39: "Heat & Heat Transfer", 40: "Current & Circuits", 41: "Work & Simple Machines",
    42: "Solids of Revolution", 43: "Decimals & Percentages",
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

stars = []
for n in layout["nodes"]:
    r = raw[n["id"]]
    stars.append({**n, "bookTitle": r["bookTitle"], "bookTitleEn": r.get("bookTitleEn", r["bookTitle"])})

galaxy = {"hubs": hubs, "edges": edges, "stars": stars}
with open(f"{WEB}/galaxy.json", "w") as f:
    json.dump(galaxy, f, ensure_ascii=False)

cross_named = [(NAMES[e['a']], NAMES[e['b']], e['w']) for e in edges if disc[e['a']] != disc[e['b']]]
print(f"hubs={len(hubs)} edges={len(edges)} stars={len(stars)}")
print("cross-discipline edges:", cross_named)
print("size:", os.path.getsize(f'{WEB}/galaxy.json') // 1024, "KB")
