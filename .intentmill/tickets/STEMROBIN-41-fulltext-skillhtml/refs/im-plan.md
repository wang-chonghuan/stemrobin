# im-plan — STEMROBIN-41

## Implementation route

### Step 1 — Route loader (`app/src/routes/_app/lesson.$id.tsx`)
- Change the loader to always fetch `html = await getLessonHtml({ data: params.id })`
  (serves both the 速览 view and the no-card-tree fallback).
- Remove the `questions: reading ? await getLessonQuestions(...) : []` loader field.
- Remove `questions` from the `useLoaderData()` destructure.

### Step 2 — fulltext render branch (same file)
- Replace the `buildFullTextHtml(...)` iframe with the stored `html`:
  `html ? <LessonFrame frameRef={fulltextRef} html={html} title={label} />
        : <p …>{t(locale,'lesson.notReady')}</p>`.
- Remove the `buildFullTextHtml` import (keep `getLessonReading`).
- Keep `getLessonQuestions` import — the QuizDrawer prop still uses it.

### Step 3 — Remove dead renderer (`app/src/lib/reading.ts`)
- Delete `escapeHtml`, `FullTextQuestion`, `FullTextExtras`, `exercisesHtml`,
  `buildFullTextHtml`. Keep `getLessonReading`, `projectCards`, `judgeReadCheck`,
  `recordReadCheck`, and all reading types.

### Step 4 — Remove dead test + orphaned i18n key
- `git rm app/src/lib/reading-fulltext.test.ts` (subject removed; `projectCards`
  stays covered by `reading.test.ts`).
- Remove `'read.exercises'` from both locales in `app/src/lib/i18n.ts`.

## Unit Test Plan
- UT-1 (existing) `reading.test.ts` still green — `projectCards` and card projection
  regression intact after `buildFullTextHtml` removal.
- UT-2 Full unit suite (`npm run test`) green — no dangling references to removed
  symbols; i18n key removal breaks nothing.
- UT-3 Production build (`npm run build`) clean — TypeScript has no unused/unresolved
  imports after the removals.
- BV-1 (browser, ticket-scoped Playwright) 全文速览 on `math-s3-07`:
  numbered `.sr-sec-num`/`.sr-sec-label` sections + styled 练习/课后题, NOT the old
  `.sr-fulltext-*` list; 课后题 display-only (0 buttons/inputs/forms, no KEY leak);
  KaTeX present; desktop 1280 + mobile 375 no horizontal overflow; screenshots.

## Verification
- `cd app && npm run test` (vitest), `cd app && npm run build`.
- Standalone Playwright (`app/node_modules/playwright`) with a minted test-learner
  `sr_session` cookie (user 2, HMAC secret from env/default) against `npm run dev`.
