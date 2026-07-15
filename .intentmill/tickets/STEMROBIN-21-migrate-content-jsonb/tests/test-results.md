# Test Results — STEMROBIN-21

## Commands

- Unit (offline, no DB): `node --test .intentmill/tickets/STEMROBIN-21-migrate-content-jsonb/tests/migrate-lib.test.mjs` → **6 pass / 0 fail**.
- Ledger migration: `node .agents/skills/sr-math-lesson/scripts/save-ledger.mjs --ledger resources/content/math-ledger/stage-{2,3}.json` → 2 ledger rows.
- Batch migration (idempotent): `node .agents/skills/sr-math-lesson/scripts/migrate-all.mjs` → 16 lessons migrated, all "prose IDENTICAL".
- Empirical DB verification (psql via the skill client): all acceptance queries → **ALL CHECKS PASSED**.
- Idempotency: re-run one concept + one method lesson, byte-compare JSONB → **byte-identical**.
- Reader compatibility (browser): app dev server `http://localhost:3000` (`cd app && npm run dev`), route `/lesson/math-s2-03`, desktop viewport 1280×800 → migrated lesson renders (numbered cards, KaTeX typeset, authored read-check projection, catalog nav 2.2→2.3→2.4). Screenshot captured in-session.

## Development Test Log

1. Added `render-lesson.mjs` `html` prose role → confirmed via unit test `content+read-checks pass validateContent` and the later browser render (no regression to existing roles; the block markup renders verbatim).
2. Wrote `migrate-lib.mjs` pure functions → ran `node --test` after each: splitter, `htmlToCards` (concept/method/练习课), `deckToExercises`, `mergeReadChecks`. All green offline before any DB write.
3. Migrated ledgers → verified 2 `sr_content_ledger` rows via psql.
4. Single-lesson e2e (`math-s2-03`) → `content`/`exercises`/overlay persisted, PDF rendered, prose IDENTICAL; caught and fixed the idempotency defect (re-parsing self-rendered html) by sourcing from the pristine snapshot; re-verified byte-identical JSONB on re-run.
5. Batch of 16 → psql verification of every acceptance criterion; no-KEY-in-html grep = 0; `sr_users`=2 and `sr_questions`=331 unchanged.
6. Browser smoke on the reader after migration.

## Coverage Map

| Plan test obligation | Where covered | Result |
|---|---|---|
| Section splitter (nested same-tag, figure/svg) | `migrate-lib.test.mjs` test 1 | pass |
| `htmlToCards` concept: genre-exact anchors, num 1..N, practice dropped, svg node, overlay coverage | test 2 | pass |
| `htmlToCards` method anchors | test 3 | pass |
| `htmlToCards` 练习课 → single card, validateContent clean | test 4 | pass |
| content + ≥2 read-checks pass `validateContent` | test 5 | pass |
| `deckToExercises` choice key={correct_index} only, ords contiguous, options in overlay, explanation not carried, no KEY in overlay | test 6 | pass |
| KEY-secrecy: no `correct_index`/`accept`/`answer` in any overlay | tests 2,5,6 + psql `keyLeak=0` for all 16 | pass |
| No KEY in rendered html | psql grep across 16 = 0 | pass |
| ≥2 read-checks per substantial card in DB | psql per-lesson `rc/sub=ok` for all 16 (130 total) | pass |
| exercises items ord-contiguous, ≥16, 1:1 with source deck | psql (331 items = 331 sr_questions) | pass |
| 2 ledger rows queryable | psql | pass |
| Idempotency (re-run leaves JSONB unchanged) | `idem.mjs` byte-compare | pass |
| Prose fidelity (no re-authoring) | per-lesson `*.prose.diff` = IDENTICAL for all 16 | pass |
| `sr_users` (2) + `sr_questions` (331) unchanged; identities preserved | psql | pass |
| Reader renders migrated lesson (renderer additivity, KaTeX, SVG, practice) | browser + psql html-content check | pass |

Renderer additivity note: the `html` role is a new value; existing `note`/`pitfall`/`h3`/`default` branches are untouched. The migration is the only consumer of the role; T2-authored lessons do not emit it. Verified by inspection + the concept-lesson render smoke (existing roles still wrap correctly).
