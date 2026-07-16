# IntentMill Handoff — STEMROBIN-41

## Actual Changes
- `app/src/routes/_app/lesson.$id.tsx`
  - Loader now always fetches `html = getLessonHtml(id)` (serves both 全文速览 and the
    no-card-tree fallback); removed the 速览-only `questions = getLessonQuestions(...)`
    field and its destructure.
  - 全文速览 branch now renders the stored skill html in the existing sandboxed
    `LessonFrame` iframe (with a null-`html` → `lesson.notReady` guard), replacing the
    `buildFullTextHtml(...)` srcDoc. Removed the `buildFullTextHtml` import; kept
    `getLessonReading` (card view) and `getLessonQuestions` (QuizDrawer prop).
- `app/src/lib/reading.ts` — removed the dead second renderer: `buildFullTextHtml`,
  `exercisesHtml`, `escapeHtml`, and the `FullTextExtras`/`FullTextQuestion` types.
  `getLessonReading`, `projectCards`, `judgeReadCheck`, `recordReadCheck` unchanged.
- `app/src/lib/reading-fulltext.test.ts` — deleted (its subject `buildFullTextHtml`
  is gone; `projectCards` stays covered by `reading.test.ts`).
- `app/src/lib/i18n.ts` — removed the now-orphaned `read.exercises` key (zh + en).

## Spec And Plan Alignment
Implementation matches `im-spec.md` and follows `im-plan.md` exactly; no deviation.
- Spec obligations: 速览 renders the stored PDF-quality html (numbered
  `.sr-sec-num`/`.sr-sec-label` sections + styled 练习/课后题) — verified in browser;
  one full-text source (second renderer removed); 课后题 display-only (0
  buttons/inputs/forms, no KEY leak); formulas render (263 `.katex`); mobile 375 no
  horizontal overflow; 逐卡精读 flow, login gate, dependencies untouched.
- Plan obligations: loader rewire, fulltext branch swap, dead-code removal, dead-test
  deletion, i18n cleanup — all done. UT-1/UT-2/UT-3 + BV-1 executed (see
  `tests/test-results.md`).
- Critical existing contracts preserved: `LessonFrame` sandbox + height lifecycle,
  `getLessonReading` KEY-free projection, `recordReadCheck` server judging, QuizDrawer
  independent fetch, answer-key secrecy (no KEY reintroduced).
- Non-scope / rejected absent: no second renderer, no answer keys in 速览, no
  card-flow / practice / PDF / catalog changes, no DB/content changes, no new
  dependency, only `app/` touched.
- Test obligations: covered per the Coverage Map in `tests/test-results.md`.

## User Review Points
None. All four blocking decisions were self-adjudicable from the seed intent, seed
grill (G-A, G-3), and charter engineering-rule 5 (SSOT / one way) — see `im-grill.md`.

## Residual Issues And Future Improvements
- The 全文速览 branch only appears when the lesson has a card tree (`reading != null`);
  a full-html-only lesson still shows the plain fallback view with no toggle. Not
  required by this spec; noted for a future lesson family.
- `app/package-lock.json` was modified by a local `npm install` (optional-platform-dep
  pruning) and reverted; the worktree needs `cd app && npm install` before dev/test.
