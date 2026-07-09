# Story Page (scientist biographies)
- Behavior: renders generated biography stories linked from the catalog. Each biography
  reads as 阶段 → 章 → 节: chapters group into named 阶段 in the catalog, and each chapter is
  divided into numbered 节 whose numbers are **globally continuous** across the whole book
  (a reader can cite "§N"). Each chapter is downloadable as a pre-rendered print PDF
  ("下载 PDF"), the same way math lessons print.
- Entry: `/story/$id` (app/src/routes/_app/story.$id.tsx, app/src/lib/stories.ts — `getStoryPdf`,
  stage/section fields on the catalog)
- Data: `sr_story_chapters(stage, stage_ord, section_start, section_end, pdf)`; authored via
  the `sr-story` skill (numbered `## <global-num>` 节, saver enforces continuity + renders PDF).
- Source tickets: SR-2-biography-generation (pre-registered); STEMROBIN-3 (batch 0002 — staged/section structure + PDF)
