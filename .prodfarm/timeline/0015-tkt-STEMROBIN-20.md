# 0015 tkt STEMROBIN-20

- kind: tkt
- ticket: STEMROBIN-20
- type: enabler
- batch: 0004-jsonb-card-reading
- merge_commit: aac944b
- seed: STEMROBIN-18
- consumes: []

## Background
承接 T1 的 JSONB SSOT，把数学课生成器 `sr-math-lesson` 从 HTML-first + 本地 ledger 文件重建为 **JSONB-first**（seed G6/G7），让新课直接以 DB JSONB 为权威、HTML/PDF 派生。T3(迁移)/T5(翻译) 复用其 render/validate/save 能力与 `zh` 源覆盖层。

## Decision
仅改 `.agents/skills/sr-math-lesson/`：
- 新增 `ledger-core.mjs`（闭包 SSOT）/`db.mjs`/`save-ledger.mjs`（ledger→`sr_content_ledger`）/`check-content.mjs`（卡片树+编号+read-check+覆盖层无 KEY）/`render-lesson.mjs`（从 JSONB 渲 HTML/PDF，复用 lesson-template，永不读 `item.key`）；
- 重写 `save-lesson.mjs`（单一 saver：读 DB ledger→校验→渲 HTML+PDF→upsert content/exercises/html/pdf + `sr_lesson_i18n('zh')`）、`check-exercises.mjs`（JSONB items 形态）、`check-ledger.mjs`。
- 散文入 `zh` 覆盖层（node_id 键）；公式/SVG/KEY 留中立 base；read-check 入每卡 `read_check[]`。

## Consequences
- 仅 skill 改动，无 app/Dockerfile/ssot-schemas 变更 → app 镜像不变，**无需重部署**。
- cap9 独立验收：样例课经生成器 → DB 有 ledger/content(5卡)/exercises(16题) + 769KB 真实 PDF；每卡编号、实质卡有 read-check、oral 排除；渲染 HTML grep 无 KEY；单测 20/20 绿；ledger 读自 DB（无本地文件）；样例清理、16 课 + `sr_users`(2) 完好。
- 遗留（governor 记录，非阻塞）：evodocs `mod--content-generation*` 仍述旧管线（待 n-evodocs 事后调和）；旧 `choice-deck.mjs`/`backfill-choice-decks.mjs`（旧 `sr_questions` 助手）按外科原则保留；T3/T5 解锁。

## Proxy decisions
6 个 grill 阻塞问题全部 cap13 等价自裁（依据 charter + T1 schema 契约 + 设计文档），无 grill-leak。核心：ledger-from-DB 作为唯一源、散文/公式/KEY 三分、read-check 归卡、样例可弃且清理。
