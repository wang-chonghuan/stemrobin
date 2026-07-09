# Batch 0002-biography-structure — closeout report

Status: **done**. Both stories delivered, verified live in production, closed.

## Delivery summary
The 名人传记 feature now reads like a real book: **阶段 → 章 → 节** with **globally-continuous
节 numbers** across the whole biography, and every chapter is a downloadable print PDF (the
same way math lessons print). The Ford biography grew from 3 → **6 chapters, 34 节 (§1–§34),
4 阶段**, all continuous.

- **STEMROBIN-3 (S1)** — structure/print mechanism + converted the 3 existing Ford chapters.
  Schema (`stage`/`stage_ord`/`section_start`/`section_end`/`pdf`), sr-story saver (numbered-节
  parse + cross-chapter continuity + PDF render), `story-contract.md`, app (`getStoryPdf` +
  "下载 PDF", catalog 阶段 grouping + §-range chip, numbered-节 CSS). Merged (5f514c5), deployed,
  verified. Existing 3 chapters restructured into 6 节 each, **vetted prose preserved
  byte-for-byte**. See timeline/0006.
- **STEMROBIN-4 (S2)** — 3 new Ford chapters (Model T / assembly line / $5 day) from the
  public-domain source, continuing §19–§34, each with PDF + questions. Content-only; live via
  the S1 deploy. See timeline/0007.

## Proxy decision list (human veto menu — review at the next boundary)
1. **Print = pre-rendered PDF** mirroring math lessons (not a new browser-print path). [S1]
2. **阶段 grouping reuses the catalog stage pattern**, one `stage` label per chapter, no new
   stages table. [S1]
3. **Global 节 numbers live in the Markdown**, enforced by the saver via `section_end`
   continuity (chapters must be saved in order). [S1]
4. **Existing chapters restructured, not regenerated** — to preserve the gated prose. [S1]
5. **New-chapter arc** = Model T → assembly line → $5 day (chosen from the source to continue
   after c03). [S2]
6. **Stages**: 少年与机械 / 点燃汽油机，办起车厂 / 为所有人造车 / 工厂与工钱. [S1+S2]
7. Chapters remain **`status='draft'`** (not promoted to published). [both]

## Gap register increment
None. No aborts, no blockages, no pending-human items.

## Note (in-batch discovery, not a course change)
The first c04 draft duplicated c03 (a source-slice overlap in Ford's book); caught in review and
re-authored with a no-overlap constraint. Lesson for future biography extension: when slicing a
non-chronological source, check new chapters against already-covered events before authoring.
