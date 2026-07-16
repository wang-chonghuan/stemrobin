# im-draft — STEMROBIN-41 · 全文速览改用 skill 渲染 html 对齐 PDF

## Intent restated
The 全文速览 (full-text preview) tab of a math lesson currently renders through a
second, home-grown renderer (`buildFullTextHtml` in `app/src/lib/reading.ts`) that
re-assembles the reading cards into a plain layout: section names with no number,
课后题 as a bare `<ol>`. The PDF looks far better because it is produced by the
content skill's `render-lesson.mjs`, which is also what is persisted into
`sr_lessons.html`. STEMROBIN-40 just re-rendered all 16 lessons' `sr_lessons.html`
from the JSONB, so the stored html is now the PDF-quality render (numbered
`sr-sec-num` section labels, restored 中文名, styled 练习/课后题 section).

Make 全文速览 render that stored skill html verbatim instead of `buildFullTextHtml`,
then remove the now-dead second renderer so there is one source of full-text HTML.

## Code grounding
- `app/src/routes/_app/lesson.$id.tsx` — the 逐卡精读 | 全文速览 toggle (STEMROBIN-28).
  - Loader returns `reading` (card tree, KEY-free), `questions` (KEY-free 课后题 for
    the 速览 list), `html` (stored full html, currently fetched only as the
    no-card-tree fallback), `lessonIds`, `locale`.
  - fulltext branch builds an iframe srcDoc via
    `buildFullTextHtml(reading.head, reading.cards, lang, { title, questions, exercisesLabel })`.
  - `LessonFrame` renders any html string in a sandboxed iframe with a
    load/ResizeObserver height lifecycle — already used for the fallback full-html view.
- `app/src/lib/reading.ts` — `buildFullTextHtml` + its `exercisesHtml` helper +
  `escapeHtml` + the `FullTextExtras`/`FullTextQuestion` types. `getLessonReading`
  (card projection, unchanged) and `judgeReadCheck`/`recordReadCheck` (read-check,
  unchanged) also live here. `reading.head` is extracted from the stored html and is
  still needed by the per-card CardReader.
- `app/src/lib/lessons.ts` — `getLessonHtml(id)` returns the stored `sr_lessons.html`.
- `app/src/lib/reading-fulltext.test.ts` — unit tests for `buildFullTextHtml`
  (whole-lesson concat, title/section headings, display-only 课后题). It also has a
  `projectCards` regression guard, but `projectCards` is independently covered in
  `reading.test.ts`.

## Rough spec/plan
1. Loader: always fetch `html = getLessonHtml(id)` (needed by 速览 and still the
   fallback). Drop the `questions` fetch — it fed only `buildFullTextHtml`; the
   practice QuizDrawer keeps its own independent `getLessonQuestions` fetch.
2. fulltext branch: render `html` in `LessonFrame` (guard null → notReady text).
3. Remove `buildFullTextHtml`, `exercisesHtml`, `escapeHtml`, `FullTextExtras`,
   `FullTextQuestion` from `reading.ts`; remove the `buildFullTextHtml` import and the
   `questions` loader field from the route.
4. Delete `reading-fulltext.test.ts` (its subject is gone; `projectCards` stays
   covered by `reading.test.ts`).
5. Remove the orphaned `read.exercises` i18n key (zh + en) — only the removed
   exercises label used it.

## Assumptions
- A lesson that has a card tree (`reading != null`) always has a non-empty stored
  `html` (the head shell the card view reuses is extracted from that same html), so
  the null guard in the 速览 branch is defensive only.
- The stored html's 练习 section is prompt+options only, no answer KEY (STEMROBIN-40
  render), so 速览 课后题 are display-only automatically — no client controls, no
  server calls. Satisfies seed grill G-3.

## Risks
- Iframe height lifecycle must still size the (taller) full html — `LessonFrame`
  already handles this for the fallback full-html path, so reuse is safe.
- Mobile 375px horizontal overflow inside the iframe — the stored html is the same
  document the PDF/fallback view uses; verify empirically.

## UI / external-interface / dev-time-test investigation
- UI change: yes — the 全文速览 rendered output changes (PDF-quality). Requires
  real-browser (Playwright) verification: numbered sections, styled 课后题,
  display-only, formulas, mobile no-overflow, desktop+mobile screenshots.
- External interface: none new. No new dependency.
- Dev-time test: standalone Playwright from `app/node_modules/playwright`; mint a
  test-learner `sr_session` cookie (HMAC over user id, secret
  `process.env.SESSION_SECRET || 'stemrobin-dev-session-secret'`, user 2) — no
  password typed.

Grill required
