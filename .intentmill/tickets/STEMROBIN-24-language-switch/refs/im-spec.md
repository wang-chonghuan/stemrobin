# IntentMill Spec

## Intent

Let a learner switch the app's learning language between Chinese (`zh`, source) and English (`en`). When `en` is selected, the whole math experience renders in English — catalog, per-card reading prose, read-checks, and the practice deck — by reading the `en` overlay (`sr_lesson_i18n` locale='en') instead of the `zh` overlay. A lesson is readable in a locale only if fully translated to it; the `zh` experience is unchanged.

## Scope

- A learner-facing, persistent language switch (`zh` / `en`) in the app shell.
- Locale-honoring across the full learner flow: catalog, per-card reading prose + figures/captions, read-checks, and the practice deck.
- Per-locale availability: `en` shows only lessons fully translated to `en`; `zh` (source) always available.
- Answer-key secrecy preserved in every locale: initial browser payload carries no KEY; read-check and practice judged server-side.
- English strings for the app's own UI chrome and curriculum-outline labels (subject/stage/lesson titles), authored as in-app i18n.

## Non-Scope

- Re-translating or authoring DB content, overlays, exercises, or ledgers (STEMROBIN-20/21/23 owned). READ-only on all content.
- Any schema/migration change or change to the content-generation/translation skills.
- Translating 名人传记 (stories) or physics — both stay `zh`-only; the stories section is hidden under `en`.
- Translating practice-deck reference explanations (no `en` source exists; not shown under `en`).
- Progress-card real data, `<html lang>` per-locale, and locales beyond `en`.
- Any change to `sr_users`.

## Requirements

1. **Language switch control.** The app shell shows a persistent, always-visible `中 / EN` control in the catalog header. Selecting a language sets it as the active locale and immediately re-renders the app in that language. Default locale is `zh`.
2. **Locale persistence.** The active locale persists across route navigation and full page reloads via a cookie `sr_locale` (`zh` | `en`). The server reads the locale from this cookie; overlay selection (and therefore any KEY exposure) never depends on a client-supplied locale value.
3. **Catalog in locale.** Under `zh`, the catalog shows the full curriculum outline with placeholders, unchanged. Under `en`, the catalog shows only `en`-available lessons, with subject/stage/lesson titles in English; untranslated outline placeholders and any resulting empty stage/subject are omitted; the 名人传记 section is omitted.
4. **Reading in locale.** Opening a lesson under a locale renders each card's prose, figure captions, and read-checks (prompt + options) from that locale's overlay. Formulas and SVG are the shared neutral base and are identical across locales.
5. **Read-check in locale.** Under `en`, read-check prompts/options render in English; answers are judged server-side against the hidden neutral KEY and recorded (when logged in) with the answered locale. The initial reading payload contains no KEY.
6. **Practice deck in locale.** Under `en`, the practice deck's prompts and options render in English (from `exercises` JSONB + `en` overlay); items are judged server-side; the initial questions payload contains no correct option / accepted forms / reference answer. Post-answer feedback in `en` is the verdict + correct-option highlight (no Chinese reference explanation is shown).
7. **Per-locale availability rule.** A lesson is available in locale `L` iff the `L` overlay covers every translatable node id referenced by the lesson's `content` and `exercises`. `zh` (source) is always available for a lesson that has content. Untranslated lessons are not readable/visible in `en`. Switching back to `zh` restores full `zh` availability and content.
8. **`zh` unchanged.** Under `zh`, catalog, reading prose/read-checks, practice deck (`sr_questions`), reveal explanations, and all judging are byte-for-byte the pre-ticket behavior.
9. **No new runtime dependency**; feature built on the existing TanStack Start + Postgres stack.

## Critical Existing Contracts

- **Answer-key secrecy (charter G5).** `getLessonReading`/`projectReadCheck` never read `rc.key`; `getLessonQuestions` selects no `correct_index`/`accept`/`answer`. The new `en` practice projection must likewise emit only prompt + options (option text, no index) — no KEY in any GET payload. Correctness is returned only by `recordReadCheck` / `recordAnswer` after the learner answers.
- **Server-side DB access only.** All DB reads/writes go through `app/src/lib/db.ts` `sql()` inside server functions; the connection string never reaches the browser. Locale must be resolved server-side (cookie via `@tanstack/react-start/server` `getCookie`, mirroring `session.server.ts`).
- **Read-check judging + events.** `recordReadCheck` judges via `judgeReadCheck` against the neutral KEY, records into `sr_content_answer_events` only when logged in (`currentUserId()` non-null), soft gate (no penalty). Behavior preserved; only the recorded `locale` becomes the active locale.
- **Practice judging + attempts.** `recordAnswer` judges via `sr_questions.correct_index`/`accept`, requires login, records `sr_answer_events` under a `sr_quiz_attempts` pass; `getLatestScore`/`getOpenAttempt`/`startAttempt`/`endAttempt` machinery is keyed by lesson + numeric question id. The `en` deck reuses this unchanged (numeric `sr_questions.id`).
- **exercises ↔ sr_questions alignment.** For every lesson, `sr_lessons.exercises.items` and `sr_questions` are 1:1 by `ord`, with identical option order and `correct_index` (verified: `math-s2-01` ord 1 byte-identical, `correct_index=0`). The `en` deck relies on this to source text from the overlay while judging via `sr_questions`.
- **Card iframe lifecycle.** Per-card rendering reuses the lesson `<head>` (KaTeX + tokens + styles) in a sandboxed iframe with measured height; unchanged across locales.
- **Shared quiz drawer.** `QuizDrawer` serves both lessons and story chapters via injected fetch/record fns. Locale-awareness must not change story behavior (story route stays `zh`).
- **DESIGN.md is binding** for the switch control: `--sr-*` tokens only, selected state `--sr-blue-tint` bg + `--sr-blue-deep` text, matching catalog-item/count-pill conventions. No new colors/components.

## Confirmed Decisions

- **D1:** Locale = `sr_locale` cookie read server-side (`currentLocale()`), with `getLocale`/`setLocale` server fns; switch calls `setLocale` then `router.invalidate()`.
- **D2:** `en` catalog omits untranslated lessons (node-complete availability); empty stages/subjects dropped; `zh` outline unchanged.
- **D3:** English curriculum labels + UI strings authored as in-app i18n (`app/src/lib/i18n.ts`); DB overlays/content untouched.
- **D4:** `en` practice reveal = verdict + correct-option highlight; the `zh` reference explanation is suppressed under `en`.
- **D5:** 名人传记 hidden under `en`; unchanged under `zh`.
- **D6:** Persistent segmented `中/EN` control in the catalog header, `--sr-*` tokens only.
- **D7:** "Untranslated lesson hidden in `en`" is verified by a unit test on the availability function plus the browser-observable en catalog omitting untranslated outline placeholders; all 16 real lessons are fully `en`-translated, so no real zh-only-readable lesson exists (recorded in handoff/report).
- **Recommended defaults (mandatory where they constrain cap6):** `en` deck reuses numeric `sr_questions.id` keyed by `ord`; `reading.ts` swaps `SOURCE_LOCALE` for `currentLocale()`; `getLessonReading` returns `null` when the requested locale does not fully cover the lesson; server fns read the cookie internally (no locale param threaded to KEY paths); `QuizDrawer` gains a `locale` prop defaulting to `zh`.

## Compatibility And Regression Constraints

- The `zh` learner flow (catalog, reading, read-check, practice, judging, scoring, PDF, nav) must be unchanged.
- `QuizDrawer` and `recordAnswer` are shared/adjacent to the story flow; story chapters must keep working exactly as before (locale prop defaults to `zh`; recordAnswer changes are lessons-only and preserve the `zh` reveal).
- No modification to `sr_lesson_i18n`, `sr_lessons.content/exercises`, `sr_questions`, `sr_content_ledger`, schema, or `sr_users`.
- Formulas/SVG identical across locales.
- No new runtime dependency; no third-party translation API.

## Open Questions

None.
