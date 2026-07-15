# IntentMill Plan

## Source Contract

Implements `im-spec.md` (STEMROBIN-28 full-text reading mode). That spec is the
requirement contract; this plan is the implementation and test route only and
adds no requirements beyond it.

## Implementation Approach

Add a reading-mode switch to the lesson page that toggles between the unchanged
`CardReader` (逐卡精读) and a new full-text branch (全文速览) rendered through the
existing `LessonFrame` iframe, fed by a new pure `buildFullTextHtml` helper that
concatenates the already-assembled card bodies inside the lesson's own head
shell. Full-text never mounts `CardReader`, so it structurally records no
read-check and cannot touch the practice-unlock gate. All styling comes from
existing `--sr-*` tokens; all data comes from the existing `getLessonReading`
payload.

## Implementation Drift Controls

- Do NOT edit `CardReader` (`app/src/components/card-reader.tsx`), `recordReadCheck`,
  `getLessonReading`, `projectCards`, or `judgeReadCheck`. The full-text branch
  must reach zero read-check code paths (verify: no `recordReadCheck` /
  `CardReader` reference on the fulltext branch).
- Reuse the existing in-file `LessonFrame` for full-text; do not add a second
  iframe component or move `LessonFrame` out of the route file.
- `buildFullTextHtml` must be pure (no DB, no React) and reuse the exact same
  srcDoc shell shape as `cardSrcDoc` (`<!doctype html><html lang="…"><head>…</head>
  <body><article class="sr-lesson">…</article></body></html>`), so full-text
  renders identically to cards.
- The practice-unlock gate `allRead` stays set only by `CardReader.onAllRead`;
  the mode switch must not write it.
- Segmented control uses only `--sr-*` tokens; no new hue, no inline color
  literals outside tokens (per DESIGN.md).
- The switch renders only when `reading` is non-null; the fallback-`html` and
  not-ready branches stay untouched.

## Phases

Phase 1 — full-text builder (`app/src/lib/reading.ts`)
- Add exported pure function `buildFullTextHtml(head: string, cards: ReadingCard[], lang: string): string` that joins `cards.map(c => c.bodyHtml)` with `'\n'` and wraps them in the same doctype/head/`article.sr-lesson` shell used by `cardSrcDoc`.
- Verify: unit test (Phase 5) — order preserved, every body present, no read-check markup emitted, head embedded.

Phase 2 — i18n labels (`app/src/lib/i18n.ts`)
- Add keys for zh and en: `read.mode.cards` (逐卡精读 / "Close reading"), `read.mode.fulltext` (全文速览 / "Full text"), `read.mode.aria` (阅读方式 / "Reading mode"). Keep parity in both dictionaries.
- Verify: `npm run build` typecheck (key type is a union) + browser labels visible.

Phase 3 — lesson page switch + branch (`app/src/routes/_app/lesson.$id.tsx`)
- Add `const [mode, setMode] = useState<'cards' | 'fulltext'>('cards')`.
- When `reading` is present, render a segmented control (`.sr-read-modes`) with two buttons (逐卡精读 active by default, 全文速览) above the reading content inside `.sr-d-scroll`, before the `reading ? CardReader : html ? LessonFrame : notReady` block.
- Change the reading render: when `reading` present → if `mode === 'cards'` render the existing `CardReader` (unchanged props); if `mode === 'fulltext'` render `<LessonFrame frameRef={fulltextRef} html={buildFullTextHtml(reading.head, reading.cards, locale === 'en' ? 'en' : 'zh-CN')} title={label} />`. Use a separate ref for the full-text frame. Conditional render (only the active mode mounted).
- Do not change the `html ?` fallback branch or the not-ready branch or the top action bar.
- Verify: browser — toggle shows/hides read-checks; cards branch intact.

Phase 4 — styles (`app/src/styles/app.css`)
- Add `.sr-read-modes` (inline-flex segmented control: `--sr-panel`/`--sr-line` container, 8px radius) and `.sr-read-mode` button states: idle ghost (`--sr-ink-soft`), selected (`--sr-blue`/white or `blue_tint`+`blue_deep` per DESIGN selected pattern). Place near the `.sr-card-*` block; add an 860px rule if needed for stacking/full-width. Reuse tokens only.
- Verify: 375px + desktop screenshots; no overflow; palette unchanged.

Phase 5 — unit test (`im tests path`)
- Add `fulltext-html.test.ts`: given a `{head, cards}` fixture (reuse the shape from `reading.test.ts`), assert `buildFullTextHtml`:
  - concatenates all card `bodyHtml` in array order,
  - includes the head string and the `<article class="sr-lesson">` wrapper and `lang`,
  - contains no read-check prompt/option/`sr-card-check` markup (it only reads `bodyHtml`).
- Run `npx vitest run` for the new test + the existing `reading.test.ts` (guard the untouched projection). Then full `npm run test` + `npm run build`.

## Unit Test Plan

- UT1 (R3, R4): `buildFullTextHtml` preserves card-array order and includes every card's `bodyHtml`. (ticket-scoped test)
- UT2 (R3): output embeds `reading.head` and wraps bodies in `<article class="sr-lesson">` with the given `lang` — same shell as cards, so KaTeX/styles render. (ticket-scoped test)
- UT3 (R4, secrecy): output contains only body content — no read-check markup and no KEY fields (it only consumes `bodyHtml`, never `readChecks`/`key`). (ticket-scoped test asserts absence)
- UT4 (regression, R2/R6): existing `reading.test.ts` (`projectCards`, `judgeReadCheck`) still passes unchanged — confirms the reading projection and server judging were not disturbed. (existing test re-run)
- UT5 (R2/R4/R5/R6/R7/R8 — behavioral, not unit-testable in vitest): Playwright headed browser verification per `references/capability-6-dev-unit-test/playwright-browser-verification.md`:
  - open `math-s3-07` (5 cards, translated); default shows 逐卡精读 with `.sr-card-check` present and read-check prompts typeset as `.katex`;
  - toggle 全文速览 → whole content shown, `.sr-card-check` count is 0, no card nav, formulas render as `.katex`, and no `recordReadCheck` network call fires from viewing;
  - toggle back 逐卡精读 → `.sr-card-check` present again and prompts render as `.katex` (STEMROBIN-27 intact);
  - 375px viewport: `document.documentElement.scrollWidth <= innerWidth` (no horizontal overflow) in both modes;
  - logged-out run (no session cookie) — reading works, nothing recorded.
  - Screenshots for cards, fulltext, and 375px.
- Full suite: `cd app && npm run test` and `cd app && npm run build` clean.

## Handoff Expectations

`im-handoff.md` must record: actual files changed (`reading.ts`, `lesson.$id.tsx`,
`i18n.ts`, `app.css`) and the new test; how full-text records no read-check /
does not advance progress (no `CardReader` mount → no `recordReadCheck`); spec &
plan alignment (R1–R9, critical contracts, non-scope/rejected options, test
obligations); browser evidence (fulltext no `.sr-card-check`, cards intact with
`.katex`, mobile 375px no overflow) with the headed Playwright command, dev URL,
viewports, and screenshot paths; confirmation `sr_users`/content/schema untouched;
any deviation from this plan with rationale; residual issues (e.g. toggle resets
ephemeral card state — accepted per CD3) and any missed user-review points or
`None.`.
