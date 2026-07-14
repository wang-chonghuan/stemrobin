# Batch 0004-jsonb-card-reading — 工单清单（冻结）

Seed：STEMROBIN-18（full delegation）· 1 seed = 1 batch

| 工单 | 类型 | 摘要 | blocked_on |
|---|---|---|---|
| STEMROBIN-19 | enabler | 建立 JSONB 内容 SSOT 数据结构 | — |
| STEMROBIN-20 | enabler | 重建数学课生成器为 JSONB-first | 19 |
| STEMROBIN-21 | enabler | 迁移既有数学内容进 JSONB SSOT | 19, 20 |
| STEMROBIN-22 | story | 实现数学课卡片式精读流 | 19, 21 |
| STEMROBIN-23 | enabler | 构建英文译文覆盖层生成流程 | 19, 20, 21 |
| STEMROBIN-24 | story | 实现语言切换与英文数学端到端 | 22, 23 |

DAG 拓扑序（cap4 pick 顺序仅遵此）：19 → 20 → 21 → 22 → 23 → 24
（19→20→21→22；21→23；{22,23}→24）
