# Unit Test Results

## Commands Run

- `cd app && npx vitest run src/lib/reading.test.ts` → 9 passed
- `cd app && npx vitest run` (full suite) → 25 passed (3 files: answer-normalize 7, curriculum 9, reading 9)
- `cd app && npx tsc --noEmit` → clean (no type errors)
- `cd app && npm run build` → built `.output` successfully (no SSR/bundler errors)
- Dev server: `cd app && npm run dev -- --host 127.0.0.1` → http://127.0.0.1:3000 (port 3000)
- Browser install: `cd app && npx playwright install chromium` (chromium already present)
- Browser verification: `node .intentmill/tickets/STEMROBIN-22-card-reading-flow/tests/browser-render-check.mjs http://127.0.0.1:3000` → 20/20 checks passed (headed Chromium)

## Results

- Unit: 25/25 passed.
- Typecheck: clean.
- Build: success.
- Browser (headed Chromium, logged-in test learner user_id 2 via minted HMAC cookie — no password handled): 20/20 assertions passed. Viewports: desktop 1280×900 and mobile 375×812.

## Development Test Log

1. Slice: pure logic (`projectCards` + `judgeReadCheck`) → wrote `app/src/lib/reading.test.ts`; ran `vitest run src/lib/reading.test.ts` → 9 passed. Verified KEY never appears in projected output (JSON.stringify assertions), body assembly order (prose→overlay, svg→figure.sr-fig+figcaption), choice/input judging, and overlay fail-fast.
2. Slice: server fns + route wiring + CardReader + CSS → ran `tsc --noEmit` (clean) and `npm run build` (success) to catch SSR/type/bundler issues before browser work.
3. Slice: full suite `vitest run` → 25 passed (no regression in answer-normalize / curriculum).
4. Slice: browser verification → ran the ticket Playwright script; iterated once on the KEY-secrecy assertion (first run's URL-based capture matched Vite dev-mode `/src/lib/reading.ts` SOURCE, which mentions `correct_index`/`accept` in type defs — a false positive, not a data leak). Refined the capture to inspect the real client-RPC data payload (content-type not javascript/html, must contain `bodyHtml`) via an SPA navigation; re-ran → 20/20.
5. DB check: confirmed `sr_content_answer_events` recorded the deliberate wrong (is_correct=f, chosen=1) then correct (is_correct=t, chosen=0) plus input answers (answer_text '3a','28'), all kind='read_check' locale='zh'; then deleted the 18 disposable test rows (0 remaining for user 2). `sr_users` count unchanged (2).

## Coverage Map

- KEY secrecy (projectCards emits no key/correct_index/accept) → `reading.test.ts` "answer-key secrecy" describe (3 tests) + browser checks "payload has NO correct_index / accept / key".
- Body assembly (prose→overlay text, svg→figure.sr-fig+figcaption, body order, num) → `reading.test.ts` "body assembly + order + numbering" (3 tests) + browser card render screenshots.
- Auto-pass card with no read_check → `reading.test.ts` empty-readChecks test + browser "advanced to card 5" + "读完" (oral card walked, not skipped).
- Overlay fail-fast on missing node → `reading.test.ts` throw test.
- Server-side judging (choice index; input normalize-equivalence) → `reading.test.ts` "judgeReadCheck" (2 tests) + browser wrong→right flow.
- DB-backed event recording + login gate (R7) → browser run + DB query (recorded when logged in; verified rows) — not a unit test (needs DB + cookie), covered by browser + SQL evidence as planned.
- Soft gate (wrong → re-read + retry, forward locked; correct → advance) → browser "wrong answer shows re-read guidance", "next still locked after wrong", "next-card control appears after card passes".
- Practice unlock after reading → browser "practice button locked before reading" / "unlocked after reading" / "practice deck opens".
- Mobile no-overflow + formulas → browser "mobile: no horizontal overflow" (scrollW 375 == winW 375), "card body not wider than frame", `card1-mobile.png`.
- Non-regression (catalog, PDF, practice deck) → browser practice-drawer open + HTTP 200 for `/` and `/lesson/...`; existing vitest suites still green.

## Failures

None outstanding. One intermediate false-positive on the KEY-secrecy assertion (Vite dev-source capture) was diagnosed and fixed by inspecting the real client-RPC data payload; see Development Test Log #4.

## Notes

- Browser verification evidence (screenshots) under `.intentmill/tickets/STEMROBIN-22-card-reading-flow/tests/screenshots/`: `card1-desktop.png`, `card1-wrong-reread.png`, `all-read-desktop.png`, `practice-open-desktop.png`, `card1-mobile.png`.
- Answer keys used to drive deterministic correct/wrong answers were read from the DB by the test script's own comments (the browser never receives them); this is test scaffolding, not product behavior.
- Test learner session cookie minted from the default `SESSION_SECRET` per project convention; no password was typed or stored.
