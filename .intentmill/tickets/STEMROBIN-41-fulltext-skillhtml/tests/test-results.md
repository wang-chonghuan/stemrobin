# Unit Test Results — STEMROBIN-41

## Commands Run
- `cd app && npm run test` — vitest run (full suite)
- `cd app && npm run build` — production build (Vite + Nitro)
- `cd app && npm run dev` — dev server (started on http://localhost:3001)
- `node .intentmill/tickets/STEMROBIN-41-fulltext-skillhtml/tests/fulltext-skillhtml.spec.mjs`
  — standalone Playwright browser verification (chromium from app/node_modules)

## Results
- Unit suite: 7 files, 64 tests, all passed. `reading.test.ts` (10) green after
  `buildFullTextHtml` removal and `reading-fulltext.test.ts` deletion.
- Build: clean, `✓ built in 116ms`, `.output` generated, no TypeScript/import errors.
- Browser (desktop 1280 + mobile 375), 全文速览 on `math-s3-07`:
  - `.sr-sec-num` = 6, `.sr-sec-label` = 6; first label text = "1为什么学这个"
    (numbered sections, matches PDF).
  - `sr-fulltext-*` markup present = false (old bare list gone).
  - `.katex` = 263 (formulas render).
  - buttons = 0, inputs = 0, forms = 0 (课后题 display-only, not answerable).
  - answer-key leak (`correct_index`/`accept`/`data-answer`) = false.
  - practice section present: numbered "6 练习" heading, per-item 辨认/操作 tags.
  - iframe body overflow = 0 and page overflow = 0 at both 1280 and 375 widths.

## Development Test Log
- Slice 1 (remove dead renderer in `reading.ts`): grepped all usages of
  `buildFullTextHtml`/`exercisesHtml`/`FullTextExtras`/`FullTextQuestion`/`escapeHtml`
  before deletion; confirmed only the route + the fulltext test used them.
- Slice 2 (rewire route loader + fulltext branch): re-grepped for dangling refs
  (`buildFullTextHtml`, `questions`, `reading.head` in route) → none.
- Slice 3 (delete dead test + orphaned i18n key): ran `npm run test` → 64 passed;
  ran `npm run build` → clean. Confirms no unused/unresolved imports.
- Slice 4 (browser): ran the Playwright script at desktop then mobile; asserted the
  facts above and captured screenshots.

## Coverage Map
- UT-1 `reading.test.ts` projectCards regression → covered (existing test, 10 passed).
- UT-2 full unit suite → covered (`npm run test`, 64 passed).
- UT-3 production build clean → covered (`npm run build`, clean).
- BV-1 全文速览 PDF-quality / display-only / formulas / mobile no-overflow → covered
  (fulltext-skillhtml.spec.mjs, facts + screenshots).

## Failures
None.

## Notes
- Ticket-scoped Playwright script: `tests/fulltext-skillhtml.spec.mjs`.
- Screenshots: `tests/fulltext-desktop.png`, `tests/fulltext-mobile.png`,
  `tests/fulltext-practice.png` (the "6 练习" styled 课后题 section).
- Dev server port was 3001 (3000 in use); the script targets 3001.
- Test-learner `sr_session` cookie minted in-script (user 2, HMAC over id with
  `SESSION_SECRET || 'stemrobin-dev-session-secret'`); no password typed.
- `app/package-lock.json` touched by `npm install` (platform-optional-dep pruning)
  was reverted — no dependency change in this ticket.
