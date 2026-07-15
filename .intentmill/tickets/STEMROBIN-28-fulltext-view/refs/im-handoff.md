# IntentMill Handoff — STEMROBIN-28 全文速览

## Summary

Added a reading-mode switch to the lesson page. When a lesson has a card tree,
the learner can toggle between **逐卡精读** (the existing card-by-card CardReader
flow, default) and **全文速览** (the whole lesson content at once, in one
sandboxed iframe, with no read-check and no gate). Viewing full-text records
nothing and advances neither 课文进度 nor the practice-unlock gate.

## Actual Changes

- `app/src/lib/reading.ts` — added pure exported `buildFullTextHtml(head, cards, lang)`:
  joins every `ReadingCard.bodyHtml` in card order into the same
  `<!doctype…><head>${head}</head><body><article class="sr-lesson">…</article>`
  shell the per-card iframe (`cardSrcDoc`) uses. Reads only `bodyHtml` — no
  read-check, no KEY. No change to `projectCards` / `judgeReadCheck` /
  `getLessonReading` / `recordReadCheck`.
- `app/src/routes/_app/lesson.$id.tsx` — added `mode` state (`'cards' | 'fulltext'`,
  default `'cards'`) and a `fulltextRef`. Renders a `.sr-read-modes` segmented
  control (only when `reading` exists) above the reading content. `mode==='cards'`
  → existing `CardReader` (unchanged props); `mode==='fulltext'` → the existing
  in-file `LessonFrame` fed `buildFullTextHtml(reading.head, reading.cards, lang)`.
  Conditional render (only the active mode mounted). Top action bar, fallback-`html`
  branch, not-ready branch, and the `allRead` practice gate are untouched.
- `app/src/lib/i18n.ts` — added `read.mode.aria` / `read.mode.cards` / `read.mode.fulltext`
  for zh (阅读方式 / 逐卡精读 / 全文速览) and en (Reading mode / Close reading / Full text).
- `app/src/styles/app.css` — added `.sr-read-modes` + `.sr-read-mode` segmented-control
  styles from existing `--sr-*` tokens (teal-blue active, ghost idle, 8px radius,
  full-width capped at 380px so it stacks cleanly on mobile). No new hue.
- Tests: `app/src/lib/reading-fulltext.test.ts` (vitest, guards the real function);
  ticket-scoped `tests/fulltext-html.test.mjs` (node --test mirror),
  `tests/verify-fulltext-view.mjs` (Playwright), `tests/screenshots/*`, `tests/test-results.md`.

## How full-text records no progress

Full-text mode does not mount `CardReader`, and `CardReader.submit → recordReadCheck`
is the ONLY writer of `sr_content_answer_events` with `kind='read_check'`. With no
CardReader mounted, no read-check submission can occur, so no event is written —
verified empirically: **0 POST requests fired while viewing full-text**. The
lesson's read-check event stream (the sole future basis for "课文进度") is therefore
untouched by full-text. The practice-unlock gate `allRead` is set only by
`CardReader.onAllRead`; entering/leaving full-text never sets it.

## Browser Evidence

Standalone Playwright (`app/node_modules/playwright`, headed=false) against
`http://localhost:3000`, lesson `math-s3-07` (5 cards), logged-out → **20/20 pass**:
- 全文速览 shows the whole lesson (30 top-level blocks, 6626 chars, figure preserved)
  in one iframe with **0** `.sr-card-check` / `.sr-card-nav` / CardReader, formulas
  render as `.katex`, and **0 POSTs** while viewing.
- 逐卡精读 (default) shows the CardReader + read-checks; body renders `.katex`; no
  raw unrendered `$…$` in the read-check area (STEMROBIN-27 intact).
- Switching back to 逐卡精读 restores read-checks and formulas still render.
- 375px: no horizontal overflow in either mode.
- Screenshots: `tests/screenshots/{cards-desktop,fulltext-desktop,fulltext-mobile-375}.png`.

Unit: `npm run test` → 52 pass (incl. 5 new); `npm run build` → clean;
`fulltext-html.test.mjs` → 4 pass.

## Spec And Plan Alignment

- **Spec obligations (R1–R9):** all delivered and verified — see test-results.md
  Coverage Map. R1 (switch only with card tree), R2 (逐卡精读 default), R3 (whole
  content one iframe), R4 (records nothing), R5 (no practice unlock from full-text),
  R6 (toggle-back intact + KaTeX), R7 (formulas/figures + 375px no overflow), R8
  (logged-out works), R9 (token-only segmented control).
- **Plan obligations:** implemented Phases 1–5 as written; `buildFullTextHtml`
  pure and reusing `cardSrcDoc`'s shell; reused in-file `LessonFrame`; conditional
  render.
- **Critical existing contracts:** `getLessonReading` payload consumed as-is (no
  second data source); read-check recording path not reached from full-text;
  sandbox + height lifecycle preserved via `LessonFrame`; answer-key secrecy held
  (full-text touches only `bodyHtml`).
- **Non-scope / rejected options honored:** no CardReader/recordReadCheck/schema
  change; no fallback-`html` or quiz-drawer change; no PDF embed; no new dependency;
  no new hue; `app/`-only. Rejected "default=fulltext" and "keep both mounted with
  display:none" are absent.
- **Test obligations:** unit (real function + mirror) + browser + build all mapped
  and green.

## Deviations

None. Implementation follows `im-plan.md`. One accepted design point (already
decided in grill CD3): conditional render means toggling resets `CardReader`'s
ephemeral per-visit read state — this is local UI state, not persistent progress,
and no acceptance criterion requires preserving it.

## Missed User-Review Points

None. (Full delegation seed; all blocking decisions were self-adjudicated from the
charter in `im-grill.md` and are reflected in `im-spec.md`.)

## Residual Issues / Future Improvements

- Toggling 全文速览 ↔ 逐卡精读 remounts the active mode, resetting the ephemeral
  card-read gate for that visit (accepted, CD3). If a future ticket wants to
  preserve in-progress card state across the toggle, it must lift the read state
  out of `CardReader` or use a sizing-safe hidden-mount (a naive `display:none`
  iframe collapses because its body `scrollHeight` is 0 and the body-ResizeObserver
  never re-fires on show — reason the current design mounts only the active mode).
- `sr_users`, lesson content, and the DB schema were not touched.

## Charter Drift

None. No stack, dependency, deploy, or operational change — `app/`-only feature
work using existing patterns.

## Commit Status

Uncommitted (n-im executor stops at a verified worktree per instructions — no
commit, merge, cap8, push, or deploy). Changed files listed above under
`app/src/**` plus ticket artifacts under
`.intentmill/tickets/STEMROBIN-28-fulltext-view/`.
