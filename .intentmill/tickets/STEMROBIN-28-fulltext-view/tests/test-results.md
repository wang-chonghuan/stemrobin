# Test Results — STEMROBIN-28 全文速览

## Commands

- App vitest (unit): `cd app && npm run test` → **52 passed / 0 failed** (6 files),
  including the new `src/lib/reading-fulltext.test.ts` (**5 tests**) and the
  unchanged `src/lib/reading.test.ts` (9 tests, regression guard).
- App build: `cd app && npm run build` → clean (Vite + Nitro, `.output` generated,
  typecheck of the changed route/i18n/lib passed).
- Ticket-scoped standalone unit: `node .intentmill/tickets/STEMROBIN-28-fulltext-view/tests/fulltext-html.test.mjs`
  (node --test) → **4 pass / 0 fail** — mirrors the `buildFullTextHtml` contract
  self-contained (per the repo's ticket-test convention).
- Browser verification (headed=false, standalone Playwright from `app/node_modules`):
  `node .intentmill/tickets/STEMROBIN-28-fulltext-view/tests/verify-fulltext-view.mjs`
  against dev server `http://localhost:3000` (`cd app && npm run dev`), lesson
  `math-s3-07` (5 cards, zh), logged-out → **20/20 checks passed**.

## Coverage Map

| Plan test item | Requirement | Where covered | Result |
| --- | --- | --- | --- |
| UT1 card-order + all bodies | R3, R4 | `reading-fulltext.test.ts` (concatenation order), `fulltext-html.test.mjs` | pass |
| UT2 head reuse + sr-lesson shell + lang | R3 | `reading-fulltext.test.ts`, `fulltext-html.test.mjs` | pass |
| UT3 no read-check / no KEY in output | R4, secrecy | `reading-fulltext.test.ts` (asserts absence of prompt/`sr-card-check`/`correct_index`/`key`) | pass |
| UT4 projection untouched | R2, R6 (regression) | existing `reading.test.ts` re-run + guard test in `reading-fulltext.test.ts` | pass |
| UT5 behavioral browser | R1,R2,R4,R5,R6,R7,R8,R9 | `verify-fulltext-view.mjs` (20 checks) + screenshots | pass |

Browser checks (UT5) mapped to spec requirements:
- R1 switch present only with card tree; 2 options — pass.
- R2 逐卡精读 default active; CardReader + read-checks shown — pass.
- R3 全文速览 shows whole lesson (30 top-level blocks, 6626 chars, 1 figure) in one iframe — pass.
- R4 全文速览 has 0 `.sr-card-check`, 0 `.sr-card-nav`, no CardReader; **0 POST requests fired while viewing** (records nothing → no 进度) — pass.
- R5 practice stays locked in full-text (lock icon in screenshots; gate never set) — pass (no unlock path exercised).
- R6 toggle back → read-checks return (2), formulas still render (`.katex`) — pass (STEMROBIN-27 intact; no raw `$…$` residue).
- R7 formulas (`.katex`) + figures render in full-text; 375px no horizontal overflow both modes — pass.
- R8 all checks run logged-out (no session cookie) — pass.
- R9 segmented control styled from tokens (teal-blue active), 375px stacks, no overflow — pass (screenshots).

Screenshots: `screenshots/cards-desktop.png`, `screenshots/fulltext-desktop.png`,
`screenshots/fulltext-mobile-375.png`.

## Development Test Log

1. Added `buildFullTextHtml` to `reading.ts`; wrote `reading-fulltext.test.ts`;
   `npm run test` → 52 pass (caught nothing broken; guarded the builder + projection).
2. Wired the toggle + full-text branch into `lesson.$id.tsx`, i18n keys, CSS.
3. `npm run build` → clean typecheck (validated the new i18n union keys + route edits).
4. Started dev server; ran `verify-fulltext-view.mjs`. First run failed on ESM
   resolution of `playwright` (tests dir has no node_modules) — fixed by anchoring
   `createRequire` at `app/` (repo-relative). Re-run → 20/20 pass.
5. Ran the standalone `fulltext-html.test.mjs` → 4 pass.

## Notes

- No DB write, no schema change, no `sr_users`/content mutation during verification
  (read-only lesson fetch; 0 POSTs while viewing full-text).
- `LessonFrame` reused unchanged; `CardReader` / `recordReadCheck` untouched.
