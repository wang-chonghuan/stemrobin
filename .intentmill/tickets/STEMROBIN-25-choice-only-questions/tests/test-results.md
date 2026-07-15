# Test Results — STEMROBIN-25

## Commands

- Ticket unit tests: `node --test .intentmill/tickets/STEMROBIN-25-choice-only-questions/tests/policy-modes.test.mjs .intentmill/tickets/STEMROBIN-25-choice-only-questions/tests/key-secrecy.test.mjs .intentmill/tickets/STEMROBIN-25-choice-only-questions/tests/conversion-shape.test.mjs` → **8 pass / 0 fail**.
- Generator gates on real data: `check-content.mjs`, `check-exercises.mjs` (via `save-lesson.mjs`), `check-i18n.mjs` (via `translate-lesson.mjs`) — all 15 affected lessons **PASS**.
- Empirical DB verification: `psql` against the shared `stemrobin-schema`.

## Development Test Log

1. Wrote `question-policy.mjs`; wired `check-content.mjs` (read-check) + `check-exercises.mjs` (exercises) to it. Smoke: node one-liner — `readCheckModes()`/`exerciseModes()` = `['choice']`; an `input` read-check now yields `mode must be one of choice`; a `choice` read-check passes. ✓
2. Authored the 40 conversions (`scratch/conversions.json`); ran `scratch/transform.mjs` → 40 conversions, zh-nodes == en-nodes per lesson. ✓
3. Validated + saved `math-s2-01` first (highest-risk: outline-fidelity check): `check-i18n` PASS, `save-lesson` outline PASS + content/exercises validated + PDF rendered + upsert, `translate-lesson` gate PASS. ✓
4. Looped the remaining 14 lessons through `save-lesson` + `translate-lesson`: all outline checks PASS, all i18n gates PASS. ✓
5. Ran the 3 ticket unit-test files: 8/8 pass. ✓
6. Empirical DB verification queries (below). ✓

## Coverage Map

| Plan Unit Test Plan item | Covered by | Result |
|---|---|---|
| R1/R2/R3 — validators reject `input`/`work`; helpers `['choice']`; reversible branch intact | `policy-modes.test.mjs` (4 tests) + `save-lesson`/`check-content` runs on real data | pass |
| R6 — KEY (`correct_index`) in content base only; overlay KEY-leak rejected | `key-secrecy.test.mjs` (2 tests) + psql overlay-leak query (0) + rendered-HTML grep (0) | pass |
| R4/R5/R7 — 4-option choice, prompt preserved, distinct options, en==zh coverage | `conversion-shape.test.mjs` (2 tests) + `check-i18n` on all 15 lessons + psql en==zh query | pass |
| R8 — DB-wide `input`==0, coverage preserved (not unit-testable; requires shared DB) | psql: `input_total`=0; per-lesson read_check+exercise counts == snapshot | pass |
| "new generation is choice-only" acceptance | `check-content` CLI: real choice-only lesson PASS, input-injected variant REJECTED (exit 1) | pass |
| App-side choice render/judge (no app code changed) | pre-existing production-verified path (90 choice read-checks; timeline 0020 live smoke) + rendered-HTML inspection (options shown, no KEY) | covered (see handoff) |

## Empirical DB Evidence (psql, `stemrobin-schema`)

- Mode distribution across all 16 math lessons: `read_check` = 130 choice, 0 input (was 90 choice + 40 input); `exercises` = 331 choice, 0 input. `input_total` = **0**.
- en node-set == zh node-set for every one of the 16 lessons (0 zh-only, 0 en-only).
- KEY fields in any overlay (zh or en): **0**.
- Converted item `math-s2-01-explain-rc1` in `content`: `mode:'choice'`, 4 options, `key.correct_index:1` (KEY in neutral base).
- Rendered `sr_lessons.html` (math-s2-01): 0 `correct_index`, 0 `accept`; option spans rendered; converted option text present.
- Per-lesson coverage preservation: every lesson's read_check count and exercise count unchanged vs `refs/snapshot-before/`.

## Not Run / Non-Applicable

- App vitest (`cd app && npm test`): app code was NOT changed; `app/node_modules` absent. The choice read-check render/judge path in `app/src/lib/reading.ts` is unchanged and already production-verified for the 90 pre-existing choice read-checks. Documented in `im-handoff.md`.
- Full DB `save-lesson --sample`: would require seeding a throwaway stage ledger; the equivalent acceptance ("new lessons are choice-only") is proven deterministically by the generator gate (real choice-only lesson passes, input-injected variant rejected), which runs inside `save-lesson` for every save.
