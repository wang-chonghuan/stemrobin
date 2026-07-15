# 0016 tkt STEMROBIN-21

- kind: tkt
- ticket: STEMROBIN-21
- type: enabler
- batch: 0004-jsonb-card-reading
- merge_commit: 37f0efa
- seed: STEMROBIN-18
- consumes: []

## Background
把 16 篇真实数学课 + stage ledger 迁入 JSONB SSOT（seed G1），**不重新生成课文**。解锁 T4(精读 UI)/T5(翻译)。复用 T2 的 render/validate 能力。

## Decision
仅改 `.agents/skills/sr-math-lesson/`：新增 `migrate-lib.mjs`（纯提取）/`migrate-lesson.mjs`/`migrate-all.mjs`；`render-lesson.mjs` 加向后兼容的 `html` prose role（使派生 HTML 逐字复现原 block 标记）。刻意**不走** `save-lesson.mjs`（其人类大纲 gate 会因 STEMROBIN-17 stage-2 冲突拒绝）。
每课：`sr_lessons.html` 按 `<section data-sr-section>` 解析为卡片树 `content`（排除 practice 注入区）；`sr_questions`→`exercises`（1:1）；每实质卡补 ≥2 read-check（15 个并行 authoring 子代理）；散文入 `zh` 覆盖层；从 JSONB 重渲 html/pdf。ledger 本地文件 → `sr_content_ledger`。

## Consequences
- 仅 skill 代码 + DB 数据变更，无 app/Dockerfile/ssot-schemas → **无需重部署**（重渲 html 已在库、现役 iframe reader 直接可用）。
- cap9 独立验收：16/16 课有 content+exercises；130 read-checks；exercises 331 = sr_questions 331（1:1）；ledgers 入库（s2:8 / s3:11）；**16 篇 prose diff 全 IDENTICAL（课文逐字节未变）**；zh 覆盖层 KEY 泄漏=0；派生 html 16/16 非空、0 KEY；幂等（重跑字节一致）；app 渲染 /lesson/math-s2-03 正常。
- 数据授权：仅读 sr_questions（现役 quiz 仍用），未删答题事件；每课有原文快照+diff（worktree `refs/migration/`）可审计回滚。`sr_users`(2)、16 课目录身份、sr_questions(331) 全保留。
- 遗留（非阻塞）：save-ledger 重跑因 JSONB 键序 bump src_rev（T2 既有行为，数据稳定）；旧 `sr_questions.answer` 逐题解析按 BD1 未入 exercises（留在 sr_questions+快照）；开发中修了一个自渲染再解析导致的非幂等缺陷（改为读 pristine 快照）。

## Proxy decisions
grill 全部 cap13 等价自裁，无 grill-leak。核心：复用 T2、不走 save-lesson（避 STEMROBIN-17）、practice 区排除、prose 逐字保真、答题事件可弃而 sr_questions 现役保留。
