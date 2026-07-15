# IntentMill Handoff — STEMROBIN-24 (language switch + en math end-to-end)

## What Was Built

A learner-facing **language switch (中 / EN)** that renders the whole math experience in the chosen locale by reading the per-locale overlay (`sr_lesson_i18n`), with clean per-locale availability. No schema/overlay/content change; no new dependency.

- **Locale source of truth = `sr_locale` cookie, read server-side.** Overlay/KEY projection never depends on a client-sent locale.
- **Catalog** honors locale: `zh` shows the full outline unchanged; `en` shows only en-available lessons (subject/stage/lesson titles in English), dropping untranslated placeholders + empty stages/subjects, and hiding the 名人传记 section.
- **Reading** (per-card prose, figure captions, read-checks) projects the active locale's overlay; formulas/SVG are the shared neutral base.
- **Read-check** prompts/options render in the locale and are judged server-side against the hidden neutral KEY; the answered locale is recorded.
- **Practice deck** in `en` sources prompt/option text from the neutral `exercises` JSONB + `en` overlay, keyed to the aligned `sr_questions` row by `ord`, reusing the existing numeric-id judge + attempt/scoring machinery. Post-answer feedback in `en` is the verdict + correct-option highlight; the zh reference explanation is suppressed (no half-Chinese).
- **KEY projection per locale:** the `en` GET payloads (reading + questions) carry no `correct_index`/`accept`/`answer` (verified on the wire).
- **UI switch:** a persistent segmented `中/EN` control in the catalog header, styled with existing `--sr-*` tokens.

## Files Changed (app/)

New:
- `src/lib/i18n.ts` — isomorphic: `Locale`, UI-string dictionary + `t()`, curriculum label maps (subject/stage/lesson-title/question-type) + localize helpers.
- `src/lib/locale.server.ts` — `LOCALE_COOKIE`, `currentLocale()`, `setLocaleCookie()`.
- `src/lib/locale.ts` — `getLocale` (GET) / `setLocale` (POST) server fns.
- `src/lib/i18n.test.ts`, `src/lib/locale-behavior.test.ts` — unit tests.

Modified:
- `src/lib/lessons.ts` — `listAvailableLessonIds` (locale-aware, node-complete) + pure `lessonAvailableInLocale`.
- `src/lib/reading.ts` — `getLessonReading`/`recordReadCheck` use `currentLocale()`; defensive `null` for under-covered locale.
- `src/lib/quiz.ts` — `getLessonQuestions` locale-aware (`projectQuestions`); `recordAnswer` reveal suppression (`localeReveal`).
- `src/lib/curriculum.ts` — `locale` param on `getLessonLabel`/`getAvailableLessons`/`withAvailableLessonIds`/`getLessonNavForIds`; `parseLessonNumber`.
- `src/components/catalog.tsx` — locale prop, `LanguageSwitch`, localized labels, stories hidden in en, id-derived numbering.
- `src/components/card-reader.tsx`, `src/components/quiz-drawer.tsx` — `locale` prop, all strings via `t()`; drawer locale defaults to `zh` (story route unchanged).
- `src/routes/_app.tsx`, `src/routes/_app/index.tsx`, `src/routes/_app/lesson.$id.tsx`, `src/routes/_app/login.tsx` — loaders return locale; strings localized.
- `src/styles/app.css` — `.sr-lang-switch` segmented control (`--sr-*` tokens).

(`package-lock.json` was reverted after `npm install` spuriously pruned extraneous optional esbuild binaries — no dependency change was made.)

## Browser Verification Evidence

Standalone Playwright (`app/node_modules/playwright`), dev server `http://localhost:3000`, test learner user_id 2 via minted `sr_session` cookie (no password typed). Script: `tests/verify-language-switch.mjs`. Result: **VERIFICATION PASSED**. Screenshots in `refs/verification/`.

- **en end-to-end:** switch to EN → catalog "Curriculum / Math / Stage 2 · Letters and Algebraic Expressions" with English lesson titles (`02`,`05`) → open lesson → English card prose + KaTeX (`03`) → read-check (choice + input) judged server-side (`04`) → practice drawer "Practice 1/18", type "Identify", "What does 3a mean?" + English options, judged (`05`,`06`).
- **untranslated-hidden-in-en:** en catalog omits math stages 1 & 4–11 (all untranslated) and the stories section; outline rows asserted to contain no stray Chinese.
- **zh unchanged:** switch back to 中 → full outline (all stages + placeholders) + Chinese titles/read-checks/nav restored (`07`).
- **no-KEY-in-en-payload:** captured reading(1) + questions(2) JSON responses; asserted none contain `correct_index`/`accept`/`answer`.
- **viewport:** desktop 1360×900 (full flow) + mobile 375×812 catalog/switch, no overflow (`08`).

Unit tests: `npm run test` 47 passed. Typecheck: `tsc --noEmit` exit 0. Build: `npm run build` exit 0.

## Spec And Plan Alignment

- **Spec obligations:** all 9 requirements met (switch, persistence, catalog/reading/read-check/practice in locale, per-locale availability, zh unchanged, no new dep). Verified by unit tests + browser.
- **Plan obligations:** implemented exactly as planned (cookie locale, i18n module, locale-aware availability/reading/quiz, curriculum locale params, catalog switch + hidden stories, CSS). One refinement beyond the plan: catalog stage/lesson numbers are derived from the lesson id (`parseLessonNumber`) so the filtered `en` outline keeps true stage/lesson numbers (array-index numbering would renumber). Still satisfies the spec.
- **Critical existing contracts:** answer-key secrecy preserved (en payloads KEY-free, verified); server-side DB/locale resolution; read-check/practice judging + attempts unchanged; exercises↔sr_questions alignment relied on (verified 1:1); shared quiz-drawer story flow unchanged (`zh` default).
- **Non-scope / rejected options:** no overlay/content/schema/`sr_users` change; no layout-store-only locale; no grey/half-Chinese entries; no translated explanations; stories not shown in en. All honored.
- **Test obligations:** every plan Unit Test Plan item mapped in `tests/test-results.md ## Coverage Map`.

## Missed User-Review Points

None. All product decisions were adjudicated in `im-grill.md` (D1–D7) from the frozen charter + seed 草案6 under full delegation; no decision materially affecting requirements/acceptance/architecture was deferred.

## Residual Issues / Future Improvements

- **All 16 lessons are fully en-translated**, so there is no real lesson readable-in-zh-but-hidden-in-en; the "hidden in en" acceptance is proven by the availability unit test + the browser-observable omission of untranslated outline placeholders. Overlays are READ-only, so no synthetic hidden lesson was created. (Surfaced to reviewer.)
- **Practice reference explanations are not shown under `en`** (no translated explanation node exists in any overlay; translating them is T5/content scope). Choice feedback in en = verdict + correct-option highlight.
- Future: additional locales reuse the same cookie + overlay + availability mechanism unchanged; translating the curriculum outline for not-yet-available lessons, 名人传记, and physics is future content work; `<html lang>` per-locale and progress-card real data remain out of scope.

## Worktree Status

All changes committed in this ticket worktree (branch `STEMROBIN-24-language-switch`). No merge, no push, no deploy (per executor scope). Overlays/content/schema/`sr_users` untouched; disposable test answer-event rows for user_id 2 cleaned up.
