# IntentMill Plan

## Source Contract

`im-spec.md` is the only requirement contract. `im-draft.md` and `im-grill.md` are background provenance; their material constraints (D1–D7, recommended defaults, guardrails) are already promoted into `im-spec.md` and this plan.

## Implementation Approach

Add a locale dimension to the existing learner flow with the smallest surgical change, reusing the T4 reading module, the quiz drawer, the attempt/judge machinery, and the `--sr-*` design system. No schema, overlay, content, or dependency change.

- **Locale primitives.**
  - `app/src/lib/i18n.ts` (isomorphic, no server import): `Locale = 'zh' | 'en'`, `LOCALES`, `DEFAULT_LOCALE='zh'`; a `UI` string dictionary keyed by locale for every learner-visible hardcoded string enumerated in the spec's R-UI surface list; curriculum label maps — `SUBJECT_LABELS`, `STAGE_LABELS` (only stages containing en-available lessons need `en`), `LESSON_TITLES` (the 16 available lesson ids → English title); helper `t(locale)` and title/label lookups that fall back to the `zh` source string when no `en` entry exists.
  - `app/src/lib/locale.server.ts` (server-only): `LOCALE_COOKIE='sr_locale'`, `currentLocale()` reading the cookie via `getCookie` (default `zh`, validate against `LOCALES`), `setLocaleCookie(locale)` via `setCookie` (path `/`, sameSite lax, 1-year maxAge, not httpOnly — a UI preference).
  - `app/src/lib/locale.ts`: `getLocale` (GET server fn → `currentLocale()`), `setLocale` (POST server fn, validates input, calls `setLocaleCookie`). Imports `locale.server` + `i18n` types.
- **Availability (locale-aware).** In `app/src/lib/lessons.ts`, add `listAvailableLessonIds` (GET server fn) that reads `currentLocale()` and returns lesson ids node-complete in that locale, computed by one SQL query that unions every translatable node id referenced by `content` (prose body nodes, svg `caption_id`, read_check ids + option ids) and `exercises` (item ids + option ids) and keeps lessons with zero nodes missing from the `(lesson, locale)` overlay. `zh` naturally returns all lessons with content. Keep `listLessonIds` for any all-lessons need. Export a pure `isLessonAvailable(referencedNodeIds, overlayKeys)`-style helper for unit testing the rule without DB.
- **Reading (locale-aware).** In `app/src/lib/reading.ts`, replace `const SOURCE_LOCALE = 'zh'` usage: `getLessonReading` joins `sr_lesson_i18n` on `currentLocale()`; wrap `projectCards` so a missing overlay node → return `null` (not-readable / fallback) instead of throwing. `recordReadCheck` records `currentLocale()` in the event `locale` column. Pure `projectCards`/`projectReadCheck`/`judgeReadCheck` stay unchanged (already KEY-free).
- **Practice (locale-aware).** In `app/src/lib/quiz.ts`:
  - `getLessonQuestions` reads `currentLocale()`. `zh`: unchanged (`sr_questions`). `en`: read `sr_lessons.exercises` + `en` overlay + `sr_questions` (id/ord/type); for each item build `QuizQuestion { id: sr_questions.id (by ord), ord, type: localized label, answerMode:'choice', prompt: overlay[item.id], options: item.options.map(overlay) }`. Emit no KEY.
  - `recordAnswer` reads `currentLocale()`; judging unchanged (via `sr_questions`); under `en` return `answer: ''` (suppress the `zh` reference explanation) so no half-Chinese reveal. Attempts/scoring untouched.
- **Catalog / curriculum (locale-aware).** Give `curriculum.ts` helpers a `locale` param: `withAvailableLessonIds(ids, locale)` — `en` filters to available lessons, drops empty stages/subjects, and sets localized titles; `zh` unchanged. `getAvailableLessons(ids, locale)`, `getLessonLabel(id, locale)`, `getLessonNavForIds(id, ids, locale)` localize titles. Keep default `locale='zh'` so existing callers/tests behave.
- **Routes / components.** `_app.tsx`, `_app/index.tsx`, `_app/lesson.$id.tsx` loaders call `getLocale` + `listAvailableLessonIds` and return `locale`. `catalog.tsx` renders labels via `t(locale)` / curriculum maps, hides stories under `en`, and hosts the `LanguageSwitch` (calls `setLocale` then `useRouter().invalidate()`). `card-reader.tsx` and `quiz-drawer.tsx` take a `locale` prop and render all strings via `t(locale)`; `quiz-drawer` locale defaults to `zh` (story route passes `zh`). `_app/index.tsx` overview strings localized.
- **CSS.** Add a `.sr-lang-switch` segmented control block to `app/src/styles/app.css` using existing `--sr-*` tokens only.

## Implementation Drift Controls

- **KEY secrecy is non-negotiable:** the `en` `getLessonQuestions` projection must never select or emit `correct_index`/`accept`/`answer`; verify the actual `en` network payload has no KEY during browser verification. Judging stays server-side.
- **`zh` must not regress:** every locale-aware branch defaults to / preserves the exact existing `zh` code path (catalog full outline + placeholders, `sr_questions` deck with its reveal explanations, judging, scoring). Do not refactor the `zh` path.
- **Story flow must not regress:** `QuizDrawer` locale prop defaults to `zh`; `recordAnswer` changes are lessons-only and keep the `zh` reveal; the story route keeps its existing fetch/record fns.
- **No content/schema writes:** availability/text come only from existing data + in-app i18n. Do not modify overlays/content/exercises/schema/`sr_users`.
- **Locale trust:** server fns derive locale from the cookie, never from a client argument, so KEY projection cannot be influenced by the client.
- **Alignment assumption is load-bearing:** the `en` deck relies on `exercises`↔`sr_questions` `ord`/option/`correct_index` alignment (spec Critical Existing Contracts). A unit test asserts option-order alignment for at least one real lesson's data-shape logic; browser verification confirms correct judging under `en`.
- **Availability fallback fails safe:** `getLessonReading` returns `null` for an under-covered locale rather than rendering half-Chinese or 500ing.
- Rejected options must not reappear: no layout-store-only locale (server can't trust it), no grey/half-Chinese untranslated entries, no translated explanations, no visible stories under `en`.
- Uncertainty → record in `im-handoff.md`, never silent fallback.

## Phases

1. **Locale primitives + i18n dictionary.** Add `i18n.ts`, `locale.server.ts`, `locale.ts`. Enumerate every learner-visible string from the spec R-UI list into `UI`; author `SUBJECT_LABELS`/`STAGE_LABELS`/`LESSON_TITLES` for the 16 available lessons + their 2 stages + subjects. Verify: `npm run test` (new i18n unit test) + typecheck.
2. **Availability + reading + practice server fns.** Add `listAvailableLessonIds`; make `reading.ts` and `quiz.ts` locale-aware per approach. Regression: `reading.ts` pure fns unchanged; `recordAnswer`/attempts untouched for `zh`; `getLessonQuestions` `zh` path identical. Verify: unit tests (availability rule, en projection KEY-free, en reveal suppressed) + typecheck.
3. **Curriculum + catalog + routes + components + CSS.** Add `locale` params to `curriculum.ts` helpers (default `zh`); localize `catalog.tsx`/`card-reader.tsx`/`quiz-drawer.tsx`/`_app/index.tsx`; add `LanguageSwitch` + `.sr-lang-switch` CSS; wire loaders. Regression: story route still passes `zh`; existing `curriculum.test.ts` still green (default locale). Verify: `npm run test` + `npm run build`.
4. **Empirical browser verification (required, UI story).** Per runbook `cd app && npm run dev`; mint the `sr_session` cookie for test learner user_id 2 (memory `sr-test-account`); drive a standalone Playwright script using `app/node_modules/playwright`:
   - en: switch to English → catalog shows only translated math lessons in English (stages 2 & 3) → open a lesson → cards + captions in English → answer a read-check (server-judged) → open practice → questions in English → answer one (server-judged) → capture the en reading/questions network payloads and assert no KEY;
   - untranslated-hidden: confirm the en catalog omits the untranslated outline placeholders (math stages 1, 4–11) that zh shows;
   - zh restored: switch back to zh → full outline + Chinese content unchanged;
   - screenshots for each. Clean up any `sr_content_answer_events`/`sr_answer_events` rows created.
5. **Handoff + full suite.** `cd app && npm run test` and `npm run build` clean; write `im-handoff.md`.

## Unit Test Plan

Location: `app/src/lib/*.test.ts` (colocated, vitest, the project unit floor) with a mirror note under `.intentmill/tickets/STEMROBIN-24-language-switch/tests/`. Relevant existing tests: `reading.test.ts`, `curriculum.test.ts`, `answer-normalize.test.ts` (must stay green).

High-risk assertions:
- **Availability rule (core AC):** a synthetic lesson whose `en` overlay is missing ≥1 referenced node id is EXCLUDED from the en-available set but INCLUDED in the zh set; a fully-covered lesson is included in both. (Pure helper, no DB.)
- **en practice projection is KEY-free:** projecting an `exercises` item + overlay yields prompt/options text and NO `correct_index`/`accept`/`answer` field.
- **en reveal suppression:** the `en` branch of the reveal returns an empty reference explanation (no zh prose), while `zh` returns the explanation.
- **exercises↔sr_questions alignment logic:** the mapping from item `ord` → question id and option order is order-preserving (data-shape unit).
- **i18n completeness/fallback:** `t('en', key)` returns a non-`zh` string for every enumerated UI key; `LESSON_TITLES`/`STAGE_LABELS` cover all 16 available lessons + their stages; unknown id falls back to the `zh` source string.
- **curriculum locale param:** `withAvailableLessonIds(ids,'zh')` equals the pre-ticket output (regression); `'en'` drops non-available lessons and empty stages.

Commands: `cd app && npm run test`; `cd app && npm run build`.

## Handoff Expectations

After development, write `.intentmill/tickets/STEMROBIN-24-language-switch/refs/im-handoff.md` summarizing actual changes at file granularity, any deviation from `im-spec.md`/`im-plan.md` and why, the browser-verification evidence (en end-to-end, untranslated-hidden-in-en, zh unchanged, no-KEY-in-en-payload — with screenshots), unit test + build results, confirmation that `zh` is unchanged and overlays/content/`sr_users` are untouched, and any residual issues / future improvements (notably: all 16 lessons are fully en-translated so the hidden-in-en behavior is shown via unit test + outline-placeholder omission; practice reference explanations are not translated under `en`). Do not reopen cap4.
