# Unit Test Results

## Commands Run

- `cd app && npm run test` — vitest run (8 files, 76 tests).
- `cd app && npm run build` — production build (Vite + Nitro).
- `cd app && npm run dev -- --host 127.0.0.1` — dev server on port 3000 (actual port 3000).
- `node .intentmill/tickets/STEMROBIN-35-show-titles/tests/browser-render-check.mjs http://127.0.0.1:3000`
  — standalone Playwright (headed Chromium, already installed: chromium-1223).

## Results

- Unit: PASS — `Test Files 8 passed (8)`, `Tests 76 passed (76)`.
- Build: PASS — `✓ built in ~95ms`, `Generated .output/nitro.json`, no type/build errors.
- Browser: PASS — all 10 assertions PASS, `=== RESULT: PASS ===`.

Browser assertion output:
```
PASS: card lesson title: "3.7 去分母解方程"
PASS: card section title: "为什么学这个"
PASS: 速览 lesson title h1: "3.7 去分母解方程"
PASS: 速览 section headings: ["为什么学这个","讲解","例题","与其他知识点的联系","概念口试"]
PASS: 速览 课后题 block: label "课后题", 20 items
PASS: 速览 课后题 have no answerable controls (0 button/input)
PASS: no POST (record/attempt/progress) fired during 速览
PASS: KaTeX rendered in 速览 (.katex x250)
PASS: mobile page no horizontal overflow (Δ=0px)
PASS: mobile 速览 iframe body no horizontal overflow (Δ=0px)
```

Playwright evidence:
- Dev server command / port: `npm run dev -- --host 127.0.0.1`, port 3000.
- `npx playwright install chromium`: not needed (chromium-1223 already cached).
- Script command: `node .intentmill/tickets/STEMROBIN-35-show-titles/tests/browser-render-check.mjs http://127.0.0.1:3000`.
- Viewport coverage: desktop 1280×900 + mobile 375×812.
- Screenshots:
  - `.intentmill/tickets/STEMROBIN-35-show-titles/tests/screenshots/card-view-desktop.png`
  - `.intentmill/tickets/STEMROBIN-35-show-titles/tests/screenshots/fulltext-view-desktop.png`
  - `.intentmill/tickets/STEMROBIN-35-show-titles/tests/screenshots/fulltext-view-mobile-375.png`
- Auth: minted an `sr_session` cookie for the dedicated test learner (user 2) from
  `SESSION_SECRET` (dev fallback `stemrobin-dev-session-secret`) — no password typed.

## Development Test Log

1. Reading payload (`reading.ts`): added `name` to `NeutralCard`/`ReadingCard` +
   `projectCards`. Extended `app/src/lib/reading.test.ts` (name surfaced, KEY-free).
   Ran `npm run test` → green.
2. `buildFullTextHtml` extension (title + section headings + static 课后题):
   rewrote `app/src/lib/reading-fulltext.test.ts` with title/section-order/课后题/
   no-interactive-markup/KEY-free assertions. Ran `npm run test` → green.
3. Card 精读 section title (`card-reader.tsx`) + `.sr-card-section` CSS + `read.exercises`
   i18n: covered by the desktop browser assertions (card section title visible).
4. Loader wiring + 速览 call site (`lesson.$id.tsx`): covered by the browser 速览
   assertions (title/headings/课后题 visible, no POST, KaTeX). Ran `npm run build` → clean.
5. Full browser verification (desktop + mobile 375) → all PASS.

## Coverage Map

`im-plan.md ## Unit Test Plan` items:

- R1 payload (`projectCards` sets `name`; no KEY): covered by
  `app/src/lib/reading.test.ts` ("surfaces each card section name…", answer-key
  secrecy tests) + `reading-fulltext.test.ts` regression guard.
- R3/R4 layout (title, per-section `name` heading in order, prompt + choice options):
  covered by `app/src/lib/reading-fulltext.test.ts` ("title + section headings",
  "display-only 课后题") and browser 速览 assertions.
- R5 display-only (structural, no interactive markup): covered by
  `reading-fulltext.test.ts` ("emits NO interactive markup") + browser assertions
  (0 button/input in 课后题; no POST fired during 速览).
- Regression (`projectCards` order/KEY-free; existing `buildFullTextHtml` behavior):
  covered by retained/extended assertions in both test files (all still green).
- Runtime-only (KaTeX in iframe, per-card section title, 375px no overflow, no
  record event): covered by the Playwright browser script (all PASS).

## Failures

None. The only iteration was a Playwright module-resolution fix: the ticket script
lives outside `app/`, so `import 'playwright'` failed with `ERR_MODULE_NOT_FOUND`.
Fixed by resolving Playwright via `createRequire` pointed at `app/package.json`
(standalone Playwright from `app/node_modules`), then reran the same command → PASS.

## Notes

- `sr_users` and all learner data untouched: the run only read data + minted a
  cookie in the browser; viewing 速览 fired no POST, and no read-check/answer was
  submitted, so no `sr_*_answer_events` / attempt / progress row was written.
- Ticket unit tests live in `app/src/lib/*.test.ts` (this repo's vitest only scans
  `app/src`, matching the STEMROBIN-28 pattern); the ticket `tests/` dir holds the
  Playwright script + screenshots + this file.
