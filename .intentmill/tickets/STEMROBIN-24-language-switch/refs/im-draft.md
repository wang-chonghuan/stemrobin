# IntentMill Draft

## Source

- ticket key: `STEMROBIN-24-language-switch`
- ticket id: `STEMROBIN-24`
- `.intentmill/tickets/STEMROBIN-24-language-switch/meta.json` read (branch/worktree confirmed).
- `.intentmill/tickets/STEMROBIN-24-language-switch/intent.md` read as the raw original user input (STORY, batch 0004, seed STEMROBIN-18, full delegation).
- `AGENTS.md` read and obeyed (thin router; charter frozen inside batch; verify by running the product).
- `.prodfarm/charter/` read: `goal.md` (multilingual math committed, en first), `engineering-rules.md` (SSOT, surgical change, no new deps, answer-key secrecy G5), `architecture.md`, `runbook.md` (dev/test/build commands), `redlines.md` (do not touch `sr_users`).
- `.evodocs/modules/` read: `mod--app.md`, `mod--app--learner-experience.md`, `mod--app--domain-services.md`, `mod--database-schema.md`, `mod--content-generation.md`. Substantive; used to locate reading/quiz/catalog code. Treated code as authoritative on the exact JSONB/overlay shapes.
- Design tokens: `resources/reference/DESIGN.md` read for the language-switch control (uses `--sr-*` tokens, catalog-item / count-pill / blue-tint conventions).
- Code inspected: `app/src/lib/reading.ts`, `app/src/lib/quiz.ts`, `app/src/lib/lessons.ts`, `app/src/lib/curriculum.ts`, `app/src/lib/db.ts`, `app/src/lib/session.ts`, `app/src/lib/session.server.ts`, `app/src/lib/layout-store.ts`, `app/src/lib/stories.ts`, `app/src/components/card-reader.tsx`, `app/src/components/quiz-drawer.tsx`, `app/src/components/catalog.tsx`, `app/src/routes/__root.tsx`, `app/src/routes/_app.tsx`, `app/src/routes/_app/index.tsx`, `app/src/routes/_app/lesson.$id.tsx`, `ssot-schemas/db-schemas/stemrobin.sql`.
- DB (read-only) inspected via `psql "$EASYAPP_DATABASE_URL"`: confirmed the actual overlay/exercises data (findings below). No writes.
- No external SDK/API added — feature is internal to the existing TanStack Start + Postgres stack; no `find-docs`/Context7 needed. `nf-db` not used because this ticket performs READ-only DB inspection and adds no schema/migration (charter forbids touching content/overlays/schema here).

## Draft Spec

After delivery the following must be true (black-box, learner-observable):

1. The app exposes a learner-facing **language switch (zh / en)**, persisted across navigation and reloads. Default remains `zh`.
2. When `en` is selected, the whole math experience renders in English by reading the `en` overlay (`sr_lesson_i18n` locale='en') instead of `zh`:
   - **catalog** entries (subject / stage / lesson titles) of fully-translated lessons render in English;
   - **per-card reading prose** and figures/captions render in English;
   - **read-checks** (prompt + options) render in English and are judged server-side;
   - **practice deck** (prompt + options) renders in English and is judged server-side.
3. **Per-locale availability (clean, D5, no mixed-language fallback):** a lesson is available/readable in a locale ONLY if that locale fully covers it. `zh` (source) is always available. Untranslated lessons do NOT appear as readable items under `en`. The `en` catalog shows only en-available lessons; it never shows a half-Chinese entry.
4. The `zh` experience (STEMROBIN-22) is UNCHANGED when locale=zh — same catalog, prose, read-checks, practice, judging, wording.
5. Formulas / SVG are shared across locales (neutral base); switching language never changes them.
6. **Answer-key secrecy in every locale (G5):** the initial browser payload in `en` (as in `zh`) carries NO answer KEY (correct_index / accept / reference answer). Read-check + practice judging stay server-side.
7. No new runtime dependency; no schema/overlay/content change.

## Draft Plan

Rough direction (details finalized in cap5):

- **Locale source of truth = a cookie** `sr_locale` ∈ {`zh`,`en`}, mirroring the existing `sr_session` cookie pattern in `app/src/lib/session.server.ts`. A server helper `currentLocale()` reads it; server functions project the correct overlay from the cookie so no answer-key ever depends on client-sent locale. A `getLocale` (GET) + `setLocale` (POST) server fn pair reads/writes it; the switch UI calls `setLocale` then `router.invalidate()` to re-run loaders. (Draft assumption — cookie vs layout-store is a decision, see Grill Required.)
- **Isomorphic i18n module** `app/src/lib/i18n.ts` (no new dep): `Locale` type, a `t(locale)` dictionary for the app's hardcoded UI strings, and localized maps for the app's own curriculum outline labels (subject/stage/lesson titles) — these labels live in app code (`curriculum.ts`), not in the DB overlays, so localizing them is app-i18n, not content re-translation.
- **reading.ts**: replace the hardcoded `SOURCE_LOCALE` with `currentLocale()` in `getLessonReading` (overlay join) and `recordReadCheck` (event `locale` column). Projection/judging already KEY-free — unchanged. Defensive: if the requested locale does not fully cover the lesson, return `null` (not readable) rather than render half.
- **quiz.ts**: make `getLessonQuestions` locale-aware. `zh` keeps reading `sr_questions` (unchanged). `en` reads the neutral `sr_lessons.exercises` JSONB + `en` overlay for prompt/option text, keyed to the aligned `sr_questions` row by `ord` for the numeric id + server-side judging (verified 1:1 aligned — see Findings). `recordAnswer` stays the judge of record (neutral KEY via `sr_questions`); in `en` it suppresses the zh reference-explanation reveal so no half-Chinese prose appears.
- **Availability**: a locale-aware `listAvailableLessonIds()` server fn (reads `currentLocale()`) returns lessons node-complete in that locale. `curriculum.ts` helpers (`withAvailableLessonIds`, `getAvailableLessons`, `getLessonLabel`, `getLessonNavForIds`) gain a `locale` param: in `en` they filter to available lessons (dropping untranslated placeholders + empty stages/subjects) and localize titles; in `zh` behavior is unchanged.
- **Catalog / routes / components**: `_app.tsx`, `_app/index.tsx`, `_app/lesson.$id.tsx` loaders return `locale`; `catalog.tsx`, `card-reader.tsx`, `quiz-drawer.tsx` render strings via `t(locale)`. The **language switch control** lives in the catalog header (`sr-cat-head`), styled with existing `--sr-*` tokens (segmented zh/en, blue-tint selected). Stories (名人传记) section is hidden under `en` (out of scope for translation, avoids half-Chinese).
- **Tests**: pure unit tests for i18n title/string maps and for the locale-aware availability rule (synthetic en-incomplete lesson → excluded from en, included in zh) under `.intentmill/.../tests` mirror + `app/src/lib/*.test.ts`. Browser (playwright) end-to-end per runbook.

## Code And Evodocs Findings

- **Reading pipeline (`app/src/lib/reading.ts`)** already takes a locale conceptually: it hardcodes `const SOURCE_LOCALE = 'zh'` and comments that STEMROBIN-24 will generalize it. `getLessonReading` joins `sr_lesson_i18n` on `locale = SOURCE_LOCALE`; `projectCards`/`projectReadCheck`/`judgeReadCheck` are pure and KEY-free. Generalization = swap the constant for `currentLocale()`. Minimal, matches T4's stated intent.
- **Answer-key secrecy already holds**: `projectReadCheck` never reads `rc.key`; `getLessonReading` returns only `{head, cards}`; correctness comes only from `recordReadCheck`. Same for practice: `getLessonQuestions` selects no `correct_index/accept/answer`. The `en` overlay itself contains no KEY (schema `sr_lesson_i18n` comment forbids it). Verified in DB.
- **DB reality (read-only inspection):**
  - All 16 lessons (`math-s2-01..08`, `math-s3-01..08`) have non-null `content` AND `exercises` JSONB; each `sr_questions` count equals its `exercises.items` count.
  - **All 16 lessons are fully translated in `en` at the node level** (0 missing nodes) and the `en` overlay key-set equals the `zh` key-set. So with the real data every lesson is available in BOTH locales; there is no naturally zh-only-readable lesson. Consequence: the "untranslated lesson hidden in en" acceptance is demonstrated (a) deterministically by a unit test on the availability rule, and (b) in the browser by the en catalog omitting the untranslated outline placeholders (all math stages except 2 & 3, ~100 future lessons) that zh shows. Flag to reviewer.
  - **Exercises are 100% `choice` mode** (331 items, 0 work/input). The neutral exercises item carries `id`, `ord`, `mode`, `type`, `layer`, `options` (node-id refs), `key.correct_index`, `rev` — **no reveal/explanation node**. The reveal explanation exists only in the relational `sr_questions.answer` (zh). So the `en` practice deck has no translated prose explanation; the correct-option highlight + verdict is the en feedback. Not translating it is correct here (explanation prose is not in any overlay; re-translating content is T5's scope, explicitly out of scope).
  - **Order/key alignment verified**: for `math-s2-01` ord 1 the `sr_questions.options` array is byte-identical and same-order to the zh overlay `ex01-o0..o3`, and both use `correct_index = 0`. So the JSONB `exercises` items and the relational `sr_questions` deck are 1:1 aligned by `ord`, letting `en` reuse the numeric `sr_questions.id` + existing attempt/judge machinery.
  - **No English title anywhere in the DB**: `content` has no title node, the overlay has no title/heading key, the derived `sr_lessons.html` `<h1>` is Chinese, `curriculum.ts` titles are Chinese constants. English lesson/stage/subject titles must be supplied as app-i18n (app owns `curriculum.ts`; T5 never touched it).
  - 1 story row exists (`sr_stories`), so the catalog renders a 名人传记 section (via `getStoryCatalog`); it is untranslated → hidden under `en`.
- **Catalog (`app/src/components/catalog.tsx` + `curriculum.ts`)**: the outline is the title/order source; availability is DB-driven (`listLessonIds` → id present ⇒ `ready`/clickable). Localizing = give these helpers a locale and, in en, filter+localize. `_app.tsx` loads `listLessonIds` + `getStoryCatalog`; `_app/index.tsx` and `_app/lesson.$id.tsx` load `listLessonIds` too.
- **State store**: `app/src/lib/layout-store.ts` is a zustand store for the catalog drawer. A locale could live there, but the server side must know locale to project overlays; a cookie read server-side (like `sr_session`) is the SSOT-consistent choice and avoids client→server locale trust for KEY paths.

### R-UI (best-practice + touched surfaces)
- Peer practice for an in-app content-language switch (Khan Academy, Duolingo, Wikipedia, MDN): a small persistent, always-visible language selector near the top of the primary nav; immediate re-render of the whole shell; persisted preference (cookie/localStorage); untranslated content hidden or clearly marked rather than shown half-translated. This ticket follows the "hide untranslated" variant (charter D5, clean design).
- UI surfaces the change touches / could make inconsistent: catalog header/brand (`sr-cat-head`), subject/stage/lesson outline rows, count pills, stories section, overview detail pane (`总览`, progress card, pillars text, "新上线课程" grid), lesson top bar (返回 / 练习题 / tooltips / PDF), card-reader (progress "第 X / Y 张卡片", 读一读 title, guest note, done panel, nav buttons, verdicts, input placeholder/submit, errors), quiz-drawer (title, count, login gate, empty/loading, start/result scorecards, 继续/重新开始/再做一遍, verdicts, 上一题/下一题/结束本课答题, work-mode copy, errors), login page. Each must switch with locale or (stories) hide, to avoid half-Chinese.
- Binding design source: `resources/reference/DESIGN.md` — the switch uses `--sr-*` tokens only (segmented control on `--sr-line`/`--sr-card`, selected = `--sr-blue-tint` bg + `--sr-blue-deep` text, matching catalog-item + count-pill conventions). No new colors/components.

### R-EXT
- No new/unfamiliar external interface. Postgres access reuses `app/src/lib/db.ts` (`sql()`), the same server-side client. Cookie read/write reuses `@tanstack/react-start/server` `getCookie`/`setCookie` already used by `session.server.ts`. No third-party translation API (charter iron law).

### R-TEST
- Concrete cap6 test obstacles: (1) logged-in flows (recording read-check/practice answers, attempts) need a session — mint the HMAC `sr_session` cookie for the dedicated test learner (user_id 2; `SESSION_SECRET` default `stemrobin-dev-session-secret`) via `context.addCookies`, per user memory `sr-test-account`; do not type passwords. (2) The playwright-test MCP harness has a version conflict in this repo — drive a standalone Playwright script using `app/node_modules/playwright`. (3) "Untranslated hidden in en" cannot be shown with a real lesson (all 16 are fully en-translated) → prove the rule with a pure unit test on the availability function + show the outline-placeholder omission in the browser. (4) DB is the shared Azure Postgres; tests must be READ-only on content and must clean up any `sr_content_answer_events`/`sr_answer_events` test rows they create.

## Assumptions

- Locale is persisted in a **cookie** read server-side (draft direction; confirmed low-risk because it mirrors the existing session cookie and is required for SSR + server-side KEY-safe overlay projection). Alternative (layout-store only) can't feed server fns without trusting client-sent locale — recorded as a decision.
- The `en` practice deck reuses the numeric `sr_questions.id` + existing judge/attempt machinery (justified by verified 1:1 `ord`/option/correct_index alignment). Low-risk given DB evidence.
- English titles/labels for the app's own curriculum outline + UI chrome are **app-i18n strings authored in this ticket** (not DB content, not T5 scope). Low-risk but is a scope judgment → grill.
- `en` practice reveal shows no prose explanation (none exists in any overlay); verdict + correct-option highlight is the en feedback. Low-risk, honest, avoids half-Chinese.
- Stories/名人传记 section is hidden under `en`. Low-risk (out of scope, avoids half-Chinese).

## Risks

- **UI breadth**: many hardcoded Chinese strings across 3 components + 3 routes + login must be localized; missing one shows half-Chinese under en. Mitigation: enumerated surface list above; single `t()` dictionary; browser walkthrough covers each surface.
- **Acceptance-demonstration gap**: all 16 lessons are fully en-translated, so no real lesson is zh-only-readable; the "hidden in en" AC is proven by unit test + outline-placeholder omission, not by a real hidden lesson. Reviewer must accept this (data reality, cannot modify overlays).
- **zh-unchanged invariant**: locale-awareness must default to zh and leave every zh path byte-identical (catalog full outline + placeholders, sr_questions deck, reveal explanations, judging). Mitigation: `zh` branches keep existing code paths; snapshot zh before/after in browser.
- **KEY secrecy**: the new `en` practice path must project prompt/options only and never emit `correct_index`/`answer`; verify the actual en network payload has no KEY.
- **Compatibility**: quiz-drawer is shared with the story route (`recordStoryAnswer`); locale-awareness must not alter story behavior. Mitigation: locale prop defaults to `zh`; recordAnswer changes are lessons-only.
- **DB/dev-test**: shared Azure Postgres; READ-only on content; clean up answer-event rows created by browser verification.
- **No schema/overlay/content change** allowed — all availability/text must come from existing data + app-i18n.

## Grill Required

completed

All blocking decisions in `im-grill.md` (D1–D7) are adjudicated from the frozen charter + seed 草案6 (full delegation, no human): locale = `sr_locale` cookie read server-side; en catalog omits untranslated lessons (node-complete availability); English titles/UI strings authored as in-app i18n (not DB content); en practice reveal = verdict + correct-option highlight (zh explanation suppressed); stories hidden under en; segmented 中/EN control in the catalog header with `--sr-*` tokens; "hidden-in-en" proven by unit test + browser outline-placeholder omission (all 16 real lessons are fully en-translated).
