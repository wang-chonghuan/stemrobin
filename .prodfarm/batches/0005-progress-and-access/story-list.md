# Batch 0005-progress-and-access — 工单清单（冻结）

Seed：STEMROBIN-26（full delegation）· 1 seed = 1 batch

| 工单 | 类型 | 摘要 | blocked_on |
|---|---|---|---|
| STEMROBIN-27 | fix | read-check 数学公式渲染修复（+ 抽查转换正确性） | — |
| STEMROBIN-28 | story | 课程页全文速览模式（无 read-check、不计进度） | — |
| STEMROBIN-29 | enabler | 练习 attempt 数据模型（存最近两次）+ 进度计算 | — |
| STEMROBIN-30 | story | 练习按次计分 + 首页真进度条（取代假进度） | 29 |
| STEMROBIN-31 | story | 全站登录门禁（无注册，仅现有账号） | — |

DAG：29 → 30；27 / 28 / 31 独立。开发顺序建议：27/28/29/31 可并行，30 待 29。
