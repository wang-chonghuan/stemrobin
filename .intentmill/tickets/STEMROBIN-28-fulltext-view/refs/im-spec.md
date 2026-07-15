# IntentMill Spec

## Intent

Let a learner on the lesson page switch between two reading modes: the existing
**逐卡精读** (card-by-card close reading with read-check soft gate) and a new
**全文速览** (full-text) that shows the whole lesson content at once — the same
content the cards carry, in card order — with no read-check and no gate. Viewing
full-text records nothing and does not advance the lesson's "课文进度".

## Scope

- Lesson page `app/src/routes/_app/lesson.$id.tsx`: a reading-mode switch and a
  full-text render branch, active only when the lesson has a card tree
  (`reading` non-null).
- A pure helper in `app/src/lib/reading.ts` that builds the full-text iframe
  document from `{ head, cards }`.
- Toggle labels in `app/src/lib/i18n.ts` (zh + en).
- Segmented-control styles in `app/src/styles/app.css` from existing `--sr-*`
  tokens.
- One ticket-scoped unit test for the full-text builder; browser verification.

## Non-Scope

- No change to 逐卡精读 behavior, the `CardReader` component, its props, or the
  STEMROBIN-27 read-check KaTeX rendering fix.
- No change to `recordReadCheck`, `sr_content_answer_events`, any DB schema, or
  any `sr_*` write path.
- No change to the fallback full-`html` lesson path, the practice/quiz drawer, or
  the practice-unlock gate logic (it stays `CardReader`-driven).
- No login/auth change (a separate seed ticket owns the reading login gate).
- No PDF-file embedding, no content regeneration, no new dependency, no new
  color hue. `app/`-only.

## Requirements

R1. When `reading` (card tree) is present, the lesson page shows a two-option
reading-mode switch: **逐卡精读** and **全文速览**. When `reading` is absent
(fallback full-`html` or not-ready lesson), no switch is shown and behavior is
unchanged.

R2. Default mode is **逐卡精读**. On first render of a lesson with a card tree,
the existing `CardReader` flow is shown, with unchanged props and behavior
(per-card read-check soft gate, STEMROBIN-27 KaTeX rendering, practice-unlock via
`onAllRead`).

R3. Selecting **全文速览** shows the whole lesson content at once: every
`reading.cards[i].bodyHtml` concatenated in card-array order, wrapped in the same
`<article class="sr-lesson">` shell inside a single sandboxed iframe whose
`<head>` is `reading.head` (KaTeX resources + lesson stylesheet/tokens). It shows
no read-check UI, no per-card navigation, no gate, and no "done" badge.

R4. Full-text mode records nothing: it does not mount `CardReader` and never
invokes `recordReadCheck`, so no `read_check` event is written to
`sr_content_answer_events` and the lesson's read-check event stream (the sole
future basis for "课文进度") is unaffected by viewing full-text.

R5. Viewing full-text does not unlock or complete practice. The practice-unlock
gate (`allRead`) remains driven only by `CardReader.onAllRead`; it is not set by
entering, viewing, or leaving full-text mode.

R6. Selecting **逐卡精读** (including switching back from full-text) shows the
normal `CardReader` flow with formulas rendering (read-check prompts/options
typeset as KaTeX per STEMROBIN-27) and the per-card + read-check gate working.

R7. In full-text mode, formulas and figures render (KaTeX auto-render inside the
reused-head iframe; `sr-fig`/lesson element classes apply). At a 375px viewport
the lesson page and the full-text iframe produce no horizontal overflow (iframe
`width:100%; max-width:100%`, matching the card frame).

R8. Reading (both modes) works logged out; full-text records nothing regardless
of auth state.

R9. The switch is a segmented control styled only from existing `--sr-*` tokens
(teal-blue selected state, ghost idle, 8px radius), stacking under the 860px
reader breakpoint. No new color hue.

## Critical Existing Contracts

- `getLessonReading` (`app/src/lib/reading.ts`) returns `{ head, cards }` with
  KEY-free `ReadingCard.bodyHtml` already assembled (prose overlay + `sr-fig`
  svg) and `head` = the lesson's own `<head>` inner HTML. Full-text MUST consume
  this existing payload; it must not fetch or assemble a second data source, and
  must not surface any read-check KEY (there is none in the payload — keep it
  that way).
- Read-check recording is isolated to `CardReader.submit → recordReadCheck`; that
  is the only writer of `sr_content_answer_events kind='read_check'`. Full-text
  must not reach this path.
- Lesson HTML renders inside a sandboxed iframe (`sandbox="allow-scripts
  allow-same-origin allow-modals"`) with the load + 300/1200ms + `ResizeObserver`
  height lifecycle (`LessonFrame` / `CardFrame`). Full-text must keep the sandbox
  and a correct height lifecycle (reuse `LessonFrame`).
- Answer-key secrecy (charter engineering-rules G5): the reading payload carries
  no `correct_index`/`accept`; full-text touches only `bodyHtml`, so no KEY can
  leak.

## Confirmed Decisions

- CD1 (grill default-mode): Default mode = 逐卡精读; full-text is opt-in.
- CD2 (grill toggle-placement-and-form): Segmented control above the reading
  content, shown only when `reading` exists, styled from `--sr-*` tokens
  (teal-blue selected / ghost idle, 8px radius, 860px stacking); not in the top
  action bar.
- CD3 (grill fulltext-progress-and-practice-isolation): Full-text records
  nothing and advances neither 课文进度 nor practice-unlock; modes are
  conditionally rendered (only the active mode mounted); resetting `CardReader`'s
  ephemeral per-visit state on toggle is accepted.
- CD4 (grill fulltext-render-surface): Full-text is a sandboxed iframe reusing
  the lesson head + `sr-lesson` article shell, built by a pure `buildFullTextHtml`
  helper and rendered via the existing `LessonFrame`. No PDF embed, no new
  dependency.

## Compatibility And Regression Constraints

- 逐卡精读 stays behaviorally identical; `CardReader` and its props are
  untouched. The STEMROBIN-27 read-check KaTeX fix must still work after
  toggling back to 逐卡精读.
- `LessonFrame` is reused unchanged; the fallback full-`html` branch (lessons
  without a card tree) is unchanged and still shows no toggle.
- `buildFullTextHtml` is additive to `reading.ts` (pure, DB-free) and must not
  alter `projectCards`, `judgeReadCheck`, `getLessonReading`, or `recordReadCheck`.
- No other consumer of `reading.ts` exports changes behavior; the new export is
  additive.
- Practice-unlock gate semantics unchanged for 逐卡精读.

## Open Questions

None.
