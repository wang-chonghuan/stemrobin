# Batch 0009-figure-aware-lessongen — 工单清单（冻结）
Seed：STEMROBIN-49（full delegation）· 1 seed = 1 batch

| 工单 | 类型 | 摘要 | blocked_on |
|---|---|---|---|
| STEMROBIN-50 | enabler | build 期 spec→SVG 图生成器（静态、correct-by-construction） | — |
| STEMROBIN-51 | enabler | 蓝图优先流水线 + 事中/草案检验 + 去图预设（必要性纪律） | 50 |
| STEMROBIN-52 | enabler | 练习题带图（deck figure 字段 + sr_questions 列 + save/render + app 非转义渲染） | 50 |
| STEMROBIN-53 | chore | 用新流程重生成圆 10.1/10.2 + 3.5 代数反向验证（不保存） | 50,51,52 |

DAG：50 → {51, 52} → 53。
