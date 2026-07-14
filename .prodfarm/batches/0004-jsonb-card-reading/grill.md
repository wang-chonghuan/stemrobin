# Batch 0004-jsonb-card-reading — grill 归档

来源：**released cap8 seed STEMROBIN-18**。seed 自身的 cap11 自我 grill + release-gate 裁决即本 batch 的 grill 记录
（seed-born batch 不再跑 cap7）。完整设计推演见 `.tmp/plan-card-reading.md`（v0.4）与 `.tmp/seed-drafts.md`（v2）。

## Release gate 裁决
- 模式：`full delegation`（人发起 seed，允许；人只在最后读 batch 报告并可事后否决）。
- 结果：**已放行**，草案集（6 张，≤10）整体转为工单并立批。

## cap11 自我 grill 定调（依据 charter / redlines / engineering-rules）
- **G1 内容 SSOT = DB JSONB**：ledger / 课文 content（卡片树）/ 练习 exercises 三类 JSONB 入库为唯一权威；
  HTML / 卡片 / PDF / 各语言全部 `render(jsonb)`。本地 `resources/content/math-ledger/*.json` 退场。
  依据：engineering-rules #5 SSOT + 人明确"SSOT 应是 DB 里的课文/练习 JSONB、别搞本地文件 json"。
- **G6 生成器 JSONB-first（本轮）**：`sr-math-lesson` 重建为读 DB ledger、写 content/exercises JSONB、从 JSONB 渲染 HTML/PDF。人决策。
- **G7 ledger 入库**：stage 概念账本迁入 DB JSONB。人决策。
- **G8 多语言覆盖层**：中立 base + 每 locale 文本覆盖（node_id→译文+src_rev）；只译散文，公式/SVG/KEY 继承源。
- **G5 答案保密（JSONB 版）**：KEY 存 JSONB 内，服务端先剥 KEY 再下发；初次响应不含 KEY。依据：engineering-rules 答案保密。
- **G3 数据授权**：迁移/重建可弃答题事件；`sr_users` 唯一凭据行不可动。依据：人授权 + redline #2 边界。
- **G4 批量风险**：完整内容管线重建 + 迁移 + 两学习者功能，属**大 batch**；单点=JSONB 契约/schema；
  缓解=DAG 严格串行、契约在 T2(生成器)先立、T3(迁移)复用其 render/validate。批量大小已在本档与最终报告标注。

## Feasibility 探针（已验证）
- 共享 Postgres：可读可写（已抽样 16 篇课 + schema）。
- 老课 HTML 切分：`<section data-sr-section>` 结构规整，16 篇一致；末尾 `practice` 为练习注入区，迁移须排除。
- 公式/SVG 语言中立（每篇 10–21 处 KaTeX、0–2 SVG），佐证"只译散文"。
- 译文由开发 agent 产、saver 落库，无第三方 API、无新成本（守 redline #3 / 无冗余依赖铁律）。
