#!/usr/bin/env python3
"""Embed node texts (bge-small-zh), reduce to 2D with UMAP, cluster with KMeans.

Outputs out/layout.json: per-node xy + cluster id, plus per-cluster member
sample titles for naming, centroid xy, and centroid-similarity edge candidates.
"""

import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

nodes = [n for n in json.load(open(f"{OUT}/nodes.json")) if n["kind"] != "exercises"]
texts = [n["text"] for n in nodes]
print(f"embedding {len(texts)} texts...", flush=True)

from sentence_transformers import SentenceTransformer

model = SentenceTransformer("BAAI/bge-small-zh-v1.5")
emb = model.encode(texts, normalize_embeddings=True, show_progress_bar=True, batch_size=64)
emb = np.asarray(emb, dtype=np.float32)
np.save(f"{OUT}/embeddings.npy", emb)
print("embeddings:", emb.shape, flush=True)

import umap
from sklearn.cluster import KMeans

reducer = umap.UMAP(n_components=2, n_neighbors=20, min_dist=0.35, metric="cosine", random_state=42)
xy = reducer.fit_transform(emb)
xy = (xy - xy.mean(axis=0)) / xy.std(axis=0)  # normalize to ~unit scale

K = int(sys.argv[1]) if len(sys.argv) > 1 else 44
km = KMeans(n_clusters=K, n_init=10, random_state=42)
labels = km.fit_predict(emb)

clusters = []
for k in range(K):
    idx = np.where(labels == k)[0]
    cent = km.cluster_centers_[k]
    cent = cent / np.linalg.norm(cent)
    # members closest to centroid first — best representatives for naming
    sims = emb[idx] @ cent
    order = idx[np.argsort(-sims)]
    disciplines = [nodes[i]["discipline"] for i in idx]
    clusters.append({
        "cluster": k,
        "size": int(len(idx)),
        "discipline": max(set(disciplines), key=disciplines.count),
        "xy": [float(v) for v in xy[idx].mean(axis=0)],
        "sample": [nodes[i]["title"] for i in order[:14]],
        "centroid": cent,
    })

# full hub-hub centroid cosine similarity matrix
cents = np.stack([c["centroid"] for c in clusters])
sim = cents @ cents.T
for c in clusters:
    del c["centroid"]

out = {
    "nodes": [
        {**{k: n[k] for k in ("id", "title", "titleEn", "kind", "discipline", "branch", "grade", "book", "chapter", "chapterEn")},
         "x": float(xy[i][0]), "y": float(xy[i][1]), "cluster": int(labels[i])}
        for i, n in enumerate(nodes)
    ],
    "clusters": clusters,
    "simMatrix": [[round(float(v), 4) for v in row] for row in sim],
}
with open(f"{OUT}/layout.json", "w") as f:
    json.dump(out, f, ensure_ascii=False)
print("wrote layout.json", flush=True)
for c in clusters:
    print(c["cluster"], c["discipline"], c["size"], "|", " / ".join(c["sample"][:6]))
