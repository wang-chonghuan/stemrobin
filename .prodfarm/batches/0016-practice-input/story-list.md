# Batch 0016-practice-input — 工单清单
Seed：STEMROBIN-116（人类意图 · 全权委托 · release gate 2026-08-03）· 1 seed = 1 batch
目标：把练习从「必须用数学键盘打字」改成「大多数题点一下或按数字就能答」，并把「这道题怎么答」这一层补进内容管线。

| 工单 | 类型 | Lane | 摘要 | blocked_on |
|---|---|---|---|---|
| STEMROBIN-117 | fix | express | 默认界面语言改为中文（反转 111 的默认英文） | — |
| STEMROBIN-118 | fix | express | 数值题改用数字输入，作答框显示小问标签与单位 | — |
| STEMROBIN-119 | fix | express | 答错允许重试，标准答案延到第二次答错才揭晓 | — |
| STEMROBIN-120 | enabler | standard | ld-s10y-answer cap3：习题交互规格契约与产线 | — |
| STEMROBIN-121 | story | standard | 坐标网格题在图上点选作答（第 16 课） | 120 |

> blocked_on 未写进后端：Plane 公有 v1 API 没有 issue-relation 端点（实测 404）。依赖关系以本表为准，由 cap4 按表排序。

## 范围约束（人给定，对全批生效）

1. 只针对已上线的三课 `math5-c1-s1-n1` / `math5-c1-s2-n13` / `math5-c1-s2-n16`，不得生成或发布其他课。
2. 不得重新抽取或改编这三课的课程内容（不重跑 assemble / adapt / render）；交互规格是叠加层。
3. 主要交付物是技能的改进，产品端改动只服务于验证。
4. 不得引入任何新依赖。

## cap11 自我 grill 定的两件事

1. **Lane 不能全部 express。** 人要求「必须用 express 模式」，但 120（新增 `lesson-interactions@1` 契约）违反谓词 2「无契约变更」，121（坐标点选是本地不存在的 UI 形态）违反谓词 3「无未定 UI 选择」。按 ticket-contract 的非对称规则，任何人都不能在谓词不成立时设 express，故二者 standard。此项由规则裁定，不是 grill 泄漏。
2. **草案集从 10 收敛到 5。** 每张工单都要走 worktree + 验收 + 合并 + 重部署，跑不完的风险高于价值；额度留给批内自建的 fix。

## Deferred（实测确认存在，本批不做，留作后续 seed）

- 第 1 课图形归类控件（6 小问共用 1 个作答框，且不判分）。
- 错题本只显示「Book 5m / Exercise 5」，无课名与题面。
- 上一课/下一课按大纲走，会落到无内容的空卡。
- 课文页 Save 与 Ask AI 是无 onClick 的死按钮。
- 第 1 课图注渲染成「图 1图 2」合并一行；图自身 label 从不显示。
- FigureSpec 仅有 objectCount 断言：实测 fig-67 的 y 轴刻度 7 破坏 55px 等距（应 474，实际 464）。
