---
id: 0006
type: tkt
author: machine
date: 2026-07-09
---

# STEMROBIN-3 done — 传记阶段/章/节结构 + 全局连续小节编号 + 每章可打印

Batch 0002-biography-structure, story S1. Merged to main (5f514c5), deployed to
production (revision on 5f514c5), verified live.

## Delivered
- `sr_story_chapters` gains `stage`/`stage_ord`/`section_start`/`section_end`/`pdf`.
- sr-story saver parses `## <global-num> <节标题>` 节, enforces cross-chapter numbering
  continuity, pre-renders a per-chapter print PDF (like sr_lessons), stores the 阶段.
- `story-contract.md` updated to the numbered-节 + 阶段 + print format.
- App: `getStoryPdf` + "下载 PDF" on the reader; catalog groups chapters by 阶段 and shows
  a §start–§end chip; numbered-节 heading CSS.
- The 3 existing Ford chapters restructured into 6 节 each (§1–6, §7–12, §13–18), vetted
  prose preserved byte-for-byte, stages 「少年与机械」/「点燃汽油机，办起车厂」, PDFs re-rendered.

## Acceptance (verified live)
- /story/ford-c02 renders numbered 节 §7–§12; catalog chips §1–6 / §7–12 / §13–18.
- Global continuity holds (DB: c01 §1–6 → c02 §7–12 → c03 §13–18).
- "下载 PDF" present; `pdf` populated for all 3 chapters (242/214/238 KB).
- Chapters grouped under 阶段 in the catalog.

## Proxy decisions (machine, conservative-delegation)
- Print = pre-rendered PDF mirroring math lessons (not a new browser-print path).
- 阶段 grouping reuses the catalog stage pattern; one `stage` label per chapter, no new table.
- Global numbering enforced by the saver via `section_end` continuity; numbers live in the md.
- Existing chapters restructured (not regenerated) to preserve gated prose.
