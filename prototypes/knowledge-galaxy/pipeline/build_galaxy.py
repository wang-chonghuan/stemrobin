#!/usr/bin/env python3
"""Merge layout.json + hub names into web/galaxy.json for the prototype."""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
WEB = os.path.join(HERE, "..", "web")

# Cluster names, reviewed against each cluster's nearest-to-centroid samples.
NAMES = {
    0: "相似形", 1: "电磁感应", 2: "函数初步", 3: "数与式", 4: "平面图形",
    5: "功与简单机械", 6: "机械振动", 7: "电场与电能", 8: "光谱与光子",
    9: "热力学", 10: "二次方程", 11: "向量", 12: "三角比", 13: "数轴与坐标",
    14: "机械能守恒", 15: "算术与分数", 16: "空间直线与平面", 17: "电流与电路",
    18: "导数", 19: "力与运动", 20: "指数与对数函数", 21: "压强与浮力",
    22: "代数式与因式分解", 23: "原子模型", 24: "几何体与体积", 25: "分子运动论",
    26: "数列与极限", 27: "对称与作图", 28: "力的初步", 29: "正负数运算",
    30: "热量与热传递", 31: "物质结构", 32: "幂与指数", 33: "声与波动",
    34: "原子核与粒子", 35: "线性方程组", 36: "运动学", 37: "几何光学",
    38: "交流电与电磁波", 39: "四边形与面积", 40: "重力与万有引力",
    41: "三角函数", 42: "等差与等比数列", 43: "对数与计算",
}

layout = json.load(open(f"{OUT}/layout.json"))
raw = {n["id"]: n for n in json.load(open(f"{OUT}/nodes.json"))}

hubs = [
    {"cluster": c["cluster"], "name": NAMES[c["cluster"]], "discipline": c["discipline"],
     "size": c["size"], "x": c["xy"][0], "y": c["xy"][1]}
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
    stars.append({**n, "bookTitle": r["bookTitle"]})

galaxy = {"hubs": hubs, "edges": edges, "stars": stars}
with open(f"{WEB}/galaxy.json", "w") as f:
    json.dump(galaxy, f, ensure_ascii=False)

cross_named = [(NAMES[e['a']], NAMES[e['b']], e['w']) for e in edges if disc[e['a']] != disc[e['b']]]
print(f"hubs={len(hubs)} edges={len(edges)} stars={len(stars)}")
print("cross-discipline edges:", cross_named)
print("size:", os.path.getsize(f'{WEB}/galaxy.json') // 1024, "KB")
