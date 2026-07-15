# Test Results — STEMROBIN-24 (language switch + en math end-to-end)

## Commands

- `cd app && npm run test` → **47 passed** (5 files). New: `src/lib/i18n.test.ts` (9), `src/lib/locale-behavior.test.ts` (13). Existing regressions green: `curriculum.test.ts` (9), `reading.test.ts` (9), `answer-normalize.test.ts` (7).
- `cd app && npx tsc --noEmit` → **exit 0** (clean typecheck).
- `cd app && npm run build` → **exit 0** (production build, `.output/` generated).
- Browser verification (standalone Playwright, `app/node_modules/playwright` 1.61.1, chromium): `node .intentmill/tickets/STEMROBIN-24-language-switch/tests/verify-language-switch.mjs` → **VERIFICATION PASSED**. Dev server `http://localhost:3000` (`cd app && npm run dev`). Viewports: desktop 1360×900 (full flow) + mobile 375×812 (catalog/switch, `/tmp/mobile-shot.mjs`).

## Development Test Log

1. Added `i18n.ts` (dictionary + curriculum-label maps) → wrote `i18n.test.ts` → `npm run test` green.
2. Added locale primitives + locale-aware `listAvailableLessonIds` (pure `lessonAvailableInLocale`), `reading.ts`, `quiz.ts` (`projectQuestions`, `localeReveal`) → wrote `locale-behavior.test.ts` → `npm run test` green.
3. Localized curriculum helpers + catalog/routes/components + CSS → `npx tsc --noEmit` exit 0 → `npm run test` 47 green → `npm run build` exit 0.
4. Empirical browser walkthrough (desktop): zh full outline → switch EN → en catalog (only translated stages, untranslated hidden, no stray Chinese) → open lesson → English cards + read-check (choice + input) judged server-side → practice deck English + judged, reveal not half-Chinese → captured reading/questions payloads (no KEY) → switch back to 中 (zh restored). Then mobile 375×812 catalog/switch screenshot.
5. Cleaned up disposable test rows (`sr_content_answer_events` 24, `sr_quiz_attempts` 1 + cascade) for test learner user_id 2 / `math-s2-01`.

## Coverage Map (plan ## Unit Test Plan → evidence)

| Planned obligation | Evidence |
|---|---|
| Availability rule: partial en → hidden, zh → available; full → both | `locale-behavior.test.ts` › `lessonAvailableInLocale` (3 cases) + browser untranslated-hidden |
| en practice projection is KEY-free | `locale-behavior.test.ts` › projectQuestions "never leaks a KEY" (asserts exact key set) + browser no-KEY payload assertions |
| en reveal suppression (no zh prose) | `locale-behavior.test.ts` › `localeReveal` + browser "reveal not half-Chinese" |
| exercises↔sr_questions order-preserving mapping | `locale-behavior.test.ts` › projectQuestions en options in order + browser judged-correctly |
| i18n completeness/fallback | `i18n.test.ts` (t interpolation/fallback, 16 lesson titles, 2 stages, localize helpers, question types) |
| curriculum locale param (zh regression / en filter) | `locale-behavior.test.ts` (withAvailableLessonIds zh full vs en filtered; getAvailableLessons; getLessonLabel) + existing `curriculum.test.ts` still green |
| KEY secrecy on the wire (en) | Browser: captured reading(1)+questions(2) payloads, asserted no `correct_index`/`accept`/`answer` |
| zh unchanged | Browser 07-zh-restored (full outline + Chinese content) + `curriculum.test.ts`/`reading.test.ts` unchanged green |

## Screenshots (refs/verification/)

- `01-zh-catalog.png` — zh full outline (all stages + placeholders)
- `02-en-catalog.png` — en catalog (translated stages only, English titles, stories hidden)
- `03-en-lesson-card.png` — en card prose + read-checks (KaTeX shared)
- `04-en-readcheck-verdict.png` — en read-check judged server-side
- `05-en-practice.png` — en practice drawer ("Practice 1/18", "Identify", English prompt/options)
- `06-en-practice-verdict.png` — en practice judged server-side
- `07-zh-restored.png` — zh restored, unchanged
- `08-en-mobile-catalog.png` — 375px mobile: switch + en catalog, no overflow

## Notes

- All 16 real lessons are fully en-translated, so no real lesson is readable-in-zh-but-hidden-in-en; the "untranslated hidden in en" AC is proven deterministically by the availability unit test AND observably by the en catalog omitting the untranslated outline placeholders (math stages 1, 4–11) that zh shows.
