# IntentMill Handoff — STEMROBIN-25

## Summary

Both math question surfaces are now choice-only, reversibly, and all existing fill-in-the-blank (`input`) read-checks were re-authored as diagnostic multiple-choice. Empirically: across all 16 math lessons the `input`-mode count in read-check + exercises is **0**, coverage is preserved (read_check 90 choice + 40 input → 130 choice; exercises unchanged at 331 choice), en overlay coverage == zh for every lesson, and no answer KEY leaks into any overlay or rendered HTML.

## Actual Changes

### Generator (choice-only enforced reversibly; input capability preserved)

- **New `‎.agents/skills/sr-math-lesson/scripts/question-policy.mjs`** — single source of truth for the reversible policy: `CHOICE_ONLY = true`, `readCheckModes()` → `['choice']` (else `['choice','input']`), `exerciseModes()` → `['choice']` (else `['choice','input','work']`).
- **`scripts/check-content.mjs`** — read-check mode gate now calls `validateItemKey(..., readCheckModes())` instead of the hard-coded `['choice','input']`. `validateItemKey`'s body (all three mode branches) is unchanged.
- **`scripts/check-exercises.mjs`** — exercise item mode gate now calls `validateItemKey(..., exerciseModes())` instead of `['choice','input','work']`.
- **Docs:** `SKILL.md` design commitment #4 extended to cover read-check (both surfaces choice-only under the reversible policy); `references/capability-2-lesson-html/lesson.md` read-check authoring now mandates choice-only; `references/capability-3-exercises/exercises.md` mode note updated to the choice-only policy.

**Reversibility:** to re-enable `input` (and `work`), flip `CHOICE_ONLY` to `false` — no other code change. The schema keeps `input` as a valid `mode`/`answer_mode` (untouched), the app keeps rendering/judging `input` (`app/src/lib/reading.ts`, untouched), the renderer keeps its neutral projection (`render-lesson.mjs`, untouched), and `validateItemKey`'s `input`/`work` branches stay intact (unit-tested: an `input` item still validates when the policy allows `input`).

### Data (40 input read-checks → choice, via the deterministic generator path)

- **40** `input` read-checks across **15** lessons re-authored as 4-option single-answer diagnostic choice (math-s2-08 练习课 had 0 read-checks). **Exercises unchanged** — all 331 exercise items were already `choice` (STEMROBIN-13 + the 0004 JSONB migration); no exercise data was touched.
- Approach: prompt (and the concept it tests) preserved unchanged; added 4 option nodes `<rc.id>-o0..o3`, `key.correct_index` in the neutral `content` base, `mode:'choice'`. Each distractor is the same surface form as the answer (numbers for a numeric answer, expressions for an expression answer, terms for a term answer) and wrong for a nameable, common misconception — see per-item design in `refs/conversion-summary.md`. No mechanical "which is X?" conversions; no filler ("无法确定 / 以上都不对"); no meta-sentence 误区标签 options.
- Persisted only through the generator's deterministic path (no hand-written rows): `save-lesson.mjs` (validates content+exercises+overlay, human-outline check, renders html/pdf, upserts `sr_lessons.content/exercises/html/pdf` + `sr_lesson_i18n(zh)`), then `translate-lesson.mjs` (authored en → `check-i18n` gate → upsert `sr_lesson_i18n(en)`).
- New option prose added to both zh and en overlays (`{ t, src_rev:1 }`), keeping en coverage == zh.

### Artifacts

- Pre-mutation snapshot of all 16 lessons (`content`/`exercises`/`zh`/`en`): `refs/snapshot-before/` (reversible restore source).
- Conversion summary (per item: correct answer, distractors, misconception design): `refs/conversion-summary.md`.
- Side effect: the `en` authoring worksheets `.intentmill/tickets/STEMROBIN-23-en-translation/refs/translation/en/math-s{2,3}-*.json` were updated with the new option nodes (this is the fixed path `translate-lesson.mjs` reads/writes; the files now match the persisted en overlays).

## psql Proof

- `input`-mode count across all 16 lessons (read-check + exercises) = **0**.
- Coverage preserved: read-check 130 choice (= previous 90 choice + 40 converted input; none dropped); exercises 331 choice (unchanged); every lesson's read_check and exercise counts equal the snapshot.
- en node-set == zh node-set for all 16 lessons (0 zh-only, 0 en-only).
- KEY leak: 0 overlay entries carry `correct_index`/`accept`/`answer`. Converted item carries `key.correct_index` in the neutral `content` base; rendered `html` has 0 `correct_index`/`accept` and renders the options.
- Sample/new-generation: the generator gate on a real choice-only lesson PASSES; the same content with one read-check forced back to `input` is REJECTED — so any newly generated lesson is choice-only.

## Spec And Plan Alignment

- **Spec obligations (R1–R8):** all satisfied — see `tests/test-results.md ## Coverage Map`. R1/R2/R3 (reversible choice-only policy, input path intact), R4/R5 (4-option same-form distractors, prompt/concept preserved, none dropped), R6 (KEY neutral-base-only), R7 (en==zh coverage), R8 (DB-wide input==0, coverage preserved).
- **Plan obligations:** followed the 5 phases and the deterministic save+translate route; no deviation.
- **Critical existing contracts:** JSONB SSOT, answer-key secrecy (G5), deterministic persistence, i18n translation contract, deck composition, `validateItemKey` — all preserved and verified.
- **Non-scope / rejected options honored:** no `app/` change, no schema change, no exercise-data change, no `sr_users` change, no removal of the orphaned relational scripts, no mechanical conversions.
- **Test obligations:** 8 ticket unit tests pass; deterministic gates pass on all real data; empirical psql evidence captured.

## Missed User-Review Points

None. (The ticket premise assumed exercises also contained `input` items; empirically they were already 100% choice. This narrowed the data work to read-checks only and fully honors the goal — it is a finding, not a requirement change, so no return to cap5 is warranted.)

## Residual Issues / Future Improvements

- **App-side browser verification not run in-session:** no `app/` code changed and `app/node_modules` is absent. The choice read-check render/judge path (`app/src/lib/reading.ts`) is unchanged and already production-verified for the 90 pre-existing choice read-checks (timeline 0020 live smoke). The 40 converted items are structurally identical, and the rendered lesson HTML was inspected (options shown, no KEY). A full headed browser pass over a converted lesson could be added by n-autoqa if desired.
- **Orphaned pre-0004 scripts** `scripts/choice-deck.mjs` + `scripts/backfill-choice-decks.mjs` (relational `sr_questions` model, mechanical distractors) remain — dead code left in place per engineering-rule #3 (not deleted unasked). Candidate for a separate cleanup ticket, together with the legacy `sr_questions`/`sr_answer_events` relational deck tables if unused.
- **Re-enabling input later** is a one-line flip of `CHOICE_ONLY`; backfilling specific questions to `input` would be a separate data task.

## Charter Drift

None. No stack/ops change; no charter update needed.
