# IntentMill Spec

## Intent

When a learner opens a migrated math lesson, present the 課文 as a **card-by-card 精读 (close-reading) flow** — one numbered card at a time — instead of one full-lesson iframe. After reading a card the learner answers that card's lightweight read-check; a correct answer opens the next card, a wrong answer guides them back to re-read (soft gate, no penalty). After all cards are passed the lesson counts as "read" and the existing practice deck becomes available. Purpose: prevent skim/fake reading. `zh` only.

## Scope

- A per-card reading UI on `/lesson/$id` for the 16 migrated math lessons (`sr_lessons.content` non-null): render one card at a time from `content` + the `zh` `sr_lesson_i18n` overlay, with per-card read-check gating.
- New server functions to (a) fetch a lesson's cards + read-checks with the answer KEY projected out, plus the lesson's styling `<head>`, and (b) judge a read-check server-side and record the attempt.
- Gate the existing practice deck entry behind reading completion; on completion show a "读完 / 可进入练习" state that opens the existing practice `QuizDrawer`.
- New reader-chrome CSS using existing `--sr-*` tokens.
- Ticket-scoped unit tests for the projection + judging logic.

## Non-Scope

- Locale switching / English end-to-end (STEMROBIN-24). Read the `zh` overlay via a locale parameter defaulted to `'zh'` so STEMROBIN-24 can generalize, but build no switch UI.
- Persisting or consuming reading progress across visits, resume state, or a real "已读" indicator on the catalog (D6). Read-check events are recorded but not consumed this ticket.
- Any change to the practice deck itself (`sr_questions`, `sr_answer_events`, `app/src/lib/quiz.ts`, `QuizDrawer` internals) beyond gating its entry point.
- Any change to migrated content, `sr_lessons.content`/`exercises`, `sr_lesson_i18n` overlays, the generator, or the migration skill (READ only).
- Any DB schema change; any new dependency; any change to `sr_users`.
- Feeding the catalog progress-bar mockup in `_app/index.tsx`.

## Requirements

- **R1 One card at a time.** Opening a migrated math lesson shows exactly one card. Cards are ordered by `content.cards[]` array position; the learner-visible number shown is `card.num` as "第 n / N 张". The lesson title (from `getLessonLabel(id)`) is shown once in the reader header (it is not a card node).
- **R2 Card body fidelity.** A card's body is its `body[]` nodes rendered in array order: `kind:"prose"` nodes → the `zh` overlay `t` HTML for that node id; `kind:"svg"` nodes → the neutral inline `svg` string, followed by its `caption_id` prose caption (from the overlay) when present. Formulas (`$…$` / `$$…$$`) render via KaTeX. The card body renders inside a single sandboxed iframe whose `<head>` is the lesson's own head (KaTeX links + DESIGN tokens + element-class stylesheet), so `.sr-term`/`.sr-example`/etc. and formulas render exactly as in the full-lesson view.
- **R3 Per-card read-check, server-judged.** Each card's `read_check[]` items are presented below the card. Modes: `choice` (options are the resolved overlay strings) and `input` (typed). Correctness is judged **server-side** by a server function; the browser never receives the KEY (see R6). `input` judging normalizes with `normalizeMathAnswer` (same as the practice deck).
- **R4 Soft gate.** A card is "passed" when every read-check in it is answered correctly this visit. The learner may advance to the next card only after the current card is passed (forward gate). A wrong answer shows a "回到本卡再读一遍" prompt and keeps the item answerable for retry — never a penalty, permanent lock, or skip. Navigating backward to any already-passed card is always allowed; a passed card stays passed. A card with zero read-checks auto-passes on view.
- **R5 Completion → practice unlock.** When every card is passed, the reader shows a "读完 / 可进入练习" state and the existing practice deck becomes openable from this page. Until then the practice entry is present but locked/disabled. The gate is per-page-visit client state (progress is not persisted this ticket).
- **R6 Answer-key secrecy (G5).** The initial per-card payload delivered to the browser contains no `key`, `correct_index`, `accept`, or any equivalent. The server projects the KEY out of the JSONB before sending. The verdict (`isCorrect`) is returned only by the judging server function after the learner submits. read-checks carry no explanation field, so a wrong answer reveals no answer text.
- **R7 Login gate on recording.** Read-check judging works whether or not the learner is logged in (so the reading flow is usable). An attempt is inserted into `sr_content_answer_events` (`kind='read_check'`, `node_id=<read_check id>`, `is_correct`, `chosen`/`answer_text`, `locale='zh'`) **only when logged in**; logged-out attempts are judged but not recorded.
- **R8 No overflow, formulas render.** On both desktop and a narrow mobile viewport, the per-card content (prose, SVG, formulas, read-check panel) does not overflow horizontally and formulas render.
- **R9 Non-regression.** PDF download, the catalog, lesson prev/next navigation, and the existing practice quiz (once unlocked) keep working unchanged. A lesson row with NULL `content` falls back to the existing full `html` view.

## Critical Existing Contracts

- **Answer-key secrecy contract** (`app/src/lib/quiz.ts`, `charter/engineering-rules.md §Answer-key secrecy`): question fetchers never send `correct_index`/`accept`/`answer`; correctness is judged only in the `record*` server fns. The new reading server fns MUST follow the identical shape — KEY lives only server-side in the JSONB neutral base and is projected out before any response.
- **DB access is server-only** (`app/src/lib/db.ts` `sql()`): all reads/writes go through it; the browser never holds the connection string. No second client, no bypass.
- **Session/auth contract** (`app/src/lib/session.server.ts`): `currentUserId()` returns the id from the HMAC cookie or null; recording requires a non-null id (mirrors `recordAnswer` returning `{ error: '请先登录' }` when logged out — here the reading fn instead judges and skips the insert).
- **iframe render lifecycle** (`app/src/routes/_app/lesson.$id.tsx` `LessonFrame`): sandboxed `srcDoc` iframe with height measurement via `scrollHeight` + `ResizeObserver` + delayed re-measure (KaTeX reflows after async CDN load). The per-card reader must preserve this lifecycle and re-measure when the card (`srcDoc`) changes.
- **JSONB content contract** (`ssot-schemas/db-schemas/stemrobin.sql:196–295`): `content.cards[]` items have `id`, `num`, `anchor`, `body[]`, `read_check[]`; `read_check[]` items have `id`, `mode`, `key` (`{correct_index}` | `{accept}`), and (choice) `options[]` node-id refs. The `zh` overlay maps every prose body id, svg `caption_id`, read_check id, and choice option id to `{t, src_rev}` (verified: full coverage). `sr_content_answer_events` already has the exact columns for read-check events.
- **KaTeX rendering contract** (`app/src/routes/__root.tsx` global auto-render; each lesson `<head>` also loads KaTeX): read-check prompts/options rendered in the app DOM use the global `renderMathInElement` (as `quiz-drawer.tsx` does); card body formulas render inside the iframe via the lesson head.
- **DESIGN.md palette** (`resources/reference/DESIGN.md`, materialized as `--sr-*` in `app/src/styles/app.css`): three-color palette only; new UI reuses `--sr-*` tokens and existing `.sr-quiz-*` classes; no new hues/components.

## Confirmed Decisions

- **D-LOGIN-GATE:** judge read-checks server-side for everyone; record in `sr_content_answer_events` only when logged in (R7).
- **D-PRACTICE-UNLOCK:** practice is per-visit hard-gated behind finishing all cards; on completion show "读完 / 可进入练习" and enable the practice drawer; progress not persisted (R5; D6).
- **D-CARD-HEAD-SOURCE:** the per-card iframe reuses the lesson's own `<head>` (extracted server-side from the same `sr_lessons.html` derived-cache row); card bodies come from the JSONB SSOT; single iframe, `srcDoc` swapped per card (R2; D8).
- **D-READING-COPY:** reading flow uses 精读 vocabulary ("第 n / N 张", "回到本卡再读一遍", "下一张卡片"); the practice entry keeps 练习/答题 wording and is shown locked until reading completes (R1/R5).
- Advance is learner-paced: after a card passes, reveal a "下一张卡片" control (no auto-jump); "上一张卡片" available once past card 1.

## Compatibility And Regression Constraints

- The practice deck path (`getLessonQuestions`/`recordAnswer`/`QuizDrawer`) must remain byte-for-byte behaviorally unchanged except that its entry point on `/lesson/$id` is gated behind reading completion. Story chapters (`story.$id`) and their quiz path must not be touched.
- The `/lesson/$id` route's PDF download, top bar, and `LessonNavFooter` prev/next must keep working.
- No change to the loader contract that breaks other routes; only `/lesson/$id`'s own loader changes (fetch reading payload instead of / in addition to `html`).
- `sr_users` and all migrated content/overlays are read-only; the only writes this ticket makes are INSERTs into the disposable `sr_content_answer_events`.
- No new dependency; no schema change.

## Open Questions

None.
