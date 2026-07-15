# IntentMill Plan

## Source Contract

`im-spec.md` is the only requirement contract. `im-draft.md` and `im-grill.md` are background provenance; all material decisions (D-LOGIN-GATE, D-PRACTICE-UNLOCK, D-CARD-HEAD-SOURCE, D-READING-COPY), contracts, and non-scope are already promoted into `im-spec.md` and this plan.

## Implementation Approach

Preserve the existing TanStack Start SSR architecture and add the smallest new surface. Four code areas:

1. **New server module `app/src/lib/reading.ts`** (styled after `lessons.ts`/`quiz.ts`; `createServerFn`, DB via `sql()` only). Two responsibilities, with the KEY-strip + judging logic factored into **pure, DB-free functions** so they are unit-testable:
   - A pure `projectCards(content, overlay)` that turns the neutral `content.cards[]` + `zh` overlay into the browser-facing shape `{ id, num, anchor, bodyHtml, readChecks: [{ id, mode, prompt, options|null }] }` — resolving prose/svg/caption/option node-ids to overlay text, assembling `bodyHtml` in `body` order, and **never copying `key`/`correct_index`/`accept`** into the output.
   - A pure `judgeReadCheck(readCheck, submission)` that returns `isCorrect` for `choice` (`chosen === key.correct_index`) and `input` (`key.accept.some(a => normalizeMathAnswer(a) === normalizeMathAnswer(text))`, reusing `app/src/lib/answer-normalize.ts`).
   - `getLessonReading({ data: id })` (GET): reads `content`, the `zh` overlay, and `html` from `sr_lessons`/`sr_lesson_i18n` in a server fn; returns `{ head, cards }` where `head` is the inner `<head>` HTML extracted from the lesson's derived `html` (D-CARD-HEAD-SOURCE) and `cards = projectCards(...)`. Returns `null` (or a `fallbackHtml`) when `content` is NULL so the route can fall back.
   - `recordReadCheck({ data: { lessonId, nodeId, chosen?, text? } })` (POST): loads `content`, finds the `read_check` by `nodeId`, calls `judgeReadCheck`, and — only when `currentUserId()` is non-null — INSERTs into `sr_content_answer_events` (`kind='read_check'`, `locale='zh'`, `chosen` or `answer_text`). Returns `{ isCorrect }` only. Never returns the key.
2. **New component `app/src/components/card-reader.tsx`**: owns the per-card 精读 state machine — `current` index, a `passed` set, per-read-check verdict map, retry. Renders the card body by swapping the `srcDoc` of a single sandboxed iframe that reuses the existing `LessonFrame` measure/ResizeObserver lifecycle (extract/reuse it; re-measure on card change). Renders the read-check panel in the app DOM reusing `.sr-quiz-*` classes + `renderMathInElement` for prompt/option KaTeX. Wrong → "回到本卡再读一遍" inline prompt + keep answerable. All read-checks in the card correct → mark passed, reveal "下一张卡片". All cards passed → completion state; call an `onAllRead` prop.
3. **Route `app/src/routes/_app/lesson.$id.tsx`**: loader fetches `getLessonReading` (keep `listLessonIds`); render `<CardReader>` in place of the single `LessonFrame` when a reading payload exists, else fall back to the existing full-`html` `LessonFrame`. Keep top bar, PDF download, `LessonNavFooter`. Gate the practice button: disabled until `CardReader` reports all-read (state lifted into the route), then it opens the existing `QuizDrawer` unchanged. Relabel/clarify the practice entry per D-READING-COPY.
4. **CSS `app/src/styles/app.css`**: add `.sr-card-*` reader-chrome classes (header + "第 n / N 张" counter, read-check panel, re-read prompt, completion card, prev/next-card controls) using only `--sr-*` tokens and mirroring `.sr-quiz-*`. Confirm existing `@media (max-width:1199px)` / `(max-width:860px)` breakpoints cover the reader; the iframe already sets `width:100%`.

## Implementation Drift Controls

- **Answer-key secrecy is mandatory, not best-effort.** `projectCards` and the `getLessonReading` response must be structurally incapable of carrying the key (build the output object with only the whitelisted fields; do not spread the raw read_check). Unit-tested + browser-network-verified in cap6. This contract cannot be bypassed for convenience.
- **DB access only through `sql()`**; the browser never receives the connection string, the key, or the full `content` with keys. No second client.
- **Recording requires login (R7):** the INSERT path is reached only when `currentUserId()` is non-null; logged-out still gets a judged verdict. Do not block reading on login; do not record when logged out.
- **iframe lifecycle must be preserved** (height measurement + ResizeObserver + delayed re-measure), re-run on `srcDoc` swap — do not replace it with a naive fixed-height iframe (formulas/SVG would clip).
- **Do not modify** migrated content/overlays, the generator, the migration skill, `sr_questions`/`sr_answer_events`/`quiz.ts`/`QuizDrawer` internals, `sr_users`, or the DB schema. The practice deck entry is only *gated*, not changed.
- **No new dependency** (charter iron law). Reuse KaTeX (already loaded), Postgres `sql()`, `normalizeMathAnswer`, `getLessonLabel`, the `.sr-quiz-*`/`--sr-*` design system, and the existing `LessonFrame` pattern.
- **Rejected option must not reappear:** do not hard-block logged-out learners at card 1 (D-LOGIN-GATE chose judge-always); do not auto-jump cards (chose learner-paced); do not persist progress (D6).
- Any implementation-time surprise (e.g. a lesson head that fails to render a card body, or an overlay hole — none expected, coverage verified) must fail fast / be recorded in `im-handoff.md`, not silently patched with a fallback that hides missing content.

## Phases

1. **Server module + pure logic.** Create `app/src/lib/reading.ts` with `projectCards`, `judgeReadCheck` (pure) and `getLessonReading`, `recordReadCheck` (server fns). Regression note: this is a new module with no existing consumers; it reuses `sql()`, `currentUserId()`, `normalizeMathAnswer` without altering them. Verify: unit tests (Phase 5) + a quick server-fn smoke against the real DB.
2. **CardReader component.** Create `app/src/components/card-reader.tsx` with the state machine + iframe body + read-check panel (reusing `.sr-quiz-*`). Factor the reusable iframe height logic out of `lesson.$id.tsx` (or import it). Verify: renders in the browser (Phase 6).
3. **Route wiring + practice gate.** Update `app/src/routes/_app/lesson.$id.tsx` loader + render + practice-button gating + copy. Regression check: PDF download, prev/next footer, catalog link-in, and the practice `QuizDrawer` still open and work once unlocked; story route untouched. Fallback path for NULL `content` renders the old full `html`.
4. **CSS.** Add `.sr-card-*` classes to `app/src/styles/app.css`; verify desktop + mobile no-overflow (Phase 6).
5. **Unit tests** under `.intentmill/tickets/STEMROBIN-22-card-reading-flow/tests/` + colocated vitest (`app/src/lib/reading.test.ts` via `app/vitest.config.ts`). Run `cd app && npm run test`.
6. **Browser verification** (cap6 playwright-browser-verification, required — UI story).

## Unit Test Plan

Ticket-scoped tests live at `app/src/lib/reading.test.ts` (colocated, runnable by the existing `app/vitest.config.ts`, like `answer-normalize.test.ts`/`curriculum.test.ts`), with a pointer note under `im tests path`. High-risk assertions:

- **KEY secrecy (highest risk):** `projectCards` output for a choice read-check contains `id/mode/prompt/options` and **no** `key`/`correct_index`; for an input read-check **no** `accept`. Assert the serialized JSON string of the projected cards contains none of `"key"`, `"correct_index"`, `"accept"`.
- **Body assembly:** prose nodes resolve to overlay `t` in `body` order; an svg node emits its inline `svg` and its `caption_id` caption text; order preserved.
- **Judging:** `judgeReadCheck` returns true only for the correct choice index; input judging is true for an accepted form (incl. `normalizeMathAnswer` equivalence like `3a` vs `$3a$`) and false otherwise.
- **Overlay resolution:** a missing overlay node fails fast / is surfaced (not silently emptied) — guards the (verified-absent) hole.
- Use small in-memory `content`/`overlay` fixtures mirroring the real shape (from `stemrobin.sql:222–240`); do not hit the DB in unit tests.

DB-backed behavior (event recording, login gate, real KEY projection over the wire) and no-overflow/formula rendering are covered by cap6 browser verification, since they need the shared DB + a session cookie and cannot be asserted from pure units.

## Handoff Expectations

After development, write `im refs path/im-handoff.md` summarizing actual changes at file granularity (`app/src/lib/reading.ts`, `app/src/components/card-reader.tsx`, `app/src/routes/_app/lesson.$id.tsx`, `app/src/styles/app.css`, tests), whether anything diverged from `im-spec.md`/`im-plan.md` and why, and residual issues / future work. It MUST include the cap6 browser-verification evidence required by the ticket: one-card-at-a-time advance, wrong-answer re-read + retry, reaching the practice deck, mobile no-overflow with formulas, and a captured browser-facing read-check payload showing NO answer key — with screenshots. Record confirmation that the existing quiz/PDF/catalog still work and that `sr_users` + migrated data are untouched, and note any test `sr_content_answer_events` rows created + cleaned up. Do not reopen cap4.
