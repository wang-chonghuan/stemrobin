# 0013 batch 0004-jsonb-card-reading

- kind: batch
- batch: 0004-jsonb-card-reading
- charter_commit: 本 boundary 提交（含 `charter/goal.md` 扩张 + 本 batch 立批归档，直推 main）

## Decisions and rationale

由 seed STEMROBIN-18（full delegation）驱动，1 seed = 1 batch。本 batch 一次交付两个需求：
① 数学课**卡片式精读**（防跳读）；② **英文版数学**（多语言首个 locale = en）。

核心架构定调（cap11 自我 grill，详见 batch grill.md）：**内容 SSOT 迁为 DB JSONB**——ledger / 课文 / 练习
三类 JSONB 入库为唯一权威，HTML/卡片/PDF/各语言全部从 JSONB 派生；本地 ledger 文件退场；生成器 `sr-math-lesson`
本轮重建为 JSONB-first。这是人明确要求"SSOT 应是 DB 里的课文/练习 JSONB、别搞本地文件 json、设计要干净不留遗留妥协"的落地。

6 张工单，DAG 串行（19→20→21→22；21→23；{22,23}→24）。**批量偏大**（含完整内容管线重建），
单点风险=JSONB 契约/schema；缓解=契约在 T2 先立、T3 迁移复用、严格拓扑序开发。人已授权 full delegation 承担该风险。

数据边界（redline #2 授权范围）：迁移/重建可弃答题事件；唯一必须保留 = 当前唯一用户 `sr_users` 凭据行。

## Deferred

- **名人传记卡片化**：本轮只做数学；传记复用同一 JSONB 卡片模型是将来的事。
- **学习进度真实化（D6）**：`sr_card_read_events` 本轮只记录不消费；首页真进度以后单独接。
- **read-check "定位型"新题型（D14）**：本轮只用 choice/input，不引新题型。

## Veto handling

none（首个由本 seed 驱动的 batch，无历史 proxy 决策待否决）。

## Charter changes

`charter/goal.md` 追加两条（人确认 2026-07-14）：
1. 学习方式 = 卡片式精读（课文不变、打散成带编号卡片、逐卡 read-check 防跳读）。
2. 多语言 = 面向多语言学习者（目标 7–8 种，首个英文），数学以中文为源语言、公式标准记法跨语言共享。
影响分析：该扩张正由本 batch 实现，无需额外 `spec_diff` 适配工单（本 batch 即适配）。未单独 git commit（charter_commit: none）。
