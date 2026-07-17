# Batch 0008-render-katex-hardening — 工单清单（冻结）
Seed：STEMROBIN-45（full delegation）· 1 seed = 1 batch

| 工单 | 类型 | 摘要 | blocked_on |
|---|---|---|---|
| STEMROBIN-46 | fix | 根治 render-lesson 的 $&/{{SECTIONS}} 替换乱码 + 加「$…$ 内裸<字母」校验 | — |
| STEMROBIN-47 | chore | 修 3.9 例3 的 $2<x$、扫查三课并重存（clean html + sr_questions） | 46 |

DAG：46 → 47（chore 依赖渲染器修好后再重存）。
