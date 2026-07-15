# 0014 tkt STEMROBIN-19

- kind: tkt
- ticket: STEMROBIN-19
- type: enabler
- batch: 0004-jsonb-card-reading
- merge_commit: d8f5499
- seed: STEMROBIN-18
- consumes: []

## Background
Batch 0004 的地基单：把内容 SSOT 从"HTML/本地文件"迁为 **DB JSONB**（seed G1）。所有后续单（生成器/迁移/精读/翻译/端到端）都 blocked_on 它。

## Decision
在 `stemrobin.sql` 加法式、幂等地新增 JSONB 内容结构：
- `sr_lessons.content` / `.exercises`（中立卡片树 + 练习 deck SSOT，含答案 KEY）；
- `sr_content_ledger`（每 stage 概念账本入库）；
- `sr_lesson_i18n`（每 locale 文本覆盖 `node_id→{t,src_rev}`，**仅散文、无 KEY**）；
- `sr_content_answer_events`（卡片/练习作答事件，可弃数据）。

答案保密（G5）由**结构**保证：KEY 只在中立 base JSONB，覆盖表无 KEY 列。多语言覆盖层用 node 级 `rev` + 覆盖 `src_rev` 做陈旧检测。仅 schema，不含生成器/迁移/UI/翻译（留给 20–24）。

## Consequences
- DDL 已应用共享 Azure Postgres（幂等，两次 exit 0）；仅改 `stemrobin.sql`，app 镜像不变 → **无需重部署**，交付即 live。
- 新列 NULL / 新表空，直到迁移(21)填充；旧 `sr_questions`/`sr_answer_events`、`sr_lessons.html/pdf` 仍为现役源，待后续单退役。
- cap9 独立验收：psql 实测结构在库、KEY 隔离成立、`sr_users` 2 行完好；app 单测 16/16 绿。

## Proxy decisions
cap13 等价自裁（依据 charter/binding design，人可事后否决）：
- **BD1**：`zh` 作为覆盖层的一行（源语言本身也是 overlay），而非在 base 内联中文散文 → 依据 seed G8（结构中立 + 每 locale 覆盖）。基础：翻译单元一致、加语言不动 base。
- **BD2**：对共享生产库用**加法式 DDL**（`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`），不删任何现役表 → 依据 redline #2 + D12 授权边界（仅答题事件可弃、`sr_users` 不可动）。
