# 0022 batch 0005-progress-and-access

- kind: batch
- batch: 0005-progress-and-access
- charter_commit: 本 boundary 直推 main（仅 .prodfarm 立批归档，无 charter 五文件改动）

## Decisions and rationale

由 seed STEMROBIN-26（full delegation）驱动，1 seed = 1 batch。承 batch 0004 的卡片精读 + 英文数学之上，补三块产品能力 + 一个 bug 修复：
① 全文速览（不答题也能看整篇课文、不计进度）；② read-check 公式渲染修复；③ 每课两个进度点（课文=走完卡片、练习=最近一次 ≥80%）+ 首页真进度条（总点=2×课数、跨语言合一）；④ 全站登录门禁（无注册、仅现有账号）。

与 0004 不同：本 seed 的 seed 级问题由**人在会话中亲自 grill 并裁决**（练习完成口径=最近一次 ≥80% 可回退、只存最近两次；课文完成=走完卡片；进度跨语言合一；无注册全站登录），记录见 batch grill.md。

5 张工单，DAG：29→30；27/28/31 独立。风险低（多为 app 层 + 一处小 schema 加法）。

## Deferred

- 名人传记 / stage-2 大纲对齐（STEMROBIN-17）/ 遗留 relational 脚本清理 —— 仍留后续 seed。
- 练习 attempt 只留最近两次（人明确要求），不做完整历史/趋势分析。

## Veto handling

none。

## Charter changes

无（charter 五文件未改）。全站登录门禁沿用现有 charter 的"无账号创建"，未改北极星。仅 `.prodfarm/` 立批归档直推 main。
