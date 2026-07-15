# IntentMill Grill

> Adjudication mode: prodfarm cap13 full delegation (seed STEMROBIN-18, human confirmed). No human in the loop; every blocking decision is self-adjudicated from the frozen charter + seed 草案6 binding decisions (D5/D13/§11) + charter goal.md. Genuine product decisions the charter cannot settle would be left `TBD` + grill-leaked; none were found.

## Blocking Decisions

1.
- id: D1-locale-persistence
- question: How is the chosen learner locale persisted so both SSR server functions and the client render consistently, without letting the client dictate which overlay (and thus KEY exposure) the server projects?
- recommendation: Persist locale in a `sr_locale` cookie (`zh`|`en`, default `zh`), read server-side via a `currentLocale()` helper mirroring `session.server.ts`; server fns project overlays from the cookie, never from a client-sent locale. Matches charter SSOT + G5 (answer-key secrecy) and avoids a new dependency.
- final_decision: Use the `sr_locale` cookie read server-side (`currentLocale()`), with `getLocale`/`setLocale` server fns and `router.invalidate()` on switch. Adjudicated from charter engineering-rules (SSOT) + G5.

2.
- id: D2-per-locale-availability
- question: In `en`, how does the catalog treat lessons not fully translated to English — grey them (like zh placeholders) or omit them?
- recommendation: Omit them. A lesson is en-available only if its `en` overlay covers every translatable node; the `en` catalog shows only en-available lessons and drops untranslated outline placeholders + empty stages/subjects. `zh` (source) is always available and its full outline is unchanged. This is charter D5 (clean, no mixed-language) applied to the catalog.
- final_decision: Omit untranslated lessons in `en` (node-complete availability; empty stages/subjects dropped); `zh` outline unchanged. Adjudicated from seed 草案6 constraint + plan D5.

3.
- id: D3-english-titles-source
- question: The app's curriculum outline titles (subject/stage/lesson) and all UI chrome strings are hardcoded Chinese in app code and have no `en` source in the DB overlays. Where do English titles/labels come from without re-translating DB content (T5's scope)?
- recommendation: Author them as app-i18n strings in a new `app/src/lib/i18n.ts` (curriculum label maps + UI-string dictionary). These labels live in `curriculum.ts`/components (app code T5 never touched), so localizing them is the "app locale switch" work of this ticket, not content overlay re-translation.
- final_decision: Author English curriculum labels + UI strings as in-app i18n (`i18n.ts`); do NOT modify DB overlays/content. Adjudicated from seed 草案6 scope ("目录…全英文") + ticket scope boundary (T5 = content, T6 = app switch).

4.
- id: D4-en-practice-reveal
- question: The neutral `exercises` JSONB carries no reveal/explanation node and the `en` overlay has none; the zh reference explanation exists only in relational `sr_questions.answer`. What does the `en` practice deck show after answering?
- recommendation: Show the localized verdict + correct-option highlight (choice items — the essential feedback) and suppress the zh reference-explanation prose in `en`. No half-Chinese; no KEY in the payload. Translating explanations is out of scope (content, T5) and no en source exists.
- final_decision: `en` practice reveal = verdict + correct-option highlight, zh explanation suppressed. Adjudicated from charter §11 (no mixed-language, clean) + G5.

5.
- id: D5-stories-under-en
- question: The catalog renders a 名人传记 (stories) section from `sr_stories`; stories are not translated. Show it (Chinese) under `en` or hide it?
- recommendation: Hide the stories section under `en`. Seed scope is math only; showing an untranslated Chinese section in the en shell violates the clean no-mixed-language rule.
- final_decision: Hide 名人传记 under `en`; unchanged under `zh`. Adjudicated from seed scope (math-only) + plan §11.

6.
- id: D6-switch-control
- question: What is the language switch control's placement, affordance, and styling?
- recommendation: A small persistent segmented `中 / EN` control in the catalog header (`sr-cat-head`), always visible, styled only with `--sr-*` tokens (selected = `--sr-blue-tint` bg + `--sr-blue-deep` text, matching catalog-item/count-pill conventions). Follows peer practice (Wikipedia/MDN/Khan: persistent top-of-nav language selector) and `resources/reference/DESIGN.md`.
- final_decision: Persistent segmented `中/EN` in the catalog header, `--sr-*` tokens only. Adjudicated from R-UI peer research + DESIGN.md.

7.
- id: D7-hidden-in-en-demonstration
- question: All 16 real lessons are fully en-translated, so no lesson is readable-in-zh-but-hidden-in-en. How is the "untranslated lesson hidden in en" acceptance verified without modifying overlays (READ-only)?
- recommendation: Prove the availability rule deterministically with a pure unit test (synthetic en-incomplete lesson → excluded from en list, present in zh list), and show the observable manifestation in the browser (en catalog omits the untranslated outline placeholders — all math stages except 2 & 3 — that zh shows; switching back to zh restores them). Do not fabricate DB data.
- final_decision: Verify via unit test on the availability fn + browser outline-placeholder omission; accept that no real zh-only lesson exists (data reality). Adjudicated as test-strategy under full delegation; surfaced to reviewer in the report/handoff.

## Recommended Defaults

- `en` practice deck reuses the numeric `sr_questions.id` keyed by `ord` (verified 1:1 alignment: option order + `correct_index` identical between `sr_lessons.exercises` items and `sr_questions`), so the existing judge (`recordAnswer`) and attempt/scoring machinery serve both locales unchanged; only prompt/option TEXT is sourced from the `en` overlay.
- `reading.ts` generalization = replace `const SOURCE_LOCALE = 'zh'` with `currentLocale()` in `getLessonReading` (overlay join) and `recordReadCheck` (event `locale`); pure projection/judge functions stay untouched (already KEY-free).
- Defensive availability guard: `getLessonReading` returns `null` (fallback / not-readable) if the requested locale does not fully cover the lesson, so a direct URL in `en` to an un-translated lesson never renders half-Chinese or 500s.
- Locale-aware server fns read the cookie internally (no `locale` param threaded through callers); loaders return `locale` for components to localize UI strings.
- `quiz-drawer.tsx` gains a `locale` prop defaulting to `zh`; the story route keeps passing `zh` so story behavior is unchanged.
- Unit tests + `app/src/lib/*.test.ts` colocated; browser verification uses a standalone Playwright script with a minted `sr_session` cookie for test learner user_id 2 (per user memory `sr-test-account`); READ-only on content; clean up created answer-event rows.

## Future Or Conditional Decisions

- Translating practice-deck reference explanations and the curriculum outline for non-available lessons is future content work (T5-style), not this ticket.
- Additional locales beyond `en` (target 7–8) reuse this same cookie + overlay + availability mechanism; no design change needed now.
- Translating 名人传记 / physics is future scope; both stay `zh`-only for now.
- `<html lang>` per-locale + progress-card real data are out of this ticket (progress card is still mockup).

## Out-of-Scope Guardrails

- Do NOT modify `sr_lesson_i18n` overlays, `sr_lessons.content/exercises`, or the schema — READ only (charter; ticket rule).
- Do NOT touch `sr_users` (charter redline).
- Do NOT re-translate content or change the generator/migration/translation skills (T2/T3/T5 scope).
- Do NOT change the `zh` experience: catalog full outline + placeholders, `sr_questions` deck, reveal explanations, and judging stay byte-identical under `zh`.
- Do NOT add a runtime dependency or a third-party translation API (charter iron law).
- Do NOT change formulas/SVG across locales (neutral base, shared).
