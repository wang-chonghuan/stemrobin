# Batch 0002-biography-structure — cap7 grill record

Human draft (verbatim intent): 用 sr-story 续写福特传记若干章;每章分带编号的小节(1、2、3);**全书维持同一套小节序号(全局连续)**,便于读者引用定位;传记要长、分阶段/章/节;每章可打印(像数学课);已生成的老传记也改成此结构。最多三个工单,别搞复杂,batch 内保守、对齐现有产品、尽量不打扰人类。

Adjudication note: the human pre-delegated all grill rulings to the machine with a **conservative / align-with-existing-product** policy and asked to minimize intervention. Rulings below are the machine's conservative dispositions under that delegation; none required the human.

## Draft story list (interrogated)
- D1: sr-story 章节升级为「阶段/章/节」结构 + 全局连续小节编号 + 每章可打印。
- D2: 把现有福特传记(3 章)改造成新结构。
- D3: 续写福特若干新章(新结构、接续编号)。

## cap11 interrogation + dispositions

**Feasibility (live-probed).**
- Per-chapter PDF: the math side already pre-renders a print PDF (`save-lesson.mjs renderPdf` via Playwright `page.pdf`, `@media print` page-breaks) and the lesson page has a download button (`getLessonPdf`). Mirroring this for stories is proven. PASS.
- Story rendering already does md→html server-side (`getChapterView`, `/story/$id`). Adding numbered sections + a stage grouping + a download button is additive. PASS.
- Global continuous numbering: authored as running numbers in the chapter Markdown; the saver validates continuity against the previous chapter (prev last section + 1). No new engine. PASS.
- DB: `sr_story_chapters` currently has no `pdf` column (stories were "no PDF by design"). Print requires adding it — the one necessary schema change. PASS.

**Completeness / constraint challenge.**
- "阶段/stage" home → **ruling (conservative)**: reuse the product's existing stage-grouping pattern (the catalog groups math by stage); represent a chapter's stage as a lightweight label carried by the outline/chapter, rendered in the catalog/nav. Do **not** build a separate stages table.
- "printable like math" → **ruling**: a pre-rendered per-chapter PDF + download button, mirroring the math lesson exactly (not a new browser-print mechanism).
- Global numbering scope → **ruling**: section numbers are continuous across the **whole** biography; chapter N's first section = chapter N-1's last section + 1; the saver enforces it.

**Decomposition (machine recommendation, conservative).**
- A bare "mechanism" story cannot be black-box accepted with no chapter in the new format, so **D1 + D2 are merged into one story S1** (mechanism + convert the existing 3 Ford chapters) — a genuine vertical slice (open ford-c01: staged, numbered sections, downloadable PDF). D3 becomes **S2** (extend). Final count: **2 stories** (within the human's "≤3", simpler).

**Risk / redlines.**
- S1 re-saves the existing 3 Ford chapters (overwrites their `md`). These are `status='draft'`, user-requested, and reproducible from the public-domain source — **not** a redline #2 (production-data pollution). Recorded, not blocking.
- No charter change (this evolves the existing `story-page` feature). No redline hit (no destructive external writes, no spend, `goal.md` untouched).

**Timeline note consumption.** Only unconsumed note is `0004` (repo restructure) — machine, already actioned; nothing to promote into this batch.

## Finalized story list (handed to cap3)
- **S1** — 传记升级为阶段/章/节结构 + 全局连续小节编号 + 每章可打印(下载 PDF),并把现有福特传记 3 章改造成新结构。 `origin: human`, blocked_on: none.
- **S2** — 续写福特传记 ≥3 新章,沿用新结构与全局连续小节编号。 `origin: human`, blocked_on: [S1].

## Deferred / forced-through
- Deferred: none. Forced-through: none. All dispositions are conservative align-with-product rulings; no item was forced past a real objection.
